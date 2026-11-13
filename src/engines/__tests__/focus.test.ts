import { SEED_EXERCISES } from '../../domain/catalog';
import { alternativesFor, applySwaps, generateFocused, groupStatus, recommendedGroups, relatedGroups } from '../focus';
import { estimateMinutes } from '../generator';
import { sanitizeSettings } from '../../store/seedMerge';
import { muscleStates } from '../volume';
import { EX, TODAY, daysAgo, noonMs, session } from './fixtures';

const fresh = () => muscleStates([], EX, TODAY, noonMs(TODAY));
const base = { exercises: SEED_EXERCISES, weeklyLowerShare: null, history: [], restSec: 90, deload: false };
const ids = (blocks: { items: { exerciseId: string }[] }[]) => blocks.flatMap((b) => b.items.map((i) => i.exerciseId));

describe('focused sessions', () => {
  it('only uses exercises of the chosen groups and fits the time', () => {
    const blocks = generateFocused({ ...base, minutes: 45, states: fresh(), groups: ['pecho', 'espalda'] });
    for (const id of ids(blocks)) expect(['pecho', 'dors', 'trap', 'lumb']).toContain(EX[id].primary[0]);
    expect(estimateMinutes(blocks, EX)).toBeLessThanOrEqual(45);
    expect(estimateMinutes(blocks, EX)).toBeGreaterThanOrEqual(38);
  });

  it('pairs push with pull in supersets', () => {
    const [a] = generateFocused({ ...base, minutes: 45, states: fresh(), groups: ['pecho', 'espalda'] });
    expect(a.items.map((i) => EX[i.exerciseId].pattern).sort()).toEqual(['empuje', 'traccion']);
  });

  it('covers every big muscle of a group before repeating one', () => {
    const blocks = generateFocused({ ...base, minutes: 60, states: fresh(), groups: ['piernas'] });
    const mains = ids(blocks).map((id) => EX[id].primary[0]);
    expect(mains).toEqual(expect.arrayContaining(['quad', 'glut', 'isq', 'gem']));
  });

  it('trains biceps and triceps separately, paired as antagonists', () => {
    const bi = generateFocused({ ...base, minutes: 35, states: fresh(), groups: ['biceps'] });
    expect(ids(bi).every((id) => ['bic', 'ante'].includes(EX[id].primary[0]))).toBe(true);
    const both = generateFocused({ ...base, minutes: 35, states: fresh(), groups: ['biceps', 'triceps'] });
    expect(both[0].items.map((i) => EX[i.exerciseId].primary[0]).sort()).toEqual(['bic', 'tri']);
    expect(relatedGroups(['biceps'], fresh())[0].group).toBe('triceps');
  });

  it('drops the old combined arms group from saved settings', () => {
    expect(sanitizeSettings({ focus: ['brazos', 'pecho'], swaps: { bench: 'pushup' } })).toEqual({ focus: ['pecho'], swaps: {} });
  });

  it('adds cardio only when chosen, and can be cardio alone', () => {
    const legs = generateFocused({ ...base, minutes: 60, states: fresh(), groups: ['piernas', 'cardio'] });
    expect(legs.some((b) => b.kind === 'cardio')).toBe(true);
    const only = generateFocused({ ...base, minutes: 45, states: fresh(), groups: ['cardio'] });
    expect(only).toHaveLength(1);
    expect(only[0].items[0].reps).toBeGreaterThanOrEqual(40);
  });
});

describe('recommendations', () => {
  it('flags recently trained groups as fatigued and recommends the rest', () => {
    const s = session(TODAY, [{ id: 'bench', count: 6 }, { id: 'dips', count: 4 }]);
    const st = muscleStates([s], EX, TODAY, noonMs(TODAY) + 2 * 3.6e6);
    expect(groupStatus(st, 'pecho').readiness).toBe('fatiga');
    expect(recommendedGroups(st)).not.toContain('pecho');
    expect(recommendedGroups(fresh()).length).toBeGreaterThan(0);
  });

  it('suggests antagonists first and skips fatigued ones', () => {
    expect(relatedGroups(['pecho'], fresh())[0].group).toBe('espalda');
    const s = session(daysAgo(0), [{ id: 'row', count: 8 }, { id: 'pull', count: 6 }]);
    const st = muscleStates([s], EX, TODAY, noonMs(TODAY) + 3.6e6);
    expect(relatedGroups(['pecho'], st).map((r) => r.group)).not.toContain('espalda');
  });

  it('lists related exercises and swaps them into the plan', () => {
    const alts = alternativesFor(EX.bench, SEED_EXERCISES, new Set());
    expect(alts.slice(0, 3).every((e) => e.primary[0] === 'pecho' && e.pattern === 'empuje')).toBe(true);
    const plan = generateFocused({ ...base, minutes: 35, states: fresh(), groups: ['pecho', 'espalda'] });
    const first = plan[0].items[0].exerciseId;
    const swapped = applySwaps(plan, { [first]: 'pushup' }, EX, [], false);
    expect(swapped[0].items[0].exerciseId).toBe('pushup');
    expect(swapped[0].items[0].sets).toBe(plan[0].items[0].sets);
  });
});
