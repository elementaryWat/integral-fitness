import type { ActivityLevel, Experience, Goal, Pace } from '../domain/types';
import { DEFAULT_STEPS, KCAL_PER_KG } from './energy';

/** Weekly weight change as a fraction of body weight, per goal and pace. */
const RATE_PCT: Record<Goal, Record<Pace, number>> = {
  recomp: { suave: -0.002, moderado: -0.003, rapido: -0.004 },
  definir: { suave: -0.004, moderado: -0.006, rapido: -0.008 },
  volumen: { suave: 0.0015, moderado: 0.0025, rapido: 0.004 },
  mantener: { suave: 0, moderado: 0, rapido: 0 },
};

export const GOAL_INFO: Record<Goal, { label: string; sub: string; protein: number; pace: boolean }> = {
  recomp: { label: 'Recomposición', sub: 'Perder grasa y ganar músculo a la vez con un déficit ligero.', protein: 2.2, pace: false },
  definir: { label: 'Definir', sub: 'Prioridad: bajar grasa conservando el músculo.', protein: 2.4, pace: true },
  volumen: { label: 'Ganar músculo', sub: 'Superávit controlado para maximizar la ganancia magra.', protein: 2.0, pace: true },
  mantener: { label: 'Mantener', sub: 'Peso estable, foco en fuerza y rendimiento.', protein: 1.8, pace: false },
};

export const PACE_LABEL: Record<Pace, string> = { suave: 'Suave', moderado: 'Moderado', rapido: 'Rápido' };

export const ACTIVITY_INFO: Record<ActivityLevel, { label: string; sub: string; steps: number }> = {
  sedentario: { label: 'Sedentario', sub: 'Escritorio casi todo el día · < 5.000 pasos', steps: DEFAULT_STEPS.sedentario },
  ligero: { label: 'Ligero', sub: 'Algo de caminata diaria · 5.000–8.000 pasos', steps: DEFAULT_STEPS.ligero },
  activo: { label: 'Activo', sub: 'De pie o caminando a menudo · 8.000–12.000 pasos', steps: DEFAULT_STEPS.activo },
  'muy-activo': { label: 'Muy activo', sub: 'Trabajo físico · > 12.000 pasos', steps: DEFAULT_STEPS['muy-activo'] },
};

/** Experience shifts the weekly set target of every muscle (sets/week). */
export const EXPERIENCE_INFO: Record<Experience, { label: string; sub: string; volume: number }> = {
  principiante: { label: 'Principiante', sub: 'Menos de 1 año entrenando con constancia', volume: -2 },
  intermedio: { label: 'Intermedio', sub: '1–3 años, conoces los básicos y tu RPE', volume: 0 },
  avanzado: { label: 'Avanzado', sub: 'Más de 3 años, progresar ya cuesta', volume: 2 },
};

/** Target weekly weight change (kg/week, negative = loss). */
export function targetRate(goal: Goal, pace: Pace, weightKg: number) {
  const pct = GOAL_INFO[goal].pace ? RATE_PCT[goal][pace] : RATE_PCT[goal].moderado;
  return Math.round(pct * weightKg * 100) / 100;
}

/** Daily kcal deficit for a weekly rate (negative = surplus), rounded to 25 kcal. */
export function deficitFor(rateKgWk: number) {
  return Math.round((-rateKgWk * KCAL_PER_KG) / 7 / 25) * 25 || 0;
}

/** Weeks to reach the target weight at the given rate; null when it is not in that direction. */
export function weeksToTarget(currentKg: number, targetKg: number | undefined, rateKgWk: number) {
  if (targetKg === undefined || rateKgWk === 0) return null;
  const diff = targetKg - currentKg;
  if (Math.abs(diff) < 0.1 || Math.sign(diff) !== Math.sign(rateKgWk)) return null;
  return Math.ceil(diff / rateKgWk);
}
