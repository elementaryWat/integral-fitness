import { MUSCLES_BACK, MUSCLES_FRONT } from '../bodyPolygons';
import { addDays } from '../domain/dates';
import { MUSCLE_KEYS, type MuscleKey } from '../domain/muscles';
import type { Exercise, ISODate, Session, SetLog } from '../domain/types';
import { e1rm, lastPerformance, progressNote, weeklyBestE1rm } from './progression';

export type MuscleRole = 'primary' | 'secondary' | 'none';

export function muscleRoles(e: Pick<Exercise, 'primary' | 'secondary'>): Record<MuscleKey, MuscleRole> {
  return Object.fromEntries(MUSCLE_KEYS.map((k) => [k, e.primary.includes(k) ? 'primary' : e.secondary.includes(k) ? 'secondary' : 'none'])) as Record<MuscleKey, MuscleRole>;
}

const keys = (polys: typeof MUSCLES_FRONT) => new Set(polys.map(([k]) => k).filter((k): k is MuscleKey => !!k));
const FRONT = keys(MUSCLES_FRONT);
const BACK = keys(MUSCLES_BACK);

/** Side of the body map that shows the most of what the exercise trains (primary counts double). */
export function bestView(e: Pick<Exercise, 'primary' | 'secondary'>): 'front' | 'back' {
  const score = (side: Set<MuscleKey>) => e.primary.filter((k) => side.has(k)).length * 2 + e.secondary.filter((k) => side.has(k)).length;
  return score(BACK) > score(FRONT) ? 'back' : 'front';
}

export interface BestSet { load: number; reps: number; date: ISODate; e1rm: number | null }

export interface ExerciseHistory {
  lastSets: SetLog[];
  lastDate?: ISODate;
  sessionsCount: number;
  best?: BestSet;
  /** Best e1RM per week, oldest first (0 = not trained that week). Empty for unloaded exercises. */
  weekly: number[];
  note: string;
}

/** What the user has done with this exercise: last session, best set and an 8-week e1RM trend. */
export function exerciseHistory(sessions: Session[], e: Exercise, bw: number, today: ISODate, weeks = 8): ExerciseHistory {
  const withIt = sessions.filter((s) => s.sets.some((l) => l.exerciseId === e.id)).sort((a, b) => b.startedAt - a.startedAt);
  let best: BestSet | undefined;
  for (const s of withIt) {
    for (const l of s.sets) {
      if (l.exerciseId !== e.id) continue;
      const v = e1rm(e, l.load, l.reps, bw);
      const better = !best
        || (v !== null && best.e1rm !== null ? v > best.e1rm : l.load > best.load || (l.load === best.load && l.reps > best.reps));
      if (better) best = { load: l.load, reps: l.reps, date: s.date, e1rm: v };
    }
  }
  const weekly = best?.e1rm != null ? Array.from({ length: weeks }, (_, i) => weeklyBestE1rm(sessions, e, bw, addDays(today, -7 * (weeks - 1 - i)))) : [];
  return {
    lastSets: lastPerformance(sessions, e.id),
    lastDate: withIt[0]?.date,
    sessionsCount: withIt.length,
    best,
    weekly,
    note: progressNote(sessions, e, bw, today),
  };
}
