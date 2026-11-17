import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import type { Exercise, PlannedBlock, QueueItem, Session, SetLog } from '../domain/types';
import { sessionMetrics, type SessionMetrics } from './efficiency';
import { buildQueue } from './generator';
import { e1rm, isLoaded, systemLoad } from './progression';
import type { ExMap } from './volume';

/** Same rule as the watch (watch/shared/logic.js): a recovered pulse ends the rest only after max(60 s, 60 % of it). */
export const MIN_REST_FOR_HR_RULE = 60;
export const HR_RULE_SHARE = 0.6;
export const EXTEND_SEC = 30;
export const hrRuleFrom = (target: number) => Math.min(target, Math.max(MIN_REST_FOR_HR_RULE, Math.round(target * HR_RULE_SHARE)));

/** Sets that count as work (skipped ones only mark their queue slot as done). */
export const workSets = (sets: SetLog[]) => sets.filter((l) => !l.skipped);

/** First queue index not logged (done or skipped) yet; queue.length when the session is complete. */
export function firstPending(queue: QueueItem[], sets: SetLog[]): number {
  const done = new Set(sets.map((l) => l.qi));
  for (let i = 0; i < queue.length; i++) if (!done.has(i)) return i;
  return queue.length;
}

/** Next pending index after `from` (wrapping to earlier gaps); queue.length when none is left. */
export function nextPendingAfter(queue: QueueItem[], sets: SetLog[], from: number): number {
  const done = new Set(sets.map((l) => l.qi));
  for (let i = from + 1; i < queue.length; i++) if (!done.has(i)) return i;
  for (let i = 0; i <= from && i < queue.length; i++) if (!done.has(i)) return i;
  return queue.length;
}

/** "9/24": sets handled (done or skipped) out of the queue, and how many of them were skipped. */
export function sessionProgress(s: Pick<Session, 'queue' | 'sets'>) {
  const handled = new Set(s.sets.map((l) => l.qi)).size;
  return { done: handled, total: s.queue.length, skipped: s.sets.filter((l) => l.skipped).length };
}

/** Queue indexes still to do in the block (superset) of queue[i]: every exercise and round. */
export function pendingOfBlock(queue: QueueItem[], sets: SetLog[], i: number): number[] {
  const done = new Set(sets.map((l) => l.qi));
  const block = queue[i]?.block;
  return queue.map((q, k) => (q.block === block && !done.has(k) ? k : -1)).filter((k) => k >= 0);
}

/** Log for a set skipped on the phone (same shape as the watch's). */
export function skippedSet(sessionId: string, qi: number, q: QueueItem, at: number): SetLog {
  return { id: `${sessionId}-${qi}`, qi, exerciseId: q.exerciseId, block: q.block, load: 0, reps: 0, rpe: 0, startedAt: at, endedAt: at, skipped: true };
}

/**
 * Applies an edit of the blocks to a session already in progress.
 *  - Logged sets keep their data and move to the front of the new queue (renumbered `qi`).
 *  - Logged items are relabelled to the new block letter/position of their exercise when it is still there.
 *  - A new queue slot (block, position, set) that was already logged is not repeated: replacing an
 *    exercise after 2 of 4 sets leaves the 2 remaining sets for the new one.
 *  - The session gets a new id so the watch and the relay reload it from scratch.
 */
export function rebuildSession(a: Session, blocks: PlannedBlock[], newId: string): Session {
  const where = new Map<string, { block: QueueItem['block']; pos: number }>();
  blocks.forEach((b) => b.items.forEach((it, i) => { if (!where.has(it.exerciseId)) where.set(it.exerciseId, { block: b.key, pos: i + 1 }); }));

  const logged = [...a.sets].sort((x, y) => x.qi - y.qi);
  const doneItems = logged.map((l) => {
    const old = a.queue[l.qi] ?? { block: l.block, pos: 1, exerciseId: l.exerciseId, set: 1, sets: 1, load: l.load, reps: l.reps };
    const w = where.get(old.exerciseId);
    return w ? { ...old, block: w.block, pos: w.pos } : old;
  });
  const slot = (q: Pick<QueueItem, 'block' | 'pos' | 'set'>) => `${q.block}${q.pos}#${q.set}`;
  const taken = new Set(doneItems.map(slot));
  const pending = buildQueue(blocks).filter((q) => !taken.has(slot(q)));

  const sets = logged.map((l, i) => ({ ...l, qi: i, block: doneItems[i].block }));
  return { ...a, id: newId, blocks, queue: [...doneItems, ...pending], sets };
}

export interface SessionExercise {
  exerciseId: string;
  /** Block letter and position where it was done, e.g. "A1" */
  slot: string;
  sets: SetLog[];
  /** Effective kg moved in this exercise (0 for unloaded ones) */
  tonnage: number;
  /** Heaviest load used */
  topLoad: number;
  /** First rep of the first set → end of the last set (s) */
  durationSec: number;
  /** Mean time under work per set (s) */
  avgSetSec: number;
  /** Real rest before each set (s), same order as `sets`; undefined for the session's first set */
  restBefore: (number | undefined)[];
}

/** Work sets grouped by exercise in the order they were first done (skipped sets left out). */
export function sessionExercises(s: Pick<Session, 'sets' | 'queue'>, ex: ExMap, bw: number): SessionExercise[] {
  const out = new Map<string, SessionExercise>();
  const sorted = workSets(s.sets).sort((a, b) => a.startedAt - b.startedAt || a.qi - b.qi);
  const rests = realRests(sorted);
  for (const l of sorted) {
    let g = out.get(l.exerciseId);
    if (!g) {
      const q = s.queue[l.qi];
      g = { exerciseId: l.exerciseId, slot: q ? `${q.block}${q.pos}` : l.block, sets: [], tonnage: 0, topLoad: 0, durationSec: 0, avgSetSec: 0, restBefore: [] };
      out.set(l.exerciseId, g);
    }
    g.sets.push(l);
    g.restBefore.push(rests.get(l.id));
    const e = ex[l.exerciseId];
    if (e && isLoaded(e)) g.tonnage += systemLoad(e, l.load, bw) * l.reps;
    g.topLoad = Math.max(g.topLoad, l.load);
  }
  for (const g of out.values()) {
    g.durationSec = secs(g.sets[g.sets.length - 1].endedAt - g.sets[0].startedAt);
    g.avgSetSec = g.sets.reduce((a, l) => a + secs(l.endedAt - l.startedAt), 0) / g.sets.length;
  }
  return [...out.values()];
}

const secs = (ms: number) => Math.max(0, Math.round(ms / 1000));

/** Real rest before each work set (s): from the end of the previous set to the start of this one. */
export function realRests(sets: SetLog[]): Map<string, number> {
  const sorted = workSets(sets).sort((a, b) => a.startedAt - b.startedAt);
  const out = new Map<string, number>();
  sorted.forEach((l, i) => { if (i > 0) out.set(l.id, secs(l.startedAt - sorted[i - 1].endedAt)); });
  return out;
}

export interface RestStats {
  /** Full rests (end of a round / block change) */
  full: { count: number; avg: number; max: number; overTarget: number };
  /** Transitions between superset partners of the same round */
  transition: { count: number; avg: number };
  target: number;
}

/** Real rests split into full rests and superset transitions, compared with the target. */
export function restStats(s: Pick<Session, 'sets' | 'queue'>, targetSec: number): RestStats {
  const sorted = workSets(s.sets).sort((a, b) => a.startedAt - b.startedAt);
  const full: number[] = [], trans: number[] = [];
  sorted.forEach((l, i) => {
    if (!i) return;
    const prev = sorted[i - 1];
    const r = secs(l.startedAt - prev.endedAt);
    const a = s.queue[prev.qi], b = s.queue[l.qi];
    (a && b && a.block === b.block && a.set === b.set ? trans : full).push(r);
  });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
  return {
    full: { count: full.length, avg: avg(full), max: full.length ? Math.max(...full) : 0, overTarget: full.filter((r) => r > targetSec + 30).length },
    transition: { count: trans.length, avg: avg(trans) },
    target: targetSec,
  };
}

export interface BlockTime { block: string; durationSec: number; rounds: number; sets: number }

/** How long each block (superset) took: first set start → last set end. */
export function blockTimes(s: Pick<Session, 'sets' | 'queue'>): BlockTime[] {
  const by = new Map<string, SetLog[]>();
  for (const l of workSets(s.sets)) {
    const k = s.queue[l.qi]?.block ?? l.block;
    by.set(k, [...(by.get(k) ?? []), l]);
  }
  return [...by.entries()]
    .map(([block, ls]) => ({
      block,
      durationSec: secs(Math.max(...ls.map((l) => l.endedAt)) - Math.min(...ls.map((l) => l.startedAt))),
      rounds: new Set(ls.map((l) => s.queue[l.qi]?.set ?? 1)).size,
      sets: ls.length,
      first: Math.min(...ls.map((l) => l.startedAt)),
    }))
    .sort((a, b) => a.first - b.first)
    .map(({ first: _f, ...b }) => b);
}

/**
 * Time left (s) and share of the session still to go. Uses the real pace once ≥ 2 sets are
 * handled, the plan's estimate before that. Same formula as the watch (watch/shared/logic.js).
 */
export function remainingEstimate({ elapsedSec, done, total, plannedSec }: { elapsedSec: number; done: number; total: number; plannedSec: number }) {
  if (!total || done >= total) return { remainingSec: 0, pctLeft: 0 };
  const left = total - done;
  const remainingSec = done >= 2 && elapsedSec > 0 ? (elapsedSec / done) * left : Math.max(0, plannedSec * (left / total));
  const pctLeft = Math.round((remainingSec / Math.max(1, elapsedSec + remainingSec)) * 100);
  return { remainingSec: Math.round(remainingSec), pctLeft };
}

export const FEEL_LABEL = { 1: 'Agotado', 2: 'Cansado', 3: 'Normal', 4: 'Bien', 5: 'Con energía' } as const;
export const FEEL_TAGS = ['Bombeo', 'Fuerte', 'Sin fuerza', 'Molestia', 'Mareo', 'Con hambre'] as const;

export interface SessionRecord { exerciseId: string; name: string; e1rm: number; prev: number; load: number; reps: number }

export interface SessionSummary {
  metrics: SessionMetrics;
  sets: number;
  skipped: number;
  exercises: number;
  hrAvgPeak: number;
  hrMax: number;
  records: SessionRecord[];
  muscles: Partial<Record<MuscleKey, { sets: number; primary: boolean }>>;
}

/** What a finished (or ongoing) session achieved, compared with the sessions before it. */
export function sessionSummary(s: Session, history: Session[], ex: ExMap, bw: number): SessionSummary {
  const sets = workSets(s.sets);
  const metrics = sessionMetrics({ sets }, ex, bw);
  const peaks = sets.map((l) => l.hrPeak ?? 0).filter((v) => v > 0);
  const before = history.filter((h) => h.id !== s.id && h.startedAt < s.startedAt);

  const best = (list: SetLog[], e: Exercise) => {
    let top: { v: number; l?: SetLog } = { v: 0 };
    for (const l of list) {
      const v = e1rm(e, l.load, l.reps, bw) ?? 0;
      if (v > top.v) top = { v, l };
    }
    return top;
  };
  const ids = [...new Set(sets.map((l) => l.exerciseId))];
  const records: SessionRecord[] = [];
  for (const id of ids) {
    const e = ex[id];
    if (!e) continue;
    const now = best(sets.filter((l) => l.exerciseId === id), e);
    const prev = best(before.flatMap((h) => h.sets.filter((l) => l.exerciseId === id && !l.skipped)), e);
    if (now.l && now.v > 0 && prev.v > 0 && now.v > prev.v + 0.05) records.push({ exerciseId: id, name: e.name, e1rm: now.v, prev: prev.v, load: now.l.load, reps: now.l.reps });
  }

  const muscles: SessionSummary['muscles'] = {};
  for (const l of sets) {
    const e = ex[l.exerciseId];
    if (!e) continue;
    for (const m of e.primary) muscles[m] = { sets: (muscles[m]?.sets ?? 0) + 1, primary: true };
    for (const m of e.secondary) if (MUSCLE_INFO[m]) muscles[m] = { sets: (muscles[m]?.sets ?? 0) + 0.5, primary: muscles[m]?.primary ?? false };
  }

  return {
    metrics,
    sets: sets.length,
    skipped: s.sets.length - sets.length,
    exercises: ids.length,
    hrAvgPeak: peaks.length ? Math.round(peaks.reduce((a, b) => a + b, 0) / peaks.length) : 0,
    hrMax: peaks.length ? Math.max(...peaks) : 0,
    records: records.sort((a, b) => b.e1rm / b.prev - a.e1rm / a.prev),
    muscles,
  };
}

/** Clock of a session in progress (s), from its start to now. */
export const sessionElapsed = (s: Pick<Session, 'startedAt'>, now: number) => Math.max(0, Math.round((now - s.startedAt) / 1000));
