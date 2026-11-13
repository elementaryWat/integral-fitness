import { SEED_EXERCISES } from '../domain/catalog';
import { addDays, parseISO, startOfWeek, today as todayISO, uid, weekday } from '../domain/dates';
import { weeklyBalance } from '../engines/balance';
import type { BodyComp, DailyActivity, FoodEntry, Perimeters, Profile, Session, SetLog, WeighIn } from '../domain/types';
import { buildQueue, generateSession, setSeconds, type Minutes } from '../engines/generator';
import { muscleStates, type ExMap } from '../engines/volume';
import type { AppState } from './index';

/** Small deterministic PRNG so demo data is stable between runs. */
function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const FOODS = [
  { name: 'Avena con claras y plátano', p: 38, c: 85, f: 9 },
  { name: 'Pechuga de pollo con arroz', p: 58, c: 70, f: 8 },
  { name: 'Yogur griego 0% con frutos rojos', p: 25, c: 18, f: 1 },
  { name: 'Salmón con patata y verduras', p: 42, c: 55, f: 22 },
  { name: 'Batido de proteína', p: 30, c: 6, f: 2 },
  { name: 'Tortilla de 3 huevos', p: 20, c: 2, f: 15 },
];

/**
 * Four weeks of plausible history generated through the real engines: sessions come from the
 * generator + progression, weight trends down ~0.3 kg/wk, composition improves slightly.
 */
export function buildDemoData(base: Partial<Profile> = {}): Partial<AppState> {
  const r = rng(42);
  const today = todayISO();
  const start = addDays(today, -28);
  const profile: Profile = {
    name: '', sex: 'h', age: 32, heightCm: 178, startWeightKg: 79.7, deficitKcal: 250, proteinGPerKg: 2.2,
    trainingDays: [1, 2, 4, 5, 6], createdAt: start, goal: 'recomp', pace: 'moderado', experience: 'intermedio', ...base,
  };
  const ex: ExMap = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
  const sessions: Session[] = [];
  const weighIns: WeighIn[] = [];
  const bodyComps: BodyComp[] = [];
  const perimeters: Perimeters[] = [];
  const foods: FoodEntry[] = [];
  const activity: DailyActivity[] = [];
  const minutesCycle: Minutes[] = [45, 60, 35, 45, 60];

  // Days 0…28: today gets weigh-in and overnight data, but no meals or session yet.
  for (let i = 0; i <= 28; i++) {
    const d = addDays(start, i);
    const isToday = d === today;
    const kg = profile.startWeightKg - i * 0.045 + Math.sin(i * 1.7) * 0.35;
    weighIns.push({ date: d, kg: +kg.toFixed(1) });
    activity.push({
      date: d,
      steps: Math.round(6500 + r() * 4500),
      deepSleepMin: Math.round(75 + r() * 35),
      sleepMin: Math.round(400 + r() * 60),
      hrvMs: Math.round(56 + i * 0.2 + r() * 8),
      restingHr: Math.round(55 - i * 0.08 + r() * 2),
    });
    if (i % 7 === 0) {
      const w = i / 7;
      bodyComps.push({ date: d, fatPct: +(16.4 - w * 0.4).toFixed(1), smmKg: +(36.1 + w * 0.25).toFixed(1) });
      perimeters.push({ date: d, waist: +(83.6 - w * 0.6).toFixed(1), chest: +(102.4 + w * 0.4).toFixed(1), arm: +(37.4 + w * 0.2).toFixed(1), thigh: +(57.6 + w * 0.1).toFixed(1) });
    }
    // ~2.450 kcal/day split across 4 meals
    for (let m = 0; m < (isToday ? 0 : 4); m++) {
      const f = FOODS[Math.floor(r() * FOODS.length)];
      const k = 1 + (r() - 0.5) * 0.3;
      // Scaled so a day lands near ~2.400 kcal (close to target), like a user following the plan.
      const p = Math.round(f.p * k * 1.5), c = Math.round(f.c * k * 1.6), fat = Math.round(f.f * k * 1.3);
      foods.push({ id: uid(), date: d, name: f.name, grams: Math.round(300 * k), p, c, f: fat, kcal: p * 4 + c * 4 + fat * 9 });
    }

    if (isToday || !profile.trainingDays.includes(weekday(d))) continue;
    const minutes = minutesCycle[sessions.length % minutesCycle.length];
    const t0 = parseISO(d).getTime() + 18 * 3.6e6;
    const states = muscleStates(sessions, ex, d, t0);
    const wk = weeklyBalance(sessions, ex, startOfWeek(d), addDays(d, -1));
    const blocks = generateSession({ minutes, exercises: SEED_EXERCISES, states, weeklyLowerShare: wk.total ? wk.lowerShare : null, history: sessions, restSec: 90, deload: false });
    const queue = buildQueue(blocks);
    let t = t0;
    const lateWeek = i >= 21;
    const sets: SetLog[] = queue.map((q, qi) => {
      const e = ex[q.exerciseId];
      const dur = setSeconds(e, q.reps) * 1000;
      const next = queue[qi + 1];
      const partner = next && next.block === q.block && next.set === q.set;
      const pullFatigue = lateWeek && e.primary.includes('dors');
      const log: SetLog = {
        id: uid(), qi, exerciseId: q.exerciseId, block: q.block, load: q.load,
        reps: q.reps + (r() < 0.25 ? 1 : 0), rpe: pullFatigue ? 9 : r() < 0.3 ? 7 : 8,
        startedAt: t, endedAt: t + dur,
        hrPeak: Math.round(145 + r() * 15),
        hrr60: Math.round((pullFatigue ? 31 : 40) + r() * 8),
      };
      t += dur + (partner ? 30000 : 90000 + r() * 20000);
      return log;
    });
    sessions.push({ id: uid(), date: d, plannedMinutes: minutes, startedAt: t0, endedAt: t, blocks, queue, sets, deload: false });
  }

  return {
    profile,
    sessions,
    weighIns,
    bodyComps,
    perimeters,
    foods,
    activity,
    coach: { kcalOffset: 0, restDayKcal: 0, volumeDelta: {}, mesoStart: addDays(today, -21) },
  };
}
