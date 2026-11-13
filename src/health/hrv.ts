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
