import { addDays, startOfWeek } from '../domain/dates';
import type { Exercise, ISODate, Session, SetLog } from '../domain/types';
import { fmt } from '../data';

/** Exercises whose load can be expressed in kg (and therefore have an e1RM and tonnage). */
export const isLoaded = (e: Exercise) => e.unit === 'reps' && (e.loadMode === 'peso' || e.loadMode === 'lastre');

/** Total kg moved per rep (bodyweight added for weighted calisthenics). */
export const systemLoad = (e: Exercise, load: number, bw: number) => (e.loadMode === 'lastre' ? bw + load : load);

/** Estimated 1RM (Epley). */
export function e1rm(e: Exercise, load: number, reps: number, bw: number): number | null {
  if (!isLoaded(e) || reps <= 0) return null;
  return systemLoad(e, load, bw) * (1 + reps / 30);
}

/** Sets of the most recent finished session that included this exercise. */
export function lastPerformance(sessions: Session[], exerciseId: string): SetLog[] {
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const s of sorted) {
    const sets = s.sets.filter((l) => l.exerciseId === exerciseId);
    if (sets.length) return sets;
  }
  return [];
}

const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);
const unitInc = (e: Exercise) => (e.unit === 's' ? 5 : e.unit === 'min' ? 2 : 1);

/**
 * Next prescription by double progression: add reps up to the top of the range, then add
 * load (or advance one lever level) and drop back to the bottom of the range.
 * Deload weeks keep reps at the bottom of the range with ~90% load.
 */
export function suggestNext(e: Exercise, last: SetLog[], deload = false): { load: number; reps: number } {
  const [lo, hi] = e.repRange;
  if (!last.length) return { load: e.defaultLoad, reps: e.defaultReps };
  const load = Math.max(...last.map((l) => l.load));
  const atLoad = last.filter((l) => l.load === load);
  const minReps = Math.min(...atLoad.map((l) => l.reps));
  const avgRpe = atLoad.reduce((a, l) => a + l.rpe, 0) / atLoad.length;

  if (deload) {
    if (e.loadMode === 'peso' || e.loadMode === 'lastre') return { load: roundTo(load * 0.9, e.step), reps: lo };
    return { load, reps: lo };
  }

  const hitTop = minReps >= hi && avgRpe <= 8.5;
  switch (e.loadMode) {
    case 'peso':
    case 'lastre':
      if (hitTop) return { load: +(load + e.step).toFixed(2), reps: lo };
      if (avgRpe >= 9.5) return { load, reps: minReps };
      return { load, reps: Math.min(hi, minReps + 1) };
    case 'palanca': {
      const maxLevel = (e.levers?.length ?? 1) - 1;
      if (hitTop && load < maxLevel) return { load: load + 1, reps: lo };
      return { load, reps: avgRpe >= 9.5 ? minReps : Math.min(hi, minReps + unitInc(e)) };
    }
    default: {
      if (avgRpe >= 9.5) return { load, reps: minReps };
      const next = minReps + unitInc(e);
      return { load, reps: e.discipline === 'Cardio' ? Math.min(hi, next) : next };
    }
  }
}

function bestInRange(sessions: Session[], e: Exercise, bw: number, from: ISODate, to: ISODate) {
  let bestE1 = 0, bestReps = 0;
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    for (const l of s.sets) {
      if (l.exerciseId !== e.id) continue;
      bestE1 = Math.max(bestE1, e1rm(e, l.load, l.reps, bw) ?? 0);
      bestReps = Math.max(bestReps, l.reps);
    }
  }
  return { bestE1, bestReps };
}

/** Best e1RM in the week containing `day` (0 if not trained). */
export function weeklyBestE1rm(sessions: Session[], e: Exercise, bw: number, day: ISODate) {
  const from = startOfWeek(day);
  return bestInRange(sessions, e, bw, from, addDays(from, 6)).bestE1;
}

/** "1RM est. 104,5 kg · +1,8 kg vs sem. ant." */
export function progressNote(sessions: Session[], e: Exercise, bw: number, today: ISODate): string {
  const thisFrom = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const now = bestInRange(sessions, e, bw, thisFrom, today);
  const prev = bestInRange(sessions, e, bw, prevFrom, addDays(thisFrom, -1));
  if (isLoaded(e)) {
    const ref = now.bestE1 || prev.bestE1;
    if (!ref) return 'Sin historial · carga inicial';
    const head = `1RM est. ${fmt(ref, 1)} kg${e.loadMode === 'lastre' ? ' (con PC)' : ''}`;
    if (now.bestE1 && prev.bestE1) {
      const d = now.bestE1 - prev.bestE1;
      return `${head} · ${d >= 0 ? '+' : ''}${fmt(d, 1)} kg vs sem. ant.`;
    }
    return head;
  }
  const unit = e.unit === 's' ? 's' : e.unit === 'min' ? 'min' : 'reps';
  if (now.bestReps && prev.bestReps) {
    const d = now.bestReps - prev.bestReps;
    return `Progresión: ${d >= 0 ? '+' : ''}${d} ${unit} vs sem. ant.`;
  }
  return now.bestReps || prev.bestReps ? `Mejor marca: ${now.bestReps || prev.bestReps} ${unit}` : 'Sin historial';
}
