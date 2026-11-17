import { MUSCLE_KEYS, type MuscleKey } from '../../domain/muscles';
import type { DailyActivity } from '../../domain/types';
import { dayAdvice, lastWeek, recoveryScore } from '../recovery';
import type { MuscleState } from '../volume';

const DAY = '2026-11-14';
const base = (d: string, x: Partial<DailyActivity> = {}): DailyActivity => ({ date: d, restingHr: 58, nightStress: 25, sleepMin: 450, deepSleepMin: 90, ...x });

describe('recoveryScore', () => {
  it('works without HRV: provisional with fewer than 3 baseline days', () => {
    const r = recoveryScore([base('2026-11-13'), base(DAY, { restingHr: 59, deepSleepMin: 65, sleepMin: 420 })], DAY);
    expect(r.provisional).toBe(true);
    expect(r.baseDays).toBe(1);
    expect(r.score).not.toBeNull();
    expect(r.sleep).toMatchObject({ min: 420, deepPct: 15 });
    expect(r.stress).toMatchObject({ value: 25, night: true });
  });

  it('with a baseline, worse resting HR and stress lower the score', () => {
    const hist = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) => base(d));
    const good = recoveryScore([...hist, base(DAY)], DAY);
    const bad = recoveryScore([...hist, base(DAY, { restingHr: 64, nightStress: 45 })], DAY);
    expect(good.provisional).toBe(false);
    expect(bad.score!).toBeLessThan(good.score! - 15);
    expect(bad.restingHr?.vsBaseline).toBe(6);
  });

  it('no data today → no score', () => {
    expect(recoveryScore([base('2026-11-13')], DAY).score).toBeNull();
  });

  it('lastWeek lines up 7 days with gaps', () => {
    expect(lastWeek([base('2026-11-12'), base(DAY)], DAY, (a) => a.restingHr)).toEqual([null, null, null, null, 58, null, 58]);
  });
});

describe('dayAdvice', () => {
  const states = (low: MuscleKey[] = []) =>
    Object.fromEntries(MUSCLE_KEYS.map((k) => [k, { key: k, sets: 2, target: 10, rec: low.includes(k) ? 33 : 100, status: low.includes(k) ? 'f' : 'b', note: '' }])) as unknown as Record<MuscleKey, MuscleState>;

  it('levels follow the score and name the muscles to avoid', () => {
    expect(dayAdvice(30, states()).level).toBe('descanso');
    expect(dayAdvice(50, states()).level).toBe('suave');
    expect(dayAdvice(70, states()).level).toBe('normal');
    const a = dayAdvice(85, states(['dors']));
    expect(a.level).toBe('fuerte');
    expect(a.detail).toMatch(/dorsal ancho \(33 %\)/);
  });
});
