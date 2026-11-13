import { addDays, daysBetween, inRange } from '../domain/dates';
import type { CoachState, DailyActivity, DayType, FoodEntry, ISODate, Profile, Session, WeighIn } from '../domain/types';
import type { ExMap } from './volume';

/** Usual daily steps per activity level, used when nothing is logged for the day. */
export const DEFAULT_STEPS = { sedentario: 4000, ligero: 6500, activo: 10000, 'muy-activo': 13500 } as const;

export const KCAL_PER_KG = 7700;
export const MAX_WEEKLY_RECAL = 150;

/** Basal metabolic rate: Katch-McArdle when body fat is known, Mifflin-St Jeor otherwise. */
export function bmr(p: Profile, weightKg: number, fatPct?: number) {
  if (fatPct !== undefined && fatPct > 0) return Math.round(370 + 21.6 * weightKg * (1 - fatPct / 100));
  return Math.round(10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'h' ? 5 : -161));
}

/**
 * Non-exercise activity: watch active kcal when available, otherwise estimated from steps
 * (+10% of BMR for thermic effect / fidgeting). Falls back to the profile's usual steps.
 */
export function neat(activity: DailyActivity | undefined, weightKg: number, basal: number, defaultSteps = 6000) {
  if (activity?.activeKcal) return Math.round(activity.activeKcal);
  const steps = activity?.steps ?? defaultSteps;
  return Math.round(steps * 0.045 * (weightKg / 70) + basal * 0.1);
}

const MET: Record<string, number> = { Pesas: 5, Calistenia: 6, Core: 3.8, Cardio: 8 };

/** Training energy from logged set time (MET × kg × h); rest periods at 1.5 MET. */
export function trainingKcal(sessions: Session[], ex: ExMap, weightKg: number) {
  let kcal = 0;
  for (const s of sessions) {
    const sets = [...s.sets].sort((a, b) => a.startedAt - b.startedAt);
    sets.forEach((l, i) => {
      const met = MET[ex[l.exerciseId]?.discipline ?? 'Pesas'];
      kcal += met * weightKg * ((l.endedAt - l.startedAt) / 3.6e6);
      if (i > 0) kcal += 1.5 * weightKg * (Math.max(0, l.startedAt - sets[i - 1].endedAt) / 3.6e6);
    });
  }
  return Math.round(kcal);
}

/** Planned training kcal by day type, used before the session is logged. */
export const PLANNED_TRAIN_KCAL: Record<DayType, number> = { Pesado: 420, Moderado: 250, Descanso: 0 };

export interface DayEnergy { bmr: number; neat: number; train: number; tdee: number; target: number }

export function dayEnergy(args: {
  profile: Profile;
  weightKg: number;
  fatPct?: number;
  activity?: DailyActivity;
  trainKcal: number;
  coach: CoachState;
  dayType: DayType;
}): DayEnergy {
  const b = bmr(args.profile, args.weightKg, args.fatPct);
  const n = neat(args.activity, args.weightKg, b, args.profile.activityLevel ? DEFAULT_STEPS[args.profile.activityLevel] : undefined);
  const tdee = b + n + args.trainKcal;
  const target = tdee - args.profile.deficitKcal + args.coach.kcalOffset + (args.dayType === 'Descanso' ? args.coach.restDayKcal : 0);
  return { bmr: b, neat: n, train: args.trainKcal, tdee, target: Math.round(target) };
}

/** Least-squares slope of weigh-ins in [from, to], in kg/week (null with < 4 points). */
export function weightSlope(weighIns: WeighIn[], from: ISODate, to: ISODate): number | null {
  const pts = weighIns.filter((w) => inRange(w.date, from, to)).map((w) => ({ x: daysBetween(from, w.date), y: w.kg }));
  if (pts.length < 4) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den ? (num / den) * 7 : null;
}

/** 7-day moving average of weigh-ins ending on each weigh-in date. */
export function movingAverage(weighIns: WeighIn[], days = 7): WeighIn[] {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((w) => {
    const win = sorted.filter((x) => x.date <= w.date && x.date > addDays(w.date, -days));
    return { date: w.date, kg: win.reduce((a, x) => a + x.kg, 0) / win.length };
  });
}

export interface Recalibration { delta: number; observedKgWk: number; expectedKgWk: number }

/**
 * Weekly TDEE recalibration over the last 14 days: compares the observed weight trend with
 * the one predicted by logged intake vs. estimated TDEE and nudges the kcal offset
 * (bounded to ±150 kcal per week). Needs ≥ 8 weigh-ins and ≥ 7 days with food logged.
 */
export function recalibrate(args: { weighIns: WeighIn[]; foods: FoodEntry[]; tdeeOn: (d: ISODate) => number; today: ISODate }): Recalibration | null {
  const from = addDays(args.today, -13);
  const weighIns = args.weighIns.filter((w) => inRange(w.date, from, args.today));
  if (weighIns.length < 8) return null;
  const byDay = new Map<ISODate, number>();
  for (const f of args.foods) if (inRange(f.date, from, args.today)) byDay.set(f.date, (byDay.get(f.date) ?? 0) + f.kcal);
  if (byDay.size < 7) return null;
  const observed = weightSlope(weighIns, from, args.today);
  if (observed === null) return null;
  let bal = 0;
  byDay.forEach((kcal, d) => (bal += kcal - args.tdeeOn(d)));
  const expected = ((bal / byDay.size) * 7) / KCAL_PER_KG;
  // Losing faster than predicted ⇒ real TDEE is higher than estimated ⇒ raise intake target.
  const raw = ((expected - observed) * KCAL_PER_KG) / 7;
  const delta = Math.max(-MAX_WEEKLY_RECAL, Math.min(MAX_WEEKLY_RECAL, Math.round(raw / 5) * 5));
  return { delta, observedKgWk: observed, expectedKgWk: expected };
}
