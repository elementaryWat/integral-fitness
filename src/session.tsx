import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { uid } from './domain/dates';
import type { Exercise, QueueItem, Session, SetLog } from './domain/types';
import { SUPERSET_TRANSITION_SEC } from './engines/generator';
import { useStore } from './store';
import { loadText, mmss, unitSuffix } from './data';

/**
 * Live training session shared by the watch (simulated until the Zepp OS mini-app lands)
 * and the phone. Logged sets persist to the store with timestamps on the session clock;
 * at simulation speed ×1 the clock is real time.
 *
 * Watch modes:
 *  - idle:  no active session
 *  - set:   performing a set; HR climbs towards ~156 bpm
 *  - rest:  HR decays from the set peak; rest ends when HR reaches the threshold (≥ 20 s)
 *           or the rest target is met. Between superset partners: 30 s transition, no HR rule.
 *  - alert: wrist vibration, waiting for the tap that starts the next set
 *  - done:  every queued set logged
 */
export type WatchMode = 'idle' | 'set' | 'rest' | 'alert' | 'done';

export interface SetInput { load: number; reps: number; rpe: number }

export interface LiveState {
  sessionId?: string;
  qi: number;
  mode: WatchMode;
  cur: SetInput;
  hr: number;
  /** Session clock (s since start) */
  clock: number;
  setStart: number;
  restT: number;
  peak: number;
  restTarget: number;
  hrRule: boolean;
  alertReason: string;
  alertCount: number;
}

type Action =
  | { type: 'init'; session?: Session; resumeClock: number }
  | { type: 'tick'; thr: number; noise: number }
  | { type: 'registered'; peak: number; clock: number; restTarget: number; partner: boolean; last: boolean }
  | { type: 'advance'; cur: SetInput }
  | { type: 'adjust'; ex: Exercise; field: 'load' | 'reps'; dir: 1 | -1 }
  | { type: 'rpe'; rpe: number };

const REST_HR = 92;
const HR_DECAY = 42;

export const inputFor = (q: QueueItem | undefined, s: Session | undefined): SetInput => {
  if (!q) return { load: 0, reps: 0, rpe: 8 };
  const prev = s?.sets.filter((l) => l.exerciseId === q.exerciseId).at(-1);
  return prev ? { load: prev.load, reps: prev.reps, rpe: prev.rpe } : { load: q.load, reps: q.reps, rpe: 8 };
};

const IDLE: LiveState = { qi: 0, mode: 'idle', cur: { load: 0, reps: 0, rpe: 8 }, hr: 72, clock: 0, setStart: 0, restT: 0, peak: 0, restTarget: 90, hrRule: true, alertReason: '', alertCount: 0 };

function reducer(s: LiveState, a: Action): LiveState {
  switch (a.type) {
    case 'init': {
      if (!a.session) return { ...IDLE, hr: s.hr, alertCount: s.alertCount };
      const qi = a.session.sets.length;
      const done = qi >= a.session.queue.length;
      return { ...IDLE, sessionId: a.session.id, qi, mode: done ? 'done' : 'set', cur: inputFor(a.session.queue[qi], a.session), hr: Math.max(s.hr, 96), clock: a.resumeClock, setStart: a.resumeClock, alertCount: s.alertCount };
    }
    case 'tick': {
      if (s.mode === 'idle' || s.mode === 'done') return { ...s, hr: s.hr + (74 - s.hr) * 0.05 + a.noise * 0.5 };
      const clock = s.clock + 1;
      if (s.mode === 'set') return { ...s, clock, hr: s.hr + (156 - s.hr) * 0.06 + a.noise };
      const t = s.restT + 1;
      const hr = REST_HR + (s.peak - REST_HR) * Math.exp(-t / HR_DECAY) + a.noise * 0.7;
      const next = { ...s, clock, restT: t, hr };
      if (s.mode === 'rest') {
        if (s.hrRule && t >= 20 && hr <= a.thr) return { ...next, mode: 'alert', alertReason: `FC EN UMBRAL · ${Math.round(hr)} LPM`, alertCount: s.alertCount + 1 };
        if (t >= s.restTarget) return { ...next, mode: 'alert', alertReason: `TIEMPO CUMPLIDO · ${mmss(t)}`, alertCount: s.alertCount + 1 };
      }
      return next;
    }
    case 'registered':
      if (a.last) return { ...s, mode: 'done', clock: a.clock, peak: a.peak, qi: s.qi + 1 };
      return { ...s, mode: 'rest', clock: a.clock, restT: 0, peak: a.peak, hr: a.peak, restTarget: a.partner ? SUPERSET_TRANSITION_SEC : a.restTarget, hrRule: !a.partner };
    case 'advance':
      return { ...s, qi: s.qi + 1, mode: 'set', setStart: s.clock, restT: 0, cur: a.cur };
    case 'adjust': {
      const e = a.ex;
      const cur = { ...s.cur };
      if (a.field === 'load') {
        if (!e.step) return s;
        const max = e.loadMode === 'palanca' ? (e.levers?.length ?? 1) - 1 : Infinity;
        cur.load = Math.min(max, Math.max(0, +(cur.load + a.dir * e.step).toFixed(2)));
      } else cur.reps = Math.max(1, cur.reps + a.dir * (e.unit === 's' ? 5 : 1));
      return { ...s, cur };
    }
    case 'rpe':
      return { ...s, cur: { ...s.cur, rpe: a.rpe } };
  }
}

interface LiveCtx {
  live: LiveState;
  session?: Session;
  current?: QueueItem;
  next?: QueueItem;
  exercise?: Exercise;
  register: () => void;
  advance: () => void;
  adjust: (field: 'load' | 'reps', dir: 1 | -1) => void;
  setRpe: (rpe: number) => void;
  /** "B1 Dominada lastrada · +20 kg × 6" */
  nextText: string;
}

const Ctx = createContext<LiveCtx | null>(null);

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const session = useStore((s) => s.activeSession);
  const exercises = useStore((s) => s.exercises);
  const settings = useStore((s) => s.settings);
  const logSet = useStore((s) => s.logSet);
  const [live, dispatch] = useReducer(reducer, IDLE);
  const liveRef = useRef(live);
  liveRef.current = live;
  const thr = useRef(settings.hrThreshold);
  thr.current = settings.hrThreshold;

  const ex = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);

  // (Re)initialise when the active session changes (start, resume after relaunch, finish).
  useEffect(() => {
    const last = session?.sets.at(-1);
    const resumeClock = session && last ? Math.round((last.endedAt - session.startedAt) / 1000) : 0;
    dispatch({ type: 'init', session, resumeClock });
    // Only on session identity changes; set logging is handled by `register`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Sets can also arrive from the real watch (relay sync): resync when the count no longer matches.
  useEffect(() => {
    const s = liveRef.current;
    if (!session || s.sessionId !== session.id) return;
    const expected = s.mode === 'rest' || s.mode === 'alert' ? s.qi + 1 : s.qi;
    if (session.sets.length !== expected) {
      const last = session.sets.at(-1);
      dispatch({ type: 'init', session, resumeClock: last ? Math.round((last.endedAt - session.startedAt) / 1000) : 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sets.length]);

  useEffect(() => {
    const speed = Number(settings.simSpeed) || 3;
    const id = setInterval(() => dispatch({ type: 'tick', thr: thr.current, noise: (Math.random() - 0.5) * 2 }), 1000 / speed);
    return () => clearInterval(id);
  }, [settings.simSpeed]);

  const current = session?.queue[live.qi];
  const next = session?.queue[live.qi + 1];

  const register = useCallback(() => {
    const s = liveRef.current;
    const sess = useStore.getState().activeSession;
    const q = sess?.queue[s.qi];
    if (!sess || !q || s.mode !== 'set') return;
    const peak = Math.max(s.hr, 140 + Math.random() * 16);
    const hrr60 = Math.round(peak - (REST_HR + (peak - REST_HR) * Math.exp(-60 / HR_DECAY)));
    const e = ex[q.exerciseId];
    // Guarantee a plausible minimum set duration when tapping quickly in the simulator.
    const minWork = e?.unit === 'min' ? s.cur.reps * 60 : e?.unit === 's' ? s.cur.reps : 15;
    const end = Math.max(s.clock, s.setStart + minWork);
    const log: SetLog = {
      id: uid(), qi: s.qi, exerciseId: q.exerciseId, block: q.block, load: s.cur.load, reps: s.cur.reps, rpe: s.cur.rpe,
      startedAt: sess.startedAt + s.setStart * 1000, endedAt: sess.startedAt + end * 1000, hrPeak: Math.round(peak), hrr60,
    };
    logSet(log);
    const nq = sess.queue[s.qi + 1];
    dispatch({ type: 'registered', peak, clock: end, restTarget: useStore.getState().settings.restSec, partner: !!nq && nq.block === q.block && nq.set === q.set, last: !nq });
  }, [ex, logSet]);

  const advance = useCallback(() => {
    const s = liveRef.current;
    const sess = useStore.getState().activeSession;
    if (!sess || (s.mode !== 'rest' && s.mode !== 'alert')) return;
    dispatch({ type: 'advance', cur: inputFor(sess.queue[s.qi + 1], sess) });
  }, []);

  const exercise = current ? ex[current.exerciseId] : undefined;
  const value = useMemo<LiveCtx>(() => {
    let nextText = 'Fin de sesión';
    // During a set and during the following rest, `qi` points at the current set; show the one after.
    const target = next;
    if (target && ex[target.exerciseId]) {
      const e = ex[target.exerciseId];
      const c = inputFor(target, session);
      nextText = `${target.block}${target.pos} ${e.name} · ${loadText(e, c.load)}${e.loadMode === 'peso' || e.loadMode === 'lastre' ? ' kg' : ''} × ${c.reps}${unitSuffix(e.unit)}`;
    }
    return {
      live, session, current, next, exercise, register, advance, nextText,
      adjust: (field, dir) => exercise && dispatch({ type: 'adjust', ex: exercise, field, dir }),
      setRpe: (rpe) => dispatch({ type: 'rpe', rpe }),
    };
  }, [live, session, current, next, exercise, ex, register, advance]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive must be used inside LiveSessionProvider');
  return v;
}
