import { PATTERN_LABEL } from './catalog';
import { muscleName } from './muscles';
import type { Exercise } from './types';

/** Lower-case, accent-free text for forgiving search ("jalon" finds "Jalón"). */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Every word of the query must appear in the exercise name, discipline, movement or muscles. */
export function matchesExercise(e: Exercise, q: string) {
  if (!q.trim()) return true;
  const hay = norm([e.name, e.discipline, PATTERN_LABEL[e.pattern], ...e.primary.map(muscleName), ...e.secondary.map(muscleName)].join(' '));
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
