import { SEED_EXERCISES } from '../../domain/catalog';
import { addDays, parseISO } from '../../domain/dates';
import type { CoachState, ISODate, Profile, Session, SetLog } from '../../domain/types';
import type { ExMap } from '../volume';

export const EX: ExMap = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));

export const PROFILE: Profile = {
  name: 'Test', sex: 'h', age: 32, heightCm: 178, startWeightKg: 80, deficitKcal: 250,
  proteinGPerKg: 2.2, trainingDays: [1, 2, 4, 5, 6], createdAt: '2026-08-17',
};

export const COACH: CoachState = { kcalOffset: 0, restDayKcal: 0, volumeDelta: {}, mesoStart: '2026-10-19' };

export const TODAY: ISODate = '2026-11-12';
export const noonMs = (d: ISODate) => parseISO(d).getTime() + 12 * 3.6e6;

let n = 0;
/** A session on `date` with `count` sets of each exercise id at the given load/reps/rpe. */
export function session(date: ISODate, items: { id: string; count: number; load?: number; reps?: number; rpe?: number; hrr60?: number }[], minutes: 35 | 45 | 60 = 45): Session {
  let t = noonMs(date);
  const sets: SetLog[] = [];
  items.forEach((it) => {
    for (let i = 0; i < it.count; i++) {
      const e = EX[it.id];
      sets.push({
        id: `s${n++}`, qi: sets.length, exerciseId: it.id, block: 'A',
        load: it.load ?? e.defaultLoad, reps: it.reps ?? e.defaultReps, rpe: it.rpe ?? 8,
        startedAt: t, endedAt: t + 40000, hrr60: it.hrr60,
      });
      t += 40000 + 90000;
    }
  });
  return { id: `x${n++}`, date, plannedMinutes: minutes, startedAt: noonMs(date), endedAt: t, blocks: [], queue: [], sets, deload: false };
}

export const daysAgo = (k: number) => addDays(TODAY, -k);
