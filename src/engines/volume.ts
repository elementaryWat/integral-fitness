import { addDays, inRange } from '../domain/dates';
import { MUSCLE_INFO, MUSCLE_KEYS, type MuscleKey } from '../domain/muscles';
import type { Exercise, ISODate, Session } from '../domain/types';

export type ExMap = Record<string, Exercise>;

/** b = sub-entrenado, o = zona óptima, f = fatiga aguda / en recuperación */
export type MuscleStatus = 'b' | 'o' | 'f';

export interface MuscleState {
  key: MuscleKey;
  /** Hard sets in the last 7 days (secondary muscles count 0.5) */
  sets: number;
  /** Desired weekly hard sets (MEV + 4, shifted by coach adjustments, clamped to MEV–MAV) */
  target: number;
  /** Estimated recovery, 0–100 */
  rec: number;
  status: MuscleStatus;
  note: string;
}

export const HARD_SET_RPE = 7;

const zeroes = () => Object.fromEntries(MUSCLE_KEYS.map((k) => [k, 0])) as Record<MuscleKey, number>;

/** Hard sets per muscle for sessions dated within [from, to]. */
export function hardSetsByMuscle(sessions: Session[], ex: ExMap, from: ISODate, to: ISODate): Record<MuscleKey, number> {
  const out = zeroes();
  for (const s of sessions) {
    if (!inRange(s.date, from, to)) continue;
    for (const l of s.sets) {
      const e = ex[l.exerciseId];
      if (!e || e.discipline === 'Cardio' || l.rpe < HARD_SET_RPE) continue;
      e.primary.forEach((m) => (out[m] += 1));
      e.secondary.forEach((m) => (out[m] += 0.5));
    }
  }
  return out;
}

/**
 * Recovery per muscle from the most recent session that trained it: needs 24 h + 6 h per
 * hard set (max 72 h) to be fully recovered.
 */
export function recoveryByMuscle(sessions: Session[], ex: ExMap, nowMs: number): Record<MuscleKey, number> {
  const out = Object.fromEntries(MUSCLE_KEYS.map((k) => [k, 100])) as Record<MuscleKey, number>;
  const seen = new Set<MuscleKey>();
  const sorted = [...sessions].filter((s) => s.sets.length).sort((a, b) => b.startedAt - a.startedAt);
  for (const s of sorted) {
    const load = zeroes();
    let end = 0;
    for (const l of s.sets) {
      end = Math.max(end, l.endedAt);
      const e = ex[l.exerciseId];
      if (!e || e.discipline === 'Cardio') continue;
      e.primary.forEach((m) => (load[m] += 1));
      e.secondary.forEach((m) => (load[m] += 0.5));
    }
    for (const m of MUSCLE_KEYS) {
      if (seen.has(m) || load[m] === 0) continue;
      seen.add(m);
      const need = Math.min(72, 24 + 6 * load[m]);
      const hours = Math.max(0, (nowMs - end) / 3.6e6);
      out[m] = Math.min(100, Math.round((hours / need) * 100));
    }
    if (seen.size === MUSCLE_KEYS.length) break;
  }
  return out;
}

export function muscleTarget(k: MuscleKey, delta = 0) {
  const { mev, mav } = MUSCLE_INFO[k];
  return Math.max(mev, Math.min(mav, mev + 4 + delta));
}

const fmtSets = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ','));

export function muscleStates(
  sessions: Session[],
  ex: ExMap,
  today: ISODate,
  nowMs: number,
  volumeDelta: Partial<Record<MuscleKey, number>> = {},
): Record<MuscleKey, MuscleState> {
  const sets = hardSetsByMuscle(sessions, ex, addDays(today, -6), today);
  const rec = recoveryByMuscle(sessions, ex, nowMs);
  const out = {} as Record<MuscleKey, MuscleState>;
  for (const k of MUSCLE_KEYS) {
    const { mev, mav } = MUSCLE_INFO[k];
    const target = muscleTarget(k, volumeDelta[k]);
    let status: MuscleStatus;
    let note: string;
    if (sets[k] > mav) {
      status = 'f';
      note = `Por encima del máximo adaptable (${mav}). Reducir ${fmtSets(sets[k] - mav)} series.`;
    } else if (rec[k] < 60) {
      status = 'f';
      note = `En recuperación (${rec[k]}%). Evitar volumen directo hasta mañana.`;
    } else if (sets[k] < mev) {
      status = 'b';
      note = `Por debajo del mínimo efectivo (${mev}). Faltan ${fmtSets(mev - sets[k])} series.`;
    } else {
      status = 'o';
      note = `Dentro del rango ${mev}–${mav} series. Objetivo ${target}.`;
    }
    out[k] = { key: k, sets: sets[k], target, rec: rec[k], status, note };
  }
  return out;
}
