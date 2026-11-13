import { MUSCLE_GROUPS, SEED_EXERCISES } from '../domain/catalog';
import type { Exercise } from '../domain/types';

/** Adds any built-in exercise missing from a stored list (by id), keeping the user's versions. */
export function withSeedExercises(list: Exercise[]): Exercise[] {
  const have = new Set(list.map((e) => e.id));
  return [...list, ...SEED_EXERCISES.filter((e) => !have.has(e.id))];
}

/** Drops muscle groups that no longer exist (e.g. the old combined 'brazos') from saved settings. */
export function sanitizeSettings<S extends { focus?: string[]; swaps?: Record<string, string> }>(s: S): S {
  const known = new Set<string>(MUSCLE_GROUPS.map((g) => g.key));
  const focus = (s.focus ?? []).filter((g) => known.has(g));
  return { ...s, focus, swaps: focus.length === (s.focus ?? []).length ? s.swaps ?? {} : {} };
}
