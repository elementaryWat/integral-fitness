import { groupOf, MUSCLE_GROUPS, type MuscleGroup } from '../domain/catalog';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import type { BlockKey, Exercise, PlannedBlock, Session } from '../domain/types';
import { deficit, finalize, type Draft, type GeneratorInput } from './generator';
import { lastPerformance, suggestNext } from './progression';
import type { ExMap, MuscleState } from './volume';

export type GroupReadiness = 'listo' | 'pendiente' | 'cubierto' | 'fatiga';

export interface GroupStatus {
  group: MuscleGroup;
  sets: number;
  target: number;
  /** Lowest recovery among the group's muscles (%) */
  rec: number;
  readiness: GroupReadiness;
}

const musclesOf = (g: MuscleGroup) => MUSCLE_GROUPS.find((x) => x.key === g)!.muscles as readonly MuscleKey[];

/** How ready a group is today: recovered and below its weekly target ⇒ recommended. */
export function groupStatus(states: Record<MuscleKey, MuscleState>, g: MuscleGroup): GroupStatus {
  const ms = musclesOf(g);
  if (!ms.length) return { group: g, sets: 0, target: 0, rec: 100, readiness: 'listo' };
  const sets = ms.reduce((t, m) => t + states[m].sets, 0);
  const target = ms.reduce((t, m) => t + states[m].target, 0);
  const rec = Math.min(...ms.map((m) => states[m].rec));
  const fatigued = rec < 60 || ms.some((m) => states[m].status === 'f' && states[m].sets > MUSCLE_INFO[m].mav);
  const readiness: GroupReadiness = fatigued ? 'fatiga' : sets >= target ? 'cubierto' : rec >= 85 && sets < target * 0.75 ? 'listo' : 'pendiente';
  return { group: g, sets: Math.round(sets), target, rec: Math.round(rec), readiness };
}

/** Groups worth training today, most behind first (cardio excluded). */
export function recommendedGroups(states: Record<MuscleKey, MuscleState>, max = 3): MuscleGroup[] {
  return MUSCLE_GROUPS.filter((g) => g.key !== 'cardio')
    .map((g) => groupStatus(states, g.key))
    .filter((s) => s.readiness === 'listo')
    .sort((a, b) => b.target - b.sets - (a.target - a.sets))
    .slice(0, max)
    .map((s) => s.group);
}

/** Groups that pair well with each one: antagonists first, then synergists. */
const RELATED: Record<MuscleGroup, [MuscleGroup, string][]> = {
  pecho: [['espalda', 'antagonista: superseries empuje + tracción'], ['triceps', 'el tríceps ya llega caliente del press'], ['hombros', 'mismo patrón de empuje']],
  espalda: [['pecho', 'antagonista: superseries tracción + empuje'], ['biceps', 'el bíceps ya llega caliente del remo'], ['hombros', 'deltoides posterior y trapecio']],
  hombros: [['espalda', 'equilibra empuje vertical con tracción'], ['pecho', 'día de empuje completo'], ['triceps', 'trabajan juntos en todo press']],
  biceps: [['triceps', 'antagonista: superseries curl + extensión'], ['espalda', 'bíceps tras el remo'], ['hombros', 'accesorios en superserie']],
  triceps: [['biceps', 'antagonista: superseries extensión + curl'], ['pecho', 'tríceps tras el press'], ['hombros', 'día de empuje']],
  piernas: [['core', 'estabilidad entre series pesadas'], ['espalda', 'cuerpo completo sin repetir cadena posterior'], ['cardio', 'Z2 suave al final']],
  core: [['piernas', 'superseries sin competir por músculo'], ['espalda', 'anti-extensión + tracción'], ['pecho', 'plancha entre series de press']],
  cardio: [['piernas', 'pierna primero, Z2 después'], ['core', 'circuito ligero'], ['espalda', 'torso + aeróbico']],
};

export interface RelatedGroup { group: MuscleGroup; reason: string; readiness: GroupReadiness }

/** Suggestions to complete the selection, skipping fatigued groups and those already chosen. */
export function relatedGroups(selected: MuscleGroup[], states: Record<MuscleKey, MuscleState>, max = 3): RelatedGroup[] {
  const seen = new Set<MuscleGroup>(selected);
  const out: RelatedGroup[] = [];
  for (const g of selected) {
    for (const [r, reason] of RELATED[g]) {
      if (seen.has(r)) continue;
      const st = groupStatus(states, r);
      if (st.readiness === 'fatiga') continue;
      seen.add(r);
      out.push({ group: r, reason, readiness: st.readiness });
    }
  }
  const rank = { listo: 0, pendiente: 1, cubierto: 2, fatiga: 3 };
  return out.sort((a, b) => rank[a.readiness] - rank[b.readiness]).slice(0, max);
}

const ANTAGONIST_MUSCLES: [MuscleKey, MuscleKey][] = [['pecho', 'dors'], ['bic', 'tri'], ['delt', 'deltp'], ['quad', 'isq'], ['abs', 'lumb']];
const isAntagonist = (a: Exercise, b: Exercise) =>
  (a.pattern === 'empuje' && b.pattern === 'traccion') || (a.pattern === 'traccion' && b.pattern === 'empuje') ||
  (a.pattern === 'pierna' && b.pattern === 'bisagra') || (a.pattern === 'bisagra' && b.pattern === 'pierna') ||
  ANTAGONIST_MUSCLES.some(([x, y]) => (a.primary[0] === x && b.primary[0] === y) || (a.primary[0] === y && b.primary[0] === x));
const overlaps = (a: Exercise, b: Exercise) => a.primary.some((m) => b.primary.includes(m));

const KEYS: BlockKey[] = ['A', 'B', 'C', 'D', 'E'];
const MAJOR: MuscleKey[] = ['pecho', 'dors', 'delt', 'deltp', 'bic', 'tri', 'quad', 'glut', 'isq', 'abs'];
const SHORT: Record<MuscleKey, string> = {
  pecho: 'Pecho', dors: 'Dorsal', trap: 'Trapecio', lumb: 'Lumbar', delt: 'Hombro', deltp: 'Hombro post.', bic: 'Bíceps', tri: 'Tríceps',
  ante: 'Antebrazo', quad: 'Cuádriceps', isq: 'Femoral', glut: 'Glúteo', gem: 'Gemelo', abs: 'Abdomen', obl: 'Oblicuos',
};
const MAX_EXERCISES = 10;

/**
 * Session for the muscle groups the user picked: the most under-trained muscles of those groups
 * get an exercise first (compounds preferred), then a second one; exercises are paired into
 * antagonist supersets when possible and the whole thing is fitted to the available time.
 */
export function generateFocused(input: GeneratorInput & { groups: MuscleGroup[] }): PlannedBlock[] {
  const { states, groups } = input;
  const muscles = groups.flatMap((g) => [...musclesOf(g)]);
  const cands = input.exercises.filter((e) => !e.archived && (!e.advanced || input.experience === 'avanzado') && e.primary[0] && muscles.includes(e.primary[0]));
  const behind = (m: MuscleKey) => states[m].target - states[m].sets - (states[m].status === 'f' ? 20 : 0);
  const order = [...muscles].sort((a, b) => behind(b) - behind(a));
  const score = (e: Exercise) => deficit(states, e) + 2 * e.primary.length;

  // Big muscles first (two exercises each), small ones (trapezius, calves, forearms…) after.
  const major = order.filter((m) => MAJOR.includes(m));
  const minor = order.filter((m) => !MAJOR.includes(m));
  const chosen: Exercise[] = [];
  const pass = (ms: MuscleKey[]) => {
    for (const m of ms) {
      if (chosen.length >= MAX_EXERCISES) return;
      const pool = cands.filter((e) => e.primary[0] === m && !chosen.includes(e));
      if (pool.length) chosen.push(pool.reduce((best, e) => (score(e) > score(best) ? e : best), pool[0]));
    }
  };
  pass(major.length ? major : minor);
  pass(major);
  pass(minor);

  // Pair into antagonist supersets; fall back to any non-overlapping partner, else a straight set.
  const left = [...chosen];
  const drafts: Draft[] = [];
  while (left.length && drafts.length < KEYS.length) {
    const a = left.shift()!;
    let j = left.findIndex((b) => isAntagonist(a, b));
    if (j < 0) j = left.findIndex((b) => !overlaps(a, b));
    const b = j >= 0 ? left.splice(j, 1)[0] : undefined;
    const exs = b ? [a, b] : [a];
    const priority = exs.reduce((t, e) => t + deficit(states, e), 0);
    const title = [...new Set(exs.map((e) => SHORT[e.primary[0]]))].join(' + ');
    drafts.push({ slot: { key: KEYS[drafts.length], title }, exs, rounds: input.deload || priority < 0 ? 2 : 3, priority });
  }
  const cardioOnly = groups.length === 1 && groups[0] === 'cardio';
  return finalize(drafts, input, { cardio: groups.includes('cardio'), maxCardioMin: cardioOnly ? 60 : 20 });
}

/** Related exercises to swap in: same main muscle and pattern first, then same muscle, then same group. */
export function alternativesFor(e: Exercise, exercises: Exercise[], exclude: Set<string>, max = 5): Exercise[] {
  const pool = exercises.filter((x) => !x.archived && x.id !== e.id && !exclude.has(x.id));
  const tier = (x: Exercise) =>
    x.primary[0] === e.primary[0] && x.pattern === e.pattern ? 0 : x.primary[0] === e.primary[0] ? 1 : groupOf(x) === groupOf(e) && x.pattern === e.pattern ? 2 : groupOf(x) === groupOf(e) ? 3 : 9;
  return pool.filter((x) => tier(x) < 9).sort((a, b) => tier(a) - tier(b) || a.name.localeCompare(b.name, 'es')).slice(0, max);
}

/** Applies the user's exercise swaps to a generated plan, re-prescribing load/reps for the new one. */
export function applySwaps(blocks: PlannedBlock[], swaps: Record<string, string>, ex: ExMap, history: Session[], deload: boolean): PlannedBlock[] {
  const inPlan = new Set(blocks.flatMap((b) => b.items.map((i) => i.exerciseId)));
  return blocks.map((b) => ({
    ...b,
    items: b.items.map((it) => {
      const to = swaps[it.exerciseId];
      const e = to ? ex[to] : undefined;
      if (!e || e.archived || inPlan.has(to)) return it;
      return { exerciseId: e.id, sets: it.sets, ...(b.kind === 'cardio' ? { load: 0, reps: it.reps } : suggestNext(e, lastPerformance(history, e.id), deload)) };
    }),
  }));
}
