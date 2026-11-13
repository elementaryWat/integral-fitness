import { addDays, inRange } from '../domain/dates';
import type { DailyActivity, ISODate } from '../domain/types';

export interface RecoveryScore {
  score: number | null;
  hrv?: { value: number; vsBaselinePct: number | null };
  restingHr?: { value: number; vsBaseline: number | null };
  deepSleepMin?: number;
  steps?: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Daily readiness (0–100) from overnight HRV and resting HR against their 7-day baseline,
 * plus deep sleep. Needs today's HRV or resting HR and ≥ 3 baseline days.
 */
export function recoveryScore(activity: DailyActivity[], day: ISODate): RecoveryScore {
  const t = activity.find((a) => a.date === day);
  const base = activity.filter((a) => inRange(a.date, addDays(day, -7), addDays(day, -1)));
  const hrvBase = mean(base.flatMap((a) => (a.hrvMs ? [a.hrvMs] : [])));
  const rhrBase = mean(base.flatMap((a) => (a.restingHr ? [a.restingHr] : [])));
  const out: RecoveryScore = { score: null, deepSleepMin: t?.deepSleepMin, steps: t?.steps };
  if (t?.hrvMs) out.hrv = { value: t.hrvMs, vsBaselinePct: hrvBase ? ((t.hrvMs - hrvBase) / hrvBase) * 100 : null };
  if (t?.restingHr) out.restingHr = { value: t.restingHr, vsBaseline: rhrBase ? t.restingHr - rhrBase : null };
  const enoughBase = base.filter((a) => a.hrvMs || a.restingHr).length >= 3;
  if (!t || (!t.hrvMs && !t.restingHr) || !enoughBase) return out;
  let s = 70;
  if (out.hrv?.vsBaselinePct != null) s += Math.max(-20, Math.min(20, out.hrv.vsBaselinePct * 1.5));
  if (out.restingHr?.vsBaseline != null) s -= Math.max(-10, Math.min(15, out.restingHr.vsBaseline * 3));
  if (t.deepSleepMin) s += Math.max(-10, Math.min(10, (t.deepSleepMin - 90) / 3));
  out.score = Math.round(Math.max(0, Math.min(100, s)));
  return out;
}
