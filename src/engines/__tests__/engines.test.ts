import { SEED_EXERCISES } from '../../domain/catalog';
import { weeklyBalance, queueBalance } from '../balance';
import { weeklyReview } from '../coachRules';
import { sessionMetrics } from '../efficiency';
import { bmr, recalibrate, weightSlope } from '../energy';
import { buildQueue, estimateMinutes, generateSession, SESSION_MINUTES } from '../generator';
import { dayTypeFor, macroTargets } from '../macros';
import { e1rm, suggestNext } from '../progression';
import { muscleStates } from '../volume';
import { COACH, EX, PROFILE, TODAY, daysAgo, noonMs, session } from './fixtures';
import type { FoodEntry, WeighIn } from '../../domain/types';
import { addDays } from '../../domain/dates';

const freshStates = () => muscleStates([], EX, TODAY, noonMs(TODAY));

describe('volume', () => {
  it('counts hard sets (primary 1, secondary 0.5) and ignores easy sets', () => {
    const s = session(daysAgo(3), [{ id: 'bench', count: 4 }, { id: 'bench', count: 2, rpe: 6 }]);
    const st = muscleStates([s], EX, TODAY, noonMs(TODAY));
    expect(st.pecho.sets).toBe(4);
    expect(st.tri.sets).toBe(2);
  });

  it('classifies under-trained, optimal and fatigued muscles', () => {
    const old = session(daysAgo(4), [{ id: 'bench', count: 10 }, { id: 'row', count: 22 }]);
    const st = muscleStates([old], EX, TODAY, noonMs(TODAY));
    expect(st.quad.status).toBe('b');
    expect(st.pecho.status).toBe('o');
    expect(st.dors.status).toBe('f'); // 22 > MAV 18
  });

  it('marks muscles trained a few hours ago as recovering', () => {
    const s = session(TODAY, [{ id: 'bulg', count: 4 }]);
    const st = muscleStates([s], EX, TODAY, noonMs(TODAY) + 2 * 3.6e6);
    expect(st.quad.rec).toBeLessThan(60);
    expect(st.quad.status).toBe('f');
  });
});

describe('generator', () => {
  it.each(SESSION_MINUTES)('fits %i min and uses antagonist supersets', (minutes) => {
    const blocks = generateSession({ minutes, exercises: SEED_EXERCISES, states: freshStates(), weeklyLowerShare: null, history: [], restSec: 90, deload: false });
    expect(estimateMinutes(blocks, EX)).toBeLessThanOrEqual(minutes);
    const a = blocks.find((b) => b.key === 'A')!;
    expect(a.items.map((i) => EX[i.exerciseId].pattern).sort()).toEqual(['empuje', 'traccion']);
  });

  it.each(SESSION_MINUTES)('guarantees ≥20%% lower-body sets at %i min when the week is behind', (minutes) => {
    const blocks = generateSession({ minutes, exercises: SEED_EXERCISES, states: freshStates(), weeklyLowerShare: null, history: [], restSec: 90, deload: false });
    expect(queueBalance(buildQueue(blocks), EX).lowerShare).toBeGreaterThanOrEqual(0.2);
  });

  it('keeps core in the leg block when the week already has enough legs', () => {
    const blocks = generateSession({ minutes: 45, exercises: SEED_EXERCISES, states: freshStates(), weeklyLowerShare: 0.3, history: [], restSec: 90, deload: false });
    const c = blocks.find((b) => b.key === 'C')!;
    expect(EX[c.items[1].exerciseId].pattern).toBe('core');
  });

  it('adds Z2 cardio only at 60 min and skips it when legs are fatigued', () => {
    const base = { exercises: SEED_EXERCISES, weeklyLowerShare: null, history: [], restSec: 90, deload: false };
    expect(generateSession({ ...base, minutes: 45, states: freshStates() }).some((b) => b.kind === 'cardio')).toBe(false);
    expect(generateSession({ ...base, minutes: 60, states: freshStates() }).some((b) => b.kind === 'cardio')).toBe(true);
    const legs = session(TODAY, [{ id: 'bulg', count: 4 }, { id: 'rdl', count: 4 }]);
    const tired = muscleStates([legs], EX, TODAY, noonMs(TODAY) + 3.6e6);
    expect(generateSession({ ...base, minutes: 60, states: tired }).some((b) => b.kind === 'cardio')).toBe(false);
  });

  it('prioritises under-trained muscles in accessory slots', () => {
    const hist = session(daysAgo(3), [{ id: 'lat', count: 8 }, { id: 'curl', count: 8 }]);
    const st = muscleStates([hist], EX, TODAY, noonMs(TODAY));
    const blocks = generateSession({ minutes: 45, exercises: SEED_EXERCISES, states: st, weeklyLowerShare: 0.3, history: [hist], restSec: 90, deload: false });
    const d = blocks.find((b) => b.key === 'D')!;
    const ids = d.items.map((i) => i.exerciseId);
    // Already-trained delts/biceps are skipped; picks target muscles still below their weekly target.
    expect(ids).not.toEqual(expect.arrayContaining(['lat']));
    expect(ids).not.toEqual(expect.arrayContaining(['curl']));
    for (const id of ids) expect(st[EX[id].primary[0]].sets).toBeLessThan(st[EX[id].primary[0]].target);
    expect(ids.every((id) => EX[id].region === 'superior')).toBe(true);
  });

  it('uses most of the available time even when the week is already high-volume', () => {
    const heavy = session(daysAgo(3), [{ id: 'bench', count: 10 }, { id: 'row', count: 10 }, { id: 'pull', count: 8 }, { id: 'dips', count: 8 }]);
    const st = muscleStates([heavy], EX, TODAY, noonMs(TODAY));
    const blocks = generateSession({ minutes: 45, exercises: SEED_EXERCISES, states: st, weeklyLowerShare: 0.2, history: [heavy], restSec: 90, deload: false });
    expect(estimateMinutes(blocks, EX)).toBeGreaterThanOrEqual(40);
  });

  it('reduces volume on deload weeks', () => {
    const base = { minutes: 45 as const, exercises: SEED_EXERCISES, states: freshStates(), weeklyLowerShare: null, history: [], restSec: 90 };
    const normal = buildQueue(generateSession({ ...base, deload: false })).length;
    const deload = buildQueue(generateSession({ ...base, deload: true })).length;
    expect(deload).toBeLessThan(normal);
  });
});

describe('balance', () => {
  it('computes the 80/20 split and push:pull ratio', () => {
    const s = session(daysAgo(1), [{ id: 'bench', count: 4 }, { id: 'row', count: 4 }, { id: 'bulg', count: 2 }]);
    const b = weeklyBalance([s], EX, daysAgo(6), TODAY);
    expect(b.lowerShare).toBeCloseTo(0.2);
    expect(b.status).toBe('en-objetivo');
    expect(b.pushPull).toBe(1);
  });
});

describe('progression', () => {
  const bench = EX.bench;
  it('adds reps within the range, then load', () => {
    const mk = (reps: number, rpe = 8) => session(daysAgo(2), [{ id: 'bench', count: 3, load: 80, reps, rpe }]).sets;
    expect(suggestNext(bench, mk(7))).toEqual({ load: 80, reps: 8 });
    expect(suggestNext(bench, mk(10))).toEqual({ load: 82.5, reps: 6 });
    expect(suggestNext(bench, mk(10, 9.5))).toEqual({ load: 80, reps: 10 });
  });

  it('advances lever progressions and deloads to ~90%', () => {
    const fl = session(daysAgo(2), [{ id: 'flever', count: 3, load: 1, reps: 20 }]).sets;
    expect(suggestNext(EX.flever, fl)).toEqual({ load: 2, reps: 8 });
    expect(suggestNext(bench, session(daysAgo(2), [{ id: 'bench', count: 3, load: 80, reps: 8 }]).sets, true)).toEqual({ load: 72.5, reps: 6 });
  });

  it('estimates 1RM with bodyweight for weighted calisthenics', () => {
    expect(e1rm(bench, 82.5, 8, 78)).toBeCloseTo(104.5, 1);
    expect(e1rm(EX.pull, 20, 6, 78)).toBeCloseTo(117.6, 1);
    expect(e1rm(EX.plank, 0, 40, 78)).toBeNull();
  });
});

describe('efficiency', () => {
  it('derives density and active:rest from set timestamps', () => {
    const s = session(TODAY, [{ id: 'bench', count: 2, load: 100, reps: 5 }]);
    const m = sessionMetrics(s, EX, 78);
    expect(m.tonnage).toBe(1000);
    expect(m.activeSec).toBe(80);
    expect(m.restSec).toBe(90);
    expect(m.density).toBeCloseTo(1000 / (170 / 60));
  });
});

describe('energy & macros', () => {
  it('uses Katch-McArdle when body fat is known', () => {
    expect(bmr(PROFILE, 78, 15)).toBe(Math.round(370 + 21.6 * 78 * 0.85));
    expect(bmr(PROFILE, 78)).toBe(Math.round(780 + 6.25 * 178 - 160 + 5));
  });

  it('recalibrates TDEE from the observed weight trend (bounded)', () => {
    const weighIns: WeighIn[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(TODAY, -13 + i), kg: 80 - i * (0.6 / 7) }));
    const foods: FoodEntry[] = Array.from({ length: 10 }, (_, i) => ({ id: String(i), date: addDays(TODAY, -i), name: 'x', grams: 1, p: 0, c: 0, f: 0, kcal: 2400 }));
    // Predicted −0.23 kg/wk (−250 kcal/day) but losing −0.6 kg/wk ⇒ TDEE underestimated ⇒ raise target.
    const r = recalibrate({ weighIns, foods, tdeeOn: () => 2650, today: TODAY })!;
    expect(weightSlope(weighIns, addDays(TODAY, -13), TODAY)).toBeCloseTo(-0.6, 2);
    expect(r.delta).toBe(150);
    expect(recalibrate({ weighIns: weighIns.slice(0, 5), foods, tdeeOn: () => 2650, today: TODAY })).toBeNull();
  });

  it('cycles carbs by day type', () => {
    const heavy = macroTargets(2600, 78, PROFILE, 'Pesado');
    const rest = macroTargets(2200, 78, PROFILE, 'Descanso');
    expect(heavy.p).toBe(rest.p);
    expect(heavy.c).toBeGreaterThan(rest.c);
    expect(dayTypeFor(TODAY, TODAY, [], PROFILE, 45)).toBe('Pesado');
    expect(dayTypeFor(daysAgo(1), TODAY, [], PROFILE)).toBe('Descanso');
  });
});

describe('coach', () => {
  it('detects fatigue, lagging groups and proposes adjustments', () => {
    const prev = session(daysAgo(9), [{ id: 'row', count: 8, hrr60: 40 }]);
    const now = session(daysAgo(2), [{ id: 'row', count: 20, hrr60: 30 }, { id: 'bench', count: 10 }]);
    const sessions = [prev, now];
    const states = muscleStates(sessions, EX, TODAY, noonMs(TODAY));
    const r = weeklyReview({ today: TODAY, profile: PROFILE, weightKg: 78, states, sessions, ex: EX, weighIns: [], bodyComps: [], perimeters: [], foods: [], coach: COACH });
    expect(r.signals.find((s) => s.id === 'fatiga-dors')?.detail).toMatch(/HRR-60/);
    expect(r.proposals.find((p) => p.id === 'vol-dors')?.action).toEqual({ type: 'volume', muscle: 'dors', delta: expect.any(Number) });
    expect(r.signals.some((s) => s.tone === 'rezagado')).toBe(true);
  });

  it('proposes more rest-day kcal when losing too fast', () => {
    const weighIns: WeighIn[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(TODAY, -13 + i), kg: 80 - i * 0.1 }));
    const r = weeklyReview({ today: TODAY, profile: PROFILE, weightKg: 78, states: freshStates(), sessions: [], ex: EX, weighIns, bodyComps: [], perimeters: [], foods: [], coach: COACH });
    expect(r.proposals.find((p) => p.id === 'kcal-descanso')).toBeDefined();
  });
});
