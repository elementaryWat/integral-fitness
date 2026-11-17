import type { Session } from '../../domain/types';
import { planStreak, weekStreak, weekStrip } from '../streak';
import { session } from './fixtures';

// 2026-11-12 is a Thursday; that week runs Mon 9 → Sun 15.
const TODAY = '2026-11-12';
const MON_WED_FRI = [1, 3, 5];
const train = (...dates: string[]): Session[] => dates.map((d) => session(d, [{ id: 'bench', count: 1 }]));
const base = { trainingDays: MON_WED_FRI, today: TODAY, startDate: '2026-10-19' };

describe('weekStrip', () => {
  it('marks done, missed, today, planned and rest days', () => {
    const strip = weekStrip({ ...base, sessions: train('2026-11-09') });
    expect(strip.map((d) => d.letter).join('')).toBe('LMXJVSD');
    expect(strip.map((d) => d.state)).toEqual(['done', 'rest', 'missed', 'rest', 'planned', 'rest', 'rest']);
  });

  it('an extra day covers a missed one; a live session shows as live', () => {
    const strip = weekStrip({ ...base, sessions: train('2026-11-09', '2026-11-11'), today: '2026-11-13', activeToday: true });
    expect(strip.map((d) => d.state).slice(0, 5)).toEqual(['done', 'rest', 'done', 'rest', 'live']);
    expect(weekStrip({ ...base, sessions: train('2026-11-10') })[1].state).toBe('extra');
    const covered = weekStrip({ ...base, sessions: train('2026-11-09', '2026-11-10') });
    expect(covered[2].state).toBe('rest');
  });

  it('today pending is highlighted, not missed', () => {
    const strip = weekStrip({ ...base, today: '2026-11-11', sessions: [] });
    expect(strip[2]).toMatchObject({ state: 'today', isToday: true });
  });
});

describe('weekStreak', () => {
  it('counts consecutive complete weeks and the current one only when done', () => {
    const s = train('2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09');
    expect(weekStreak({ ...base, sessions: s })).toEqual({ current: 3, best: 3, thisWeek: { done: 1, goal: 3 } });
    const full = [...s, ...train('2026-11-10', '2026-11-11')];
    expect(weekStreak({ ...base, sessions: full }).current).toBe(4);
  });

  it('an incomplete past week breaks it and best remembers', () => {
    const s = train('2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-09');
    expect(weekStreak({ ...base, sessions: s })).toMatchObject({ current: 0, best: 2 });
  });

  it('a partial first week asks only for the planned days left', () => {
    expect(weekStreak({ ...base, startDate: '2026-11-05', today: '2026-11-12', sessions: train('2026-11-06') }).current).toBe(1);
  });

  it('works with no sessions', () => {
    expect(weekStreak({ ...base, sessions: [] })).toEqual({ current: 0, best: 0, thisWeek: { done: 0, goal: 3 } });
  });
});

describe('planStreak', () => {
  it('skips rest days and does not break on today', () => {
    const s = train('2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11');
    expect(planStreak({ ...base, sessions: s, today: '2026-11-13' }).current).toBe(5);
  });

  it('a missed planned day breaks it unless made up that week', () => {
    const wed = { ...base, today: '2026-11-11' };
    expect(planStreak({ ...wed, sessions: train('2026-11-02', '2026-11-06', '2026-11-09') }).current).toBe(2);
    expect(planStreak({ ...wed, sessions: train('2026-11-02', '2026-11-05', '2026-11-06', '2026-11-09') }).current).toBe(4);
    expect(planStreak({ ...base, sessions: train('2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09') }).current).toBe(0);
  });
});
