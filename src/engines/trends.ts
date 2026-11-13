import { addDays, inRange, startOfWeek } from '../domain/dates';
import type { BodyComp, FoodEntry, ISODate, Session, WeighIn } from '../domain/types';
import { isLoaded, weeklyBestE1rm } from './progression';
import type { ExMap } from './volume';

export interface TrendSeries {
  /** Week start dates, oldest first */
  weeks: ISODate[];
  /**
   * Relative strength index: mean over lifts trained that week of
   * (best e1RM / bodyweight) ÷ that lift's first weekly value — 1 = baseline.
   */
  f: (number | null)[];
  /** Skeletal muscle mass (kg) */
  m: (number | null)[];
  /** Body fat (%) */
  g: (number | null)[];
  /** Mean daily energy balance (kcal) on days with food logged */
  b: (number | null)[];
}

const lastIn = <T extends { date: ISODate }>(xs: T[], to: ISODate, pick: (x: T) => number | undefined) => {
  const v = xs.filter((x) => x.date <= to && pick(x) !== undefined).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
  return v ? (pick(v) as number) : null;
};

export function weeklyTrends(args: {
  today: ISODate;
  weeks: number;
  sessions: Session[];
  ex: ExMap;
  weighIns: WeighIn[];
  bodyComps: BodyComp[];
  foods: FoodEntry[];
  tdeeOn: (d: ISODate) => number;
}): TrendSeries {
  const first = addDays(startOfWeek(args.today), -7 * (args.weeks - 1));
  const out: TrendSeries = { weeks: [], f: [], m: [], g: [], b: [] };
  const loaded = Object.values(args.ex).filter(isLoaded);
  const baseline = new Map<string, number>();
  for (let w = 0; w < args.weeks; w++) {
    const from = addDays(first, w * 7);
    const to = addDays(from, 6);
    out.weeks.push(from);
    const bw = lastIn(args.weighIns, to, (x) => x.kg);
    const ratios: number[] = [];
    for (const e of loaded) {
      const v = weeklyBestE1rm(args.sessions, e, bw ?? 75, from);
      if (!v || !bw) continue;
      if (!baseline.has(e.id)) baseline.set(e.id, v / bw);
      ratios.push(v / bw / (baseline.get(e.id) as number));
    }
    out.f.push(ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null);
    out.m.push(lastIn(args.bodyComps.filter((c) => c.date >= from), to, (x) => x.smmKg));
    out.g.push(lastIn(args.bodyComps.filter((c) => c.date >= from), to, (x) => x.fatPct));
    const days = new Map<ISODate, number>();
    for (const f of args.foods) if (inRange(f.date, from, to)) days.set(f.date, (days.get(f.date) ?? 0) + f.kcal);
    let bal = 0;
    days.forEach((k, d) => (bal += k - args.tdeeOn(d)));
    out.b.push(days.size ? bal / days.size : null);
  }
  return out;
}
