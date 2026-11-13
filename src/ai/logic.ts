import { MUSCLE_KEYS, type MuscleKey } from '../domain/muscles';
import type { Discipline, Exercise, LoadMode, Pattern, Plane, Unit } from '../domain/types';
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
    custom: true,
  };
}
