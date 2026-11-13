import type { ExerciseDraftRaw } from '../api';
import { exerciseFromDraft, macrosFor } from '../logic';

const per100 = { kcal: 100, p: 10, c: 20, f: 5 };

const draft = (over: Partial<ExerciseDraftRaw> = {}): ExerciseDraftRaw => ({
  name: 'Sentadilla',
  discipline: 'Pesas',
  loadMode: 'peso',
  pattern: 'pierna',
  plane: null,
  region: 'inferior',
  unit: 'reps',
  primary: ['quad'],
  secondary: ['glut'],
  step: 2.5,
  defaultLoad: 60,
  defaultReps: 8,
  repMin: 6,
  repMax: 10,
  levers: null,
  legImpact: null,
  notes: '',
  ...over,
});

describe('macrosFor', () => {
  it('scales per-100 g values to the given grams', () => {
    expect(macrosFor(per100, 250)).toEqual({ kcal: 250, p: 25, c: 50, f: 12.5 });
    expect(macrosFor(per100, 33)).toEqual({ kcal: 33, p: 3.3, c: 6.6, f: 1.7 });
  });

  it('treats zero and negative grams as nothing', () => {
    expect(macrosFor(per100, 0)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
    expect(macrosFor(per100, -40)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 });
  });
});

describe('exerciseFromDraft', () => {
  it('keeps two known primary muscles and drops unknown or repeated ones', () => {
    const e = exerciseFromDraft(draft({
      primary: ['pecho', 'nope', 'delt', 'bic', 'pecho'],
      secondary: ['pecho', 'tri', 'zzz'],
      pattern: 'empuje',
      plane: 'horizontal',
    }));
    expect(e.primary).toEqual(['pecho', 'delt']);
    expect(e.secondary).toEqual(['tri']);
    expect(e.region).toBe('superior');
  });

  it('drops a lever progression that has fewer than two levels', () => {
    const e = exerciseFromDraft(draft({ loadMode: 'palanca', levers: ['Solo'], step: 5, defaultLoad: 20 }));
    expect(e.levers).toBeUndefined();
    expect(e.step).toBe(1);
    expect(e.defaultLoad).toBe(0);
  });

  it('keeps a lever list and ignores load numbers', () => {
    const e = exerciseFromDraft(draft({ loadMode: 'palanca', levers: ['Tuck', 'Completo'], defaultLoad: 40, step: 2.5 }));
    expect(e.levers).toEqual(['Tuck', 'Completo']);
    expect(e.step).toBe(1);
    expect(e.defaultLoad).toBe(0);
  });

  it('repairs an inverted rep range and clamps the target inside it', () => {
    const e = exerciseFromDraft(draft({ repMin: 15, repMax: 8, defaultReps: 10 }));
    expect(e.repRange).toEqual([15, 15]);
    expect(e.defaultReps).toBe(15);
  });

  it('falls back when enums, muscles or the name are unusable', () => {
    const e = exerciseFromDraft(draft({
      name: '   ',
      discipline: 'Yoga',
      loadMode: 'maquina',
      pattern: 'foo',
      unit: 'km',
      primary: ['biceps'],
      secondary: [],
      repMin: -3,
      plane: 'vertical',
    }));
    expect(e.name).toBe('Ejercicio nuevo');
    expect(e.discipline).toBe('Pesas');
    expect(e.loadMode).toBe('peso');
    expect(e.pattern).toBe('aislamiento');
    expect(e.unit).toBe('reps');
    expect(e.primary).toEqual([]);
    expect(e.region).toBe('superior');
    expect(e.plane).toBeUndefined();
    expect(e.repRange[0]).toBe(8);
    expect(e.custom).toBe(true);
  });

  it('takes the region from the main muscle and the plane only for push or pull', () => {
    const abs = exerciseFromDraft(draft({ pattern: 'aislamiento', region: 'superior', primary: ['abs'], plane: 'vertical' }));
    expect(abs.region).toBe('core');
    expect(abs.plane).toBeUndefined();

    const push = exerciseFromDraft(draft({ pattern: 'empuje', primary: ['pecho'], plane: 'vertical' }));
    expect(push.plane).toBe('vertical');

    const leg = exerciseFromDraft(draft({ pattern: 'pierna', plane: 'vertical' }));
    expect(leg.plane).toBeUndefined();
    expect(leg.region).toBe('inferior');
  });

  it('keeps leg impact only for cardio', () => {
    expect(exerciseFromDraft(draft({ discipline: 'Cardio', pattern: 'aerobico', primary: [], legImpact: 'alto' })).legImpact).toBe('alto');
    expect(exerciseFromDraft(draft({ discipline: 'Cardio', pattern: 'aerobico', primary: [], legImpact: 'medio' })).legImpact).toBe('bajo');
    expect(exerciseFromDraft(draft({ legImpact: 'alto' })).legImpact).toBeUndefined();
    expect(exerciseFromDraft(draft({ pattern: 'aerobico', primary: [], discipline: 'Pesas' })).region).toBe('inferior');
  });

  it('cuts a long name to 60 characters', () => {
    const e = exerciseFromDraft(draft({ name: 'A'.repeat(80) }));
    expect(e.name).toHaveLength(60);
  });
});
