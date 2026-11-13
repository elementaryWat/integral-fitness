import { groupOf, MUSCLE_GROUPS, SEED_EXERCISES } from '../../domain/catalog';
import { addDays } from '../../domain/dates';
import { withSeedExercises } from '../../store/seedMerge';
import type { WeighIn } from '../../domain/types';
import { weeklyReview } from '../coachRules';
import { dayEnergy } from '../energy';
import { generateSession } from '../generator';
import { deficitFor, targetRate, weeksToTarget } from '../goals';
import { muscleStates } from '../volume';
import { COACH, EX, PROFILE, TODAY, noonMs } from './fixtures';

describe('goals', () => {
  it('maps goal and pace to a weekly rate and a daily kcal adjustment', () => {
    expect(targetRate('definir', 'moderado', 80)).toBeCloseTo(-0.48);
    expect(targetRate('recomp', 'rapido', 80)).toBeCloseTo(-0.24); // pace ignored for recomp
    expect(targetRate('mantener', 'rapido', 80)).toBe(0);
    expect(deficitFor(-0.48)).toBe(525);
    expect(deficitFor(0.2)).toBe(-225);
    expect(deficitFor(0)).toBe(0);
  });

  it('estimates weeks to the target weight only in the goal direction', () => {
    expect(weeksToTarget(80, 76, -0.48)).toBe(9);
    expect(weeksToTarget(80, 84, -0.48)).toBeNull();
    expect(weeksToTarget(80, undefined, -0.48)).toBeNull();
  });

  it('uses the activity level as NEAT baseline when nothing is logged', () => {
    const base = { weightKg: 78, trainKcal: 0, coach: COACH, dayType: 'Descanso' as const };
    const low = dayEnergy({ ...base, profile: { ...PROFILE, activityLevel: 'sedentario' } });
    const high = dayEnergy({ ...base, profile: { ...PROFILE, activityLevel: 'muy-activo' } });
    expect(high.neat).toBeGreaterThan(low.neat);
  });

  it('judges the weight trend against the profile goal', () => {
    // Gaining 0.2 kg/wk: fine for a lean bulk, too much for a cut.
    const weighIns: WeighIn[] = Array.from({ length: 14 }, (_, i) => ({ date: addDays(TODAY, -13 + i), kg: 78 + i * (0.2 / 7) }));
    const states = muscleStates([], EX, TODAY, noonMs(TODAY));
    const input = { today: TODAY, weightKg: 78, states, sessions: [], ex: EX, weighIns, bodyComps: [], perimeters: [], foods: [], coach: COACH };
    const bulk = weeklyReview({ ...input, profile: { ...PROFILE, goal: 'volumen', targetRateKgWk: 0.2 } });
    const cut = weeklyReview({ ...input, profile: { ...PROFILE, goal: 'definir', targetRateKgWk: -0.48 } });
    expect(bulk.proposals.some((p) => p.action.type === 'kcal')).toBe(false);
    expect(cut.proposals.find((p) => p.id === 'kcal-menos')).toBeDefined();
  });
});

describe('exercise catalog', () => {
  it('adds new built-in exercises to a stored list without overwriting user edits', () => {
    const merged = withSeedExercises([{ ...EX.bench, name: 'Mi press' }]);
    expect(merged.find((e) => e.id === 'bench')?.name).toBe('Mi press');
    expect(merged.length).toBe(SEED_EXERCISES.length);
  });

  it('gives every exercise a unique id and a muscle group', () => {
    const ids = SEED_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(70);
    const groups = new Set(SEED_EXERCISES.map(groupOf));
    expect([...groups].sort()).toEqual(MUSCLE_GROUPS.map((g) => g.key).sort());
  });
});

describe('generator with the full catalog', () => {
  const fresh = () => muscleStates([], EX, TODAY, noonMs(TODAY));
  const ids = (experience?: 'intermedio' | 'avanzado') =>
    generateSession({ minutes: 60, exercises: SEED_EXERCISES, states: fresh(), weeklyLowerShare: null, history: [], restSec: 90, deload: false, experience })
      .flatMap((b) => b.items.map((i) => i.exerciseId));

  it('keeps advanced lifts out unless the lifter is advanced', () => {
    const normal = ids('intermedio');
    expect(normal.some((id) => EX[id].advanced)).toBe(false);
    expect(normal).toEqual(expect.arrayContaining(['bench', 'row', 'pull']));
  });

  it('fills the accessory block only with shoulder and arm work', () => {
    const d = generateSession({ minutes: 45, exercises: SEED_EXERCISES, states: fresh(), weeklyLowerShare: 0.3, history: [], restSec: 90, deload: false })
      .find((b) => b.key === 'D')!;
    for (const it of d.items) expect(['delt', 'deltp', 'bic', 'tri', 'ante', 'trap']).toContain(EX[it.exerciseId].primary[0]);
  });
});
