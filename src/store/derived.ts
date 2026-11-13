import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { addDays, startOfWeek, today as todayISO } from '../domain/dates';
import { MUSCLE_KEYS } from '../domain/muscles';
import type { CoachState, DayType, ISODate, Profile, Session } from '../domain/types';
import { EXPERIENCE_INFO } from '../engines/goals';
import { weeklyBalance } from '../engines/balance';
import { dayEnergy, movingAverage, PLANNED_TRAIN_KCAL, trainingKcal, weightSlope } from '../engines/energy';
import { applySwaps, generateFocused } from '../engines/focus';
import { generateSession } from '../engines/generator';
import { dayTypeFor, macroTargets } from '../engines/macros';
import { recoveryScore } from '../engines/recovery';
import { muscleStates, type ExMap } from '../engines/volume';
import { useStore, type AppState } from './index';

export const FALLBACK_PROFILE: Profile = {
  name: '', sex: 'h', age: 30, heightCm: 175, startWeightKg: 75, deficitKcal: 250, proteinGPerKg: 2.2, trainingDays: [1, 2, 4, 5, 6], createdAt: todayISO(),
};

/** Latest value on or before `day`. */
export function valueOn<T extends { date: ISODate }>(xs: T[], day: ISODate, pick: (x: T) => number | undefined) {
  let best: T | undefined;
  for (const x of xs) if (x.date <= day && pick(x) !== undefined && (!best || x.date > best.date)) best = x;
  return best ? (pick(best) as number) : undefined;
}

/** Pure energy helpers bound to the current store data. */
export function energyContext(s: Pick<AppState, 'profile' | 'weighIns' | 'bodyComps' | 'activity' | 'sessions' | 'coach' | 'dayTypeOverride' | 'activeSession'>, ex: ExMap, today: ISODate, plannedMinutes?: number) {
  const profile = s.profile ?? FALLBACK_PROFILE;
  const all: Session[] = s.activeSession ? [...s.sessions, s.activeSession] : s.sessions;
  const weightOn = (d: ISODate) => {
    const ma = movingAverage(s.weighIns.filter((w) => w.date <= d));
    return ma.at(-1)?.kg ?? profile.startWeightKg;
  };
  const dayTypeOn = (d: ISODate): DayType => s.dayTypeOverride[d] ?? dayTypeFor(d, today, all, profile, d === today ? plannedMinutes : undefined);
  const energyOn = (d: ISODate) => {
    const w = weightOn(d);
    const daySessions = all.filter((x) => x.date === d);
    const logged = trainingKcal(daySessions, ex, w);
    const type = dayTypeOn(d);
    // Past days use what was logged; today/future use the plan until the logged session exceeds it.
    const trainKcal = d >= today ? Math.max(logged, PLANNED_TRAIN_KCAL[type]) : logged;
    return dayEnergy({ profile, weightKg: w, fatPct: valueOn(s.bodyComps, d, (b) => b.fatPct), activity: s.activity.find((a) => a.date === d), trainKcal, coach: s.coach, dayType: type });
  };
  const macrosOn = (d: ISODate) => macroTargets(energyOn(d).target, weightOn(d), profile, dayTypeOn(d));
  return { profile, all, weightOn, dayTypeOn, energyOn, macrosOn };
}

/** Coach per-muscle adjustments plus the experience-level offset applied to every muscle. */
export function volumeTargets(delta: CoachState['volumeDelta'], profile: Profile): CoachState['volumeDelta'] {
  const base = profile.experience ? EXPERIENCE_INFO[profile.experience].volume : 0;
  if (!base) return delta;
  return Object.fromEntries(MUSCLE_KEYS.map((k) => [k, (delta[k] ?? 0) + base]));
}

function useComputeDerived() {
  const s = useStore();
  const day = todayISO();
  return useMemo(() => {
    const ex: ExMap = Object.fromEntries(s.exercises.map((e) => [e.id, e]));
    const ctx = energyContext(s, ex, day, s.settings.plannedMinutes);
    const now = Date.now();
    const states = muscleStates(ctx.all, ex, day, now, volumeTargets(s.coach.volumeDelta, ctx.profile));
    const balance = weeklyBalance(ctx.all, ex, addDays(day, -6), day);
    const weekStart = startOfWeek(day);
    const weekBal = weeklyBalance(ctx.all, ex, weekStart, day);
    const deload = s.coach.deloadWeekOf === weekStart;
    const genInput = {
      minutes: s.settings.plannedMinutes,
      exercises: s.exercises,
      states,
      weeklyLowerShare: weekBal.total ? weekBal.lowerShare : null,
      history: s.sessions,
      restSec: s.settings.restSec,
      deload,
      experience: ctx.profile.experience,
    };
    const focus = s.settings.focus ?? [];
    const generated = focus.length ? generateFocused({ ...genInput, groups: focus }) : generateSession(genInput);
    const plan = applySwaps(generated, s.settings.swaps ?? {}, ex, s.sessions, deload);
    const weight = ctx.weightOn(day);
    const rate = weightSlope(s.weighIns, addDays(day, -13), day);
    return {
      today: day,
      ex,
      ...ctx,
      states,
      balance,
      plan,
      deload,
      weight,
      rate,
      fatPct: valueOn(s.bodyComps, day, (b) => b.fatPct),
      smm: valueOn(s.bodyComps, day, (b) => b.smmKg),
      recovery: recoveryScore(s.activity, day),
    };
  }, [s, day]);
}

type Derived = ReturnType<typeof useComputeDerived>;
const DerivedCtx = createContext<Derived | null>(null);

/** Computes engine outputs once per store change and shares them with every screen. */
export function DerivedProvider({ children }: { children: ReactNode }) {
  return createElement(DerivedCtx.Provider, { value: useComputeDerived() }, children);
}

/** Everything the screens need, recomputed when the underlying data changes. */
export function useDerived(): Derived {
  const v = useContext(DerivedCtx);
  if (!v) throw new Error('useDerived must be used inside DerivedProvider');
  return v;
}
