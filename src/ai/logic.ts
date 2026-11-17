import { MUSCLE_KEYS, type MuscleKey } from '../domain/muscles';
import type { Discipline, Exercise, ExerciseTechnique, LoadMode, Pattern, Plane, Unit } from '../domain/types';
import type { ExerciseDraftRaw, Macros100 } from './api';
import { MUSCLE_INFO } from '../domain/muscles';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Macros for `grams` of a product given its per-100 g values. */
export function macrosFor(per100: Macros100, grams: number) {
  const k = Math.max(0, grams) / 100;
  return { kcal: Math.round(per100.kcal * k), p: r1(per100.p * k), c: r1(per100.c * k), f: r1(per100.f * k) };
}

const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T => (opts.includes(v as T) ? (v as T) : fallback);
const muscles = (xs: unknown): MuscleKey[] => (Array.isArray(xs) ? [...new Set(xs.filter((x): x is MuscleKey => MUSCLE_KEYS.includes(x as MuscleKey)))] : []);
const pos = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback);

/**
 * Turns the AI draft into exercise fields the app accepts: unknown enum values fall back to
 * safe defaults, muscles are filtered to known keys, region follows the main muscle.
 */
export function exerciseFromDraft(d: ExerciseDraftRaw): Omit<Exercise, 'id'> {
  const loadMode = oneOf<LoadMode>(d.loadMode, ['peso', 'lastre', 'corporal', 'palanca', 'tiempo'], 'peso');
  const pattern = oneOf<Pattern>(d.pattern, ['empuje', 'traccion', 'pierna', 'bisagra', 'core', 'aislamiento', 'aerobico'], 'aislamiento');
  const discipline = oneOf<Discipline>(d.discipline, ['Pesas', 'Calistenia', 'Core', 'Cardio'], 'Pesas');
  const unit = oneOf<Unit>(d.unit, ['reps', 's', 'min'], 'reps');
  const primary = muscles(d.primary).slice(0, 2);
  const secondary = muscles(d.secondary).filter((m) => !primary.includes(m));
  const levers = loadMode === 'palanca' && Array.isArray(d.levers) && d.levers.length >= 2 ? d.levers.map(String).slice(0, 8) : undefined;
  const lo = Math.max(1, Math.round(pos(d.repMin, 8)));
  const hi = Math.max(lo, Math.round(pos(d.repMax, 12)));
  const region = primary[0] ? MUSCLE_INFO[primary[0]].region : pattern === 'aerobico' ? 'inferior' : 'superior';
  const plane: Plane | undefined = (pattern === 'empuje' || pattern === 'traccion') && (d.plane === 'horizontal' || d.plane === 'vertical') ? d.plane : undefined;
  return {
    name: String(d.name ?? '').trim().slice(0, 60) || 'Ejercicio nuevo',
    discipline,
    loadMode,
    pattern,
    plane,
    region,
    unit,
    primary,
    secondary,
    step: loadMode === 'palanca' ? 1 : pos(d.step, 0),
    defaultLoad: loadMode === 'palanca' ? 0 : pos(d.defaultLoad, 0),
    defaultReps: Math.min(hi, Math.max(lo, Math.round(pos(d.defaultReps, lo)))),
    repRange: [lo, hi],
    levers,
    legImpact: discipline === 'Cardio' ? oneOf(d.legImpact, ['bajo', 'alto'] as const, 'bajo') : undefined,
    technique: techniqueFromDraft(d.technique),
    custom: true,
  };
}

const lines = (xs: unknown, max: number) =>
  (Array.isArray(xs) ? xs : []).map((x) => String(x ?? '').trim().slice(0, 220)).filter(Boolean).slice(0, max);

/** Technique cues from the AI: trimmed lists, known muscles only; undefined when there is nothing usable. */
export function techniqueFromDraft(t: ExerciseDraftRaw['technique']): ExerciseTechnique | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const out: ExerciseTechnique = {
    setup: lines(t.setup, 3),
    steps: lines(t.steps, 5),
    mistakes: lines(t.mistakes, 4),
    feel: muscles(t.feel),
    tip: typeof t.tip === 'string' && t.tip.trim() ? t.tip.trim().slice(0, 220) : undefined,
  };
  return out.steps.length ? out : undefined;
}

/**
 * Photos for the physique review: the latest set (front, side, back of the newest date) and,
 * when there is an earlier one, the oldest front photo to compare against.
 */
export function physiquePhotos<P extends { date: string; view: 'frente' | 'perfil' | 'espalda' }>(photos: P[]): { date?: string; latest: P[]; older?: P } {
  if (!photos.length) return { latest: [] };
  const date = photos.reduce((m, p) => (p.date > m ? p.date : m), photos[0].date);
  const order = { frente: 0, perfil: 1, espalda: 2 } as const;
  const latest = photos.filter((p) => p.date === date).sort((a, b) => order[a.view] - order[b.view]);
  const older = photos.filter((p) => p.view === 'frente' && p.date < date).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return { date, latest, older };
}
