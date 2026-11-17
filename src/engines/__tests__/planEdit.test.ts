import { SEED_EXERCISES } from '../../domain/catalog';
import { alternativesFor } from '../focus';
import { estimateMinutes } from '../generator';
import { musclesWorked, blocksFromAi, addBlock, addToBlock, fromRoutine, mergeWithNext, moveBlock, removeExercise, replaceExercise, setRounds, splitOut, toRoutine } from '../planEdit';
import type { PlannedBlock } from '../../domain/types';
import { EX } from './fixtures';

const ctx = { ex: EX, history: [], deload: false, restSec: 90 };
const plan = (): PlannedBlock[] => [
  { key: 'A', title: '', kind: 'superserie', restSec: 90, items: [{ exerciseId: 'bench', sets: 3, load: 80, reps: 8 }, { exerciseId: 'row', sets: 3, load: 70, reps: 10 }] },
  { key: 'B', title: '', kind: 'superserie', restSec: 90, items: [{ exerciseId: 'curl', sets: 3, load: 14, reps: 10 }] },
];
const ids = (b: PlannedBlock[]) => b.map((x) => `${x.key}:${x.items.map((i) => i.exerciseId).join('+')}`);

describe('plan editing', () => {
  it('replaces, adds and removes exercises, re-lettering blocks and titles', () => {
    let p = replaceExercise(plan(), 0, 0, EX.db_bench, ctx);
    expect(p[0].items[0]).toMatchObject({ exerciseId: 'db_bench', sets: 3 });
    expect(p[0].title).toBe('Pecho + Dorsal');
    p = addToBlock(p, 1, EX.triext, ctx);
    expect(ids(p)).toEqual(['A:db_bench+row', 'B:curl+triext']);
    p = removeExercise(removeExercise(p, 1, 0, EX), 1, 0, EX);
    expect(ids(p)).toEqual(['A:db_bench+row']);
    expect(addBlock(p, EX.squat, ctx).at(-1)).toMatchObject({ key: 'B', title: 'Cuádriceps' });
  });

  it('changes rounds, reorders, splits and merges supersets', () => {
    let p = setRounds(plan(), 0, 5, EX);
    expect(p[0].items.map((i) => i.sets)).toEqual([5, 5]);
    p = moveBlock(p, 1, -1, EX);
    expect(ids(p)).toEqual(['A:curl', 'B:bench+row']);
    p = splitOut(p, 1, 1, EX);
    expect(ids(p)).toEqual(['A:curl', 'B:bench', 'C:row']);
    p = mergeWithNext(p, 0, EX);
    expect(ids(p)).toEqual(['A:curl+bench', 'B:row']);
    expect(p[0].items[1].sets).toBe(3);
  });

  it('saves and reloads a routine with fresh prescriptions', () => {
    const r = toRoutine('Torso A', plan(), 'r1', '2026-11-13');
    expect(r.blocks).toEqual([{ exerciseIds: ['bench', 'row'], rounds: 3 }, { exerciseIds: ['curl'], rounds: 3 }]);
    expect(ids(fromRoutine(r, ctx))).toEqual(['A:bench+row', 'B:curl']);
    expect(fromRoutine(r, { ...ctx, deload: true })[0].items[0].sets).toBe(2);
  });
});

describe('alternatives', () => {
  it('keeps the movement plane: rows before vertical pulls', () => {
    const alts = alternativesFor(EX.db_row, SEED_EXERCISES, new Set(['row']), 2);
    expect(alts.every((e) => e.plane === 'horizontal' && e.primary[0] === 'dors')).toBe(true);
  });

  it('suggests hinge work before back exercises for a lower-back movement', () => {
    const alts = alternativesFor(EX.backext, SEED_EXERCISES, new Set(), 4);
    expect(alts.every((e) => e.pattern === 'bisagra')).toBe(true);
  });
});

describe('AI routine', () => {
  it('drops unknown or repeated exercises, caps sizes and fits the time', () => {
    const res = { name: 'Torso', rationale: '', blocks: [
      { exerciseIds: ['bench', 'row', 'bench', 'ghost'], rounds: 9 },
      { exerciseIds: ['ghost'], rounds: 3 },
      { exerciseIds: ['ohp', 'pull'], rounds: 4 },
      { exerciseIds: ['curl', 'triext'], rounds: 4 },
    ] };
    const b = blocksFromAi(res, ctx, 35);
    expect(b.map((x) => x.items.map((i) => i.exerciseId))).toEqual([['bench', 'row'], ['ohp', 'pull'], ['curl', 'triext']].slice(0, b.length));
    expect(b[0].items[0].sets).toBeLessThanOrEqual(6);
    expect(estimateMinutes(b, EX)).toBeLessThanOrEqual(35);
  });
});

describe('muscles worked', () => {
  it('counts primary sets fully and secondary at half, listing the exercises', () => {
    const w = musclesWorked(plan(), EX);
    expect(w.pecho).toEqual({ sets: 3, primary: true, exercises: ['Press banca'] });
    expect(w.tri?.primary).toBe(false);
    expect(w.tri?.sets).toBe(1.5);
    expect(w.quad).toBeUndefined();
  });
});
