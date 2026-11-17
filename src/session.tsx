import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { uid } from './domain/dates';
import type { Exercise, QueueItem, Session, SetLog } from './domain/types';
import { SUPERSET_TRANSITION_SEC } from './engines/generator';
import { EXTEND_SEC, firstPending, hrRuleFrom, nextPendingAfter, pendingOfBlock, skippedSet } from './engines/liveSession';
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
 *  - rest:  HR decays from the set peak; rest ends when HR reaches the threshold (after
 *           max(60 s, 60 % of the rest)) or the rest target is met. Between superset partners:
 *           30 s transition, no HR rule. "+30 s" extends it.
 *  - alert: "LISTO": wrist vibration, waiting for the tap that starts the next set (waiting counts as rest)
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
  | { type: 'advance'; qi: number; cur: SetInput }
  | { type: 'extend' }
  | { type: 'setLoad'; ex: Exercise; value: number }
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
      const qi = firstPending(a.session.queue, a.session.sets);
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
        if (s.hrRule && t >= hrRuleFrom(s.restTarget) && hr <= a.thr) return { ...next, mode: 'alert', alertReason: `FC EN UMBRAL · ${Math.round(hr)} LPM`, alertCount: s.alertCount + 1 };
        if (t >= s.restTarget) return { ...next, mode: 'alert', alertReason: `TIEMPO CUMPLIDO · ${mmss(t)}`, alertCount: s.alertCount + 1 };
      }
      return next;
    }
    case 'registered':
      if (a.last) return { ...s, mode: 'done', clock: a.clock, peak: a.peak, qi: s.qi + 1 };
      return { ...s, mode: 'rest', clock: a.clock, restT: 0, peak: a.peak, hr: a.peak, restTarget: a.partner ? SUPERSET_TRANSITION_SEC : a.restTarget, hrRule: !a.partner };
    case 'advance':
      return { ...s, qi: a.qi, mode: 'set', setStart: s.clock, restT: 0, cur: a.cur };
    case 'extend':
      if (s.mode === 'rest') return { ...s, restTarget: s.restTarget + EXTEND_SEC, hrRule: false };
      if (s.mode === 'alert') return { ...s, mode: 'rest', restTarget: s.restT + EXTEND_SEC, hrRule: false };
      return s;
    case 'setLoad': {
      const e = a.ex;
      if (!e.step || !Number.isFinite(a.value) || a.value < 0) return s;
      const max = e.loadMode === 'palanca' ? (e.levers?.length ?? 1) - 1 : Infinity;
      return { ...s, cur: { ...s.cur, load: Math.min(max, Math.round(a.value * 100) / 100) } };
    }
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
  /** +30 s of rest (or back to resting once LISTO). */
  extend: () => void;
  /** Exact load typed by hand (66 instead of the 65 the step allows). */
  setLoad: (value: number) => void;
  /** Skip the current set, every pending set of its exercise, or the rest of its superset (block). */
  skip: (what: 'set' | 'exercise' | 'block') => void;
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
    const fp = firstPending(session.queue, session.sets);
    const logged = new Set(session.sets.map((l) => l.qi));
    const resting = s.mode === 'rest' || s.mode === 'alert';
    // Out of step when the current set was logged elsewhere (watch) or, while resting, the set just done is missing.
    const stale = s.mode === 'set' ? logged.has(s.qi) : resting ? !logged.has(s.qi) : s.mode === 'done' && fp < session.queue.length;
    if (stale) {
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
  const nextQi = session ? nextPendingAfter(session.queue, session.sets, live.qi) : 0;
  const next = session && nextQi !== live.qi ? session.queue[nextQi] : undefined;

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
    const after = useStore.getState().activeSession!;
    const nqi = nextPendingAfter(after.queue, after.sets, s.qi);
    const nq = after.queue[nqi];
    dispatch({ type: 'registered', peak, clock: end, restTarget: useStore.getState().settings.restSec, partner: !!nq && nqi === s.qi + 1 && nq.block === q.block && nq.set === q.set, last: !nq });
  }, [ex, logSet]);

  const advance = useCallback(() => {
    const s = liveRef.current;
    const sess = useStore.getState().activeSession;
    if (!sess || (s.mode !== 'rest' && s.mode !== 'alert')) return;
    const qi = nextPendingAfter(sess.queue, sess.sets, s.qi);
    if (qi >= sess.queue.length) return;
    dispatch({ type: 'advance', qi, cur: inputFor(sess.queue[qi], sess) });
  }, []);

  const skip = useCallback((what: 'set' | 'exercise' | 'block') => {
    const s = liveRef.current;
    const sess = useStore.getState().activeSession;
    const q = sess?.queue[s.qi];
    if (!sess || !q || s.mode !== 'set') return;
    const logged = new Set(sess.sets.map((l) => l.qi));
    const qis = what === 'set' ? [s.qi] : what === 'block' ? pendingOfBlock(sess.queue, sess.sets, s.qi) : sess.queue.map((x, i) => (x.exerciseId === q.exerciseId && !logged.has(i) ? i : -1)).filter((i) => i >= 0);
    const at = sess.startedAt + s.clock * 1000;
    for (const qi of qis) logSet(skippedSet(sess.id, qi, sess.queue[qi], at));
    const after = useStore.getState().activeSession!;
    const qi = nextPendingAfter(after.queue, after.sets, s.qi);
    if (qi >= after.queue.length) dispatch({ type: 'init', session: after, resumeClock: s.clock });
    else dispatch({ type: 'advance', qi, cur: inputFor(after.queue[qi], after) });
  }, [logSet]);

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
      live, session, current, next, exercise, register, advance, nextText, skip,
      extend: () => dispatch({ type: 'extend' }),
      setLoad: (v) => exercise && dispatch({ type: 'setLoad', ex: exercise, value: v }),
      adjust: (field, dir) => exercise && dispatch({ type: 'adjust', ex: exercise, field, dir }),
      setRpe: (rpe) => dispatch({ type: 'rpe', rpe }),
    };
  }, [live, session, current, next, exercise, ex, register, advance, skip]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive must be used inside LiveSessionProvider');
  return v;
}
