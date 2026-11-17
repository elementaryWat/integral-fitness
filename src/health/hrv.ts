import { addDays } from '../domain/dates';
import type { ISODate } from '../domain/types';

export interface HrvSample { value: number; start: Date }

const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Nightly HRV per day: SDNN samples between 18:00 of the previous day and 12:00 of each day
 * are averaged and attributed to that morning's date (the day the recovery card shows).
 */
export function nightlyHrv(samples: HrvSample[]): Record<ISODate, number> {
  const night = new Map<ISODate, number[]>();
  const day = new Map<ISODate, number[]>();
  const push = (m: Map<ISODate, number[]>, d: ISODate, v: number) => m.set(d, [...(m.get(d) ?? []), v]);
  for (const s of samples) {
    if (!(s.value > 5 && s.value < 300)) continue;
    const h = s.start.getHours();
    if (h >= 18) push(night, addDays(localISO(s.start), 1), s.value);
    else if (h < 12) push(night, localISO(s.start), s.value);
    else push(day, localISO(s.start), s.value);
  }
  // Night readings win; days with only daytime readings (e.g. written when the watch syncs) use those.
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const out: Record<ISODate, number> = {};
  for (const [d, xs] of day) out[d] = avg(xs);
  for (const [d, xs] of night) out[d] = avg(xs);
  return out;
}

/** HealthKit sleep analysis values (HKCategoryValueSleepAnalysis). */
export const SLEEP_VALUE = { inBed: 0, asleep: 1, awake: 2, core: 3, deep: 4, rem: 5 } as const;
export interface SleepSample { value: number; start: Date; end: Date }

/**
 * Sleep per night from Apple Health stages, attributed to the morning it ends (same rule as HRV:
 * a night that ends before 18:00 belongs to that day). Overlapping sources are not de-duplicated,
 * so only one writer (the Zepp app) is expected.
 */
export function nightlySleep(samples: SleepSample[]): Record<ISODate, { sleepMin: number; deepSleepMin?: number; remMin?: number; lightMin?: number; awakeMin?: number }> {
  const out: Record<ISODate, { sleepMin: number; deepSleepMin?: number; remMin?: number; lightMin?: number; awakeMin?: number }> = {};
  for (const s of samples) {
    const min = Math.round((s.end.getTime() - s.start.getTime()) / 60000);
    if (!(min > 0) || s.value === SLEEP_VALUE.inBed) continue;
    const date = s.end.getHours() >= 18 ? addDays(localISO(s.end), 1) : localISO(s.end);
    const n = (out[date] ??= { sleepMin: 0 });
    const add = (k: 'deepSleepMin' | 'remMin' | 'lightMin' | 'awakeMin') => (n[k] = (n[k] ?? 0) + min);
    if (s.value === SLEEP_VALUE.awake) add('awakeMin');
    else {
      n.sleepMin += min;
      if (s.value === SLEEP_VALUE.deep) add('deepSleepMin');
      else if (s.value === SLEEP_VALUE.rem) add('remMin');
      else if (s.value === SLEEP_VALUE.core) add('lightMin');
    }
  }
  return out;
}
