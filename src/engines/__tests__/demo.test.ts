import { SEED_EXERCISES } from '../../domain/catalog';
import { addDays, today } from '../../domain/dates';
import { buildDemoData } from '../../store/demo';
import { weeklyBalance } from '../balance';
import { weeklyReview } from '../coachRules';
import { recalibrate, weightSlope } from '../energy';
import { muscleStates } from '../volume';

const EX = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));

describe('demo data through the engines', () => {
  const d = buildDemoData();
  const day = today();

  it('creates ~4 weeks of sessions, weigh-ins and meals', () => {
    expect(d.sessions!.length).toBeGreaterThanOrEqual(18);
    expect(d.weighIns!.length).toBe(29);
    expect(d.sessions!.every((s) => s.sets.length > 0)).toBe(true);
  });

  it('keeps the weekly split near 80/20 and losing ~0.3 kg/wk', () => {
    const b = weeklyBalance(d.sessions!, EX, addDays(day, -7), day);
    expect(b.lowerShare).toBeGreaterThanOrEqual(0.17);
    expect(b.lowerShare).toBeLessThanOrEqual(0.25);
    expect(weightSlope(d.weighIns!, addDays(day, -13), day)!).toBeLessThan(0);
  });

  it('keeps weekly back volume under control (≤ MAV + 4)', () => {
    const st = muscleStates(d.sessions!, EX, day, Date.now());
    expect(st.dors.sets).toBeLessThanOrEqual(22);
  });

  it('produces a coach review with signals and a recalibration', () => {
    const states = muscleStates(d.sessions!, EX, day, Date.now());
    const r = weeklyReview({ today: day, profile: d.profile!, weightKg: 78.5, states, sessions: d.sessions!, ex: EX, weighIns: d.weighIns!, bodyComps: d.bodyComps!, perimeters: d.perimeters!, foods: d.foods!, coach: d.coach! });
    expect(r.hasData).toBe(true);
    expect(r.signals.length).toBeGreaterThan(0);
    expect(recalibrate({ weighIns: d.weighIns!, foods: d.foods!, tdeeOn: () => 2700, today: addDays(day, -1) })).not.toBeNull();
  });
});
