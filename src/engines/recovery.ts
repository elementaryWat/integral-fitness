import { MUSCLE_GROUPS } from '../domain/catalog';
import { addDays, inRange } from '../domain/dates';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import type { DailyActivity, ISODate } from '../domain/types';
import { recommendedGroups } from './focus';
import type { MuscleState } from './volume';

export const STEP_GOAL = 8000;
/** Reference night for an adult that trains: 7 h 30 min. */
export const SLEEP_TARGET_MIN = 450;

export interface RecoveryScore {
  score: number | null;
  /** True while there are fewer than 3 baseline days: the score uses absolute references only */
  provisional: boolean;
  baseDays: number;
  hrv?: { value: number; vsBaselinePct: number | null };
  restingHr?: { value: number; vsBaseline: number | null };
  /** Zepp stress (HRV-based): night value when available, else the day average */
  stress?: { value: number; night: boolean; vsBaseline: number | null };
  sleep?: { min: number; deepMin?: number; deepPct?: number; remMin?: number; score?: number; vsBaseline: number | null };
  deepSleepMin?: number;
  steps?: number;
  pai?: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const stressOf = (a: DailyActivity) => a.nightStress ?? a.stressAvg;

/**
 * Daily readiness (0–100) from what the Bip 6 and Apple Health provide: resting HR, stress
 * (Zepp's HRV-based score, at night when available), HRV when Apple Health has it, and sleep.
 * Each signal is compared with its own 7-day baseline; with fewer than 3 baseline days the score
 * is provisional and only uses absolute references (sleep length, stress level).
 */
export function recoveryScore(activity: DailyActivity[], day: ISODate): RecoveryScore {
  const t = activity.find((a) => a.date === day);
  const base = activity.filter((a) => inRange(a.date, addDays(day, -7), addDays(day, -1)));
  const baseOf = (pick: (a: DailyActivity) => number | undefined) => mean(base.flatMap((a) => (pick(a) ? [pick(a) as number] : [])));
  const baseDays = base.filter((a) => a.hrvMs || a.restingHr || stressOf(a)).length;
  const out: RecoveryScore = { score: null, provisional: baseDays < 3, baseDays, deepSleepMin: t?.deepSleepMin, steps: t?.steps, pai: t?.pai };
  if (!t) return out;

  const hrvBase = baseOf((a) => a.hrvMs);
  const rhrBase = baseOf((a) => a.restingHr);
  const stressBase = baseOf(stressOf);
  const sleepBase = baseOf((a) => a.sleepMin);
  if (t.hrvMs) out.hrv = { value: t.hrvMs, vsBaselinePct: hrvBase ? ((t.hrvMs - hrvBase) / hrvBase) * 100 : null };
  if (t.restingHr) out.restingHr = { value: t.restingHr, vsBaseline: rhrBase ? t.restingHr - rhrBase : null };
  const st = stressOf(t);
  if (st) out.stress = { value: st, night: t.nightStress !== undefined, vsBaseline: stressBase ? st - stressBase : null };
  if (t.sleepMin) {
    out.sleep = {
      min: t.sleepMin, deepMin: t.deepSleepMin, remMin: t.remMin, score: t.sleepScore,
      deepPct: t.deepSleepMin ? Math.round((t.deepSleepMin / t.sleepMin) * 100) : undefined,
      vsBaseline: sleepBase ? t.sleepMin - sleepBase : null,
    };
  }

  const physio = !!(out.hrv || out.restingHr || out.stress);
  if (!physio && !out.sleep) return out;

  let s = 70;
  if (!out.provisional) {
    if (out.hrv?.vsBaselinePct != null) s += clamp(out.hrv.vsBaselinePct * 1.5, -20, 20);
    if (out.restingHr?.vsBaseline != null) s -= clamp(out.restingHr.vsBaseline * 3, -10, 15);
    if (out.stress?.vsBaseline != null) s -= clamp(out.stress.vsBaseline * 0.8, -10, 15);
  }
  // Absolute references, valid from day one.
  if (out.stress) s -= clamp((out.stress.value - 35) * 0.3, -6, 10);
  if (out.sleep) {
    s += clamp((out.sleep.min - SLEEP_TARGET_MIN) / 6, -15, 8);
    if (out.sleep.deepMin) s += clamp((out.sleep.deepMin - 90) / 4, -6, 6);
  }
  out.score = Math.round(clamp(s, 0, 100));
  return out;
}

export type DayLevel = 'fuerte' | 'normal' | 'suave' | 'descanso';
export interface DayAdvice { level: DayLevel; title: string; detail: string }

const groupLabel = (g: string) => MUSCLE_GROUPS.find((x) => x.key === g)?.label.toLowerCase() ?? g;

/**
 * What to do today, combining the readiness score with each muscle's recovery: train hard,
 * normally, lightly (RPE ≤ 7, less volume) or rest, naming the groups that are ready and the
 * muscles to avoid.
 */
export function dayAdvice(score: number | null, states: Record<MuscleKey, MuscleState>): DayAdvice {
  const avoid = (Object.values(states) as MuscleState[]).filter((m) => m.rec < 60).sort((a, b) => a.rec - b.rec).slice(0, 2);
  const avoidText = avoid.length ? ` Evita ${avoid.map((m) => `${MUSCLE_INFO[m.key].name.toLowerCase()} (${Math.round(m.rec)} %)`).join(' y ')}.` : '';
  const ready = recommendedGroups(states, 2).map(groupLabel);
  const readyText = ready.length ? ` Listos: ${ready.join(' y ')}.` : '';
  if (score === null) return { level: 'normal', title: 'Entrena según el plan', detail: `Aún no hay datos de recuperación de hoy.${readyText}${avoidText}`.trim() };
  if (score < 40) return { level: 'descanso', title: 'Hoy toca recuperar', detail: `Descanso o movilidad y paseo suave. Si entrenas, sesión corta sin llegar al fallo.${avoidText}` };
  if (score < 60) return { level: 'suave', title: 'Entreno suave', detail: `Menos volumen (−30 %) y RPE ≤ 7.${readyText}${avoidText}` };
  if (score < 75) return { level: 'normal', title: 'Entreno normal', detail: `Sigue el plan con RPE 8.${readyText}${avoidText}` };
  return { level: 'fuerte', title: 'Día para apretar', detail: `Buen momento para cargas altas o un récord.${readyText}${avoidText}` };
}

/** Last 7 days (oldest first) of one daily metric, null where missing — for the detail sparklines. */
export function lastWeek(activity: DailyActivity[], day: ISODate, pick: (a: DailyActivity) => number | undefined): (number | null)[] {
  return Array.from({ length: 7 }, (_, i) => {
    const a = activity.find((x) => x.date === addDays(day, i - 6));
    const v = a ? pick(a) : undefined;
    return v ? v : null;
  });
}
