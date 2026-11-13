import { dailyToActivity } from '../relay';

describe('watch daily metrics', () => {
  it('keeps only positive watch values for the day', () => {
    expect(dailyToActivity('2026-11-13', { steps: 5400, restingHr: 54, deepSleepMin: 0, at: 1 })).toEqual({ date: '2026-11-13', steps: 5400, restingHr: 54 });
    expect(dailyToActivity('2026-11-13', { at: 1 })).toBeNull();
  });
});
