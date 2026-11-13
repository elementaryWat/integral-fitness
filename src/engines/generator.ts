import type { MuscleKey, Region } from '../domain/muscles';
import type { Experience } from '../domain/types';
import type { BlockKey, Exercise, Pattern, Plane, PlannedBlock, QueueItem, Session } from '../domain/types';
import { LOWER_TARGET } from './balance';
import { lastPerformance, suggestNext } from './progression';
import type { ExMap, MuscleState } from './volume';

export type Minutes = 35 | 45 | 60;
export const SESSION_MINUTES: Minutes[] = [35, 45, 60];

export const WARMUP_SEC = 240;
export const SUPERSET_TRANSITION_SEC = 30;
const MIN_CARDIO_MIN = 10;
const MAX_CARDIO_MIN = 15;

interface SlotSpec { pattern: Pattern; plane?: Plane; region?: Region; muscles?: MuscleKey[] }
interface Slot { key: BlockKey; title: string; a: SlotSpec; b?: SlotSpec }

const ARMS_SHOULDERS: MuscleKey[] = ['delt', 'deltp', 'bic', 'tri', 'ante', 'trap'];

const SLOTS: Record<BlockKey, Slot> = {
  A: { key: 'A', title: 'Empuje / tracción horiz.', a: { pattern: 'empuje', plane: 'horizontal' }, b: { pattern: 'traccion', plane: 'horizontal' } },
  B: { key: 'B', title: 'Tracción / empuje vert.', a: { pattern: 'traccion', plane: 'vertical' }, b: { pattern: 'empuje', plane: 'vertical' } },
  C: { key: 'C', title: 'Pierna unilateral + core', a: { pattern: 'pierna' }, b: { pattern: 'core' } },
  D: { key: 'D', title: 'Accesorios hombro / brazo', a: { pattern: 'aislamiento', muscles: ARMS_SHOULDERS }, b: { pattern: 'aislamiento', muscles: ARMS_SHOULDERS } },
  E: { key: 'E', title: 'Bisagra + anti-rotación', a: { pattern: 'bisagra' }, b: { pattern: 'core' } },
  F: { key: 'F', title: 'Aeróbico Z2', a: { pattern: 'aerobico' } },
};

const ORDER: Record<Minutes, BlockKey[]> = {
  35: ['A', 'B', 'C'],
  45: ['A', 'B', 'C', 'D'],
  60: ['A', 'B', 'C', 'D', 'E', 'F'],
};

export interface GeneratorInput {
  minutes: Minutes;
  exercises: Exercise[];
  states: Record<MuscleKey, MuscleState>;
  /** Lower-body share of this week's logged sets so far (null when nothing logged yet) */
  weeklyLowerShare: number | null;
  history: Session[];
  restSec: number;
  deload: boolean;
  /** Advanced exercises are only auto-selected for advanced lifters. */
  experience?: Experience;
}

/** Estimated working time of one set (s). */
export function setSeconds(e: Exercise, reps: number) {
  if (e.unit === 's') return reps;
  if (e.unit === 'min') return reps * 60;
  return Math.max(20, reps * 3);
}

export function deficit(states: Record<MuscleKey, MuscleState>, e: Exercise) {
  let d = 0;
  for (const m of e.primary) d += states[m].target - states[m].sets - (states[m].status === 'f' ? 10 : 0);
  for (const m of e.secondary) d += 0.5 * (states[m].target - states[m].sets);
  return d;
}

export function pick(cands: Exercise[], spec: SlotSpec, used: Set<string>, states: Record<MuscleKey, MuscleState>, avoid: Set<MuscleKey> = new Set()) {
  const pool = cands.filter((e) => e.pattern === spec.pattern && (!spec.plane || e.plane === spec.plane) && (!spec.region || e.region === spec.region) && (!spec.muscles || spec.muscles.includes(e.primary[0])) && !used.has(e.id));
  if (!pool.length) return undefined;
  const score = (e: Exercise) => deficit(states, e) - (e.primary.some((m) => avoid.has(m)) ? 50 : 0);
  return pool.reduce((best, e) => (score(e) > score(best) ? e : best), pool[0]);
}

const roundSec = (d: Draft, restSec: number) =>
  d.exs.reduce((t, e) => t + setSeconds(e, e.defaultReps), 0) + (d.exs.length - 1) * SUPERSET_TRANSITION_SEC + restSec;

/**
 * Builds today's session for the available time: antagonist supersets that prioritise
 * under-trained muscles, an essential ≥20% of lower-body work across the week, and
 * low-impact Z2 cardio only when it fits and the legs are not fatigued.
 */
export function generateSession(input: GeneratorInput): PlannedBlock[] {
  const { minutes, states, deload } = input;
  const cands = input.exercises.filter((e) => !e.archived && (!e.advanced || input.experience === 'avanzado'));
  const used = new Set<string>();
  const drafts: Draft[] = [];
  const legsFatigued = (['quad', 'isq', 'glut'] as MuscleKey[]).some((m) => states[m].status === 'f' && states[m].rec < 60);

  // When the week already has more than its share of legs, drop the extra hinge block.
  const legsAhead = input.weeklyLowerShare !== null && input.weeklyLowerShare > 0.25;
  for (const key of ORDER[minutes]) {
    if (key === 'F' || (key === 'E' && legsAhead)) continue;
    const slot = SLOTS[key];
    const a = pick(cands, slot.a, used, states);
    if (!a) continue;
    used.add(a.id);
    const b = slot.b ? pick(cands, slot.b, used, states, new Set(a.primary)) : undefined;
    if (b) used.add(b.id);
    const exs = b ? [a, b] : [a];
    const priority = exs.reduce((t, e) => t + deficit(states, e), 0);
    // Weekly volume control: blocks whose muscles are already over target start with fewer rounds.
    drafts.push({ slot, exs, rounds: deload || priority < 0 ? 2 : 3, priority });
  }

  // Lower-body guarantee: when the week is behind on legs, pair the leg block with a hinge instead of core.
  const required = input.weeklyLowerShare !== null && input.weeklyLowerShare >= LOWER_TARGET ? 0.12 : LOWER_TARGET;
  const share = () => {
    const tot = drafts.reduce((t, d) => t + d.rounds * d.exs.length, 0);
    const low = drafts.reduce((t, d) => t + d.rounds * d.exs.filter((e) => e.region === 'inferior').length, 0);
    return tot ? low / tot : 0;
  };
  const c = drafts.find((d) => d.slot.key === 'C');
  if (c && c.exs[1]?.region !== 'inferior' && share() < required && !drafts.some((d) => d.slot.key === 'E')) {
    const hinge = pick(cands, { pattern: 'bisagra' }, used, states);
    if (hinge) {
      if (c.exs[1]) used.delete(c.exs[1].id);
      used.add(hinge.id);
      c.exs = [c.exs[0], hinge];
      c.slot = { ...c.slot, title: 'Pierna + bisagra' };
    }
  }

  return finalize(drafts, input, { cardio: ORDER[minutes].includes('F') && !legsFatigued });
}

export interface Draft { slot: { key: BlockKey; title: string }; exs: Exercise[]; rounds: number; priority: number }

/**
 * Shared last step of every generator: trims blocks to the time budget, adds Z2 cardio when
 * asked and it fits, fills the remaining time and prescribes load/reps from history.
 */
export function finalize(drafts: Draft[], input: Pick<GeneratorInput, 'minutes' | 'exercises' | 'states' | 'history' | 'restSec' | 'deload'>, opts: { cardio: boolean; maxCardioMin?: number }): PlannedBlock[] {
  const { minutes, states, history, restSec, deload } = input;
  let budget = minutes * 60 - WARMUP_SEC;
  const cost = () => drafts.reduce((t, d) => t + d.rounds * roundSec(d, restSec), 0);
  while (cost() > budget && drafts.length) {
    const last = drafts[drafts.length - 1];
    if (last.rounds > 2) last.rounds--;
    else drafts.pop();
  }
  budget -= cost();

  let cardio: PlannedBlock | undefined;
  if (opts.cardio && budget >= MIN_CARDIO_MIN * 60) {
    const run = pick(input.exercises.filter((e) => !e.archived && !e.advanced), SLOTS.F.a, new Set(), states);
    if (run) {
      const mins = Math.min(opts.maxCardioMin ?? MAX_CARDIO_MIN, Math.floor(budget / 60));
      budget -= mins * 60;
      cardio = { key: 'F', title: SLOTS.F.title, kind: 'cardio', restSec: 0, items: [{ exerciseId: run.id, sets: 1, load: 0, reps: mins }] };
    }
  }

  // Fill the remaining time without dead time: first blocks with a volume deficit, then any block
  // whose main muscles are not fatigued (over MAV or still recovering).
  const maxRounds = deload ? 3 : 4;
  const notFatigued = (d: Draft) => d.exs.every((e) => e.primary.every((m) => states[m].status !== 'f'));
  for (const eligible of [(d: Draft) => d.priority > 0, notFatigued]) {
    for (;;) {
      const options = drafts.filter((d) => eligible(d) && d.rounds < maxRounds && roundSec(d, restSec) <= budget).sort((x, y) => y.priority - x.priority);
      if (!options.length) break;
      options[0].rounds++;
      budget -= roundSec(options[0], restSec);
    }
  }

  const blocks: PlannedBlock[] = drafts.map((d) => ({
    key: d.slot.key,
    title: d.slot.title,
    kind: 'superserie',
    restSec,
    items: d.exs.map((e) => ({ exerciseId: e.id, sets: d.rounds, ...suggestNext(e, lastPerformance(history, e.id), deload) })),
  }));
  if (cardio) blocks.push(cardio);
  return blocks;
}

/** Set-by-set order: A1 A2 A1 A2 … B1 B2 … */
export function buildQueue(blocks: PlannedBlock[]): QueueItem[] {
  const q: QueueItem[] = [];
  for (const b of blocks) {
    const sets = Math.max(...b.items.map((i) => i.sets));
    for (let set = 1; set <= sets; set++) {
      b.items.forEach((it, i) => {
        if (set <= it.sets) q.push({ block: b.key, pos: i + 1, exerciseId: it.exerciseId, set, sets: it.sets, load: it.load, reps: it.reps });
      });
    }
  }
  return q;
}

/** Estimated session length (min) including warm-up. */
export function estimateMinutes(blocks: PlannedBlock[], ex: ExMap) {
  let sec = WARMUP_SEC;
  for (const b of blocks) {
    const items = b.items.map((i) => ({ e: ex[i.exerciseId], i })).filter((x) => x.e);
    const rounds = Math.max(0, ...b.items.map((i) => i.sets));
    const work = items.reduce((t, x) => t + setSeconds(x.e, x.i.reps), 0);
    sec += b.kind === 'cardio' ? work : rounds * (work + (items.length - 1) * SUPERSET_TRANSITION_SEC + b.restSec);
  }
  return Math.round(sec / 60);
}
