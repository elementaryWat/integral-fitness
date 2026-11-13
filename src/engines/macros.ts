import { weekday } from '../domain/dates';
import type { DayType, ISODate, Macros, Profile, Session } from '../domain/types';

/**
 * Day type drives carb cycling: a session of ≥ 45 min (not deload) is a heavy day, any other
 * session a moderate one. Days without a session are rest days in the past and follow the
 * profile's training days for today/future (heavy if today's plan is ≥ 45 min).
 */
export function dayTypeFor(date: ISODate, today: ISODate, sessions: Session[], profile: Profile, plannedMinutes?: number): DayType {
  const done = sessions.filter((s) => s.date === date && s.sets.length);
  if (done.length) return done.some((s) => s.plannedMinutes >= 45 && !s.deload) ? 'Pesado' : 'Moderado';
  if (date < today) return 'Descanso';
  if (!profile.trainingDays.includes(weekday(date))) return 'Descanso';
  if (date === today && plannedMinutes !== undefined) return plannedMinutes >= 45 ? 'Pesado' : 'Moderado';
  return 'Moderado';
}

/** Protein fixed per kg, fat floor (higher on rest days), carbs fill the remaining kcal. */
export function macroTargets(targetKcal: number, weightKg: number, profile: Profile, dayType: DayType): Macros {
  const p = Math.round(profile.proteinGPerKg * weightKg);
  const f = Math.round((dayType === 'Descanso' ? 1.0 : 0.8) * weightKg);
  const c = Math.max(80, Math.round((targetKcal - p * 4 - f * 9) / 4));
  return { p, c, f };
}

export const kcalOf = (m: Macros) => m.p * 4 + m.c * 4 + m.f * 9;
