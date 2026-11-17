import { bestView, exerciseHistory, muscleRoles } from '../exerciseDetail';
import { daysAgo, EX, session, TODAY } from './fixtures';

describe('exerciseDetail', () => {
  it('assigns roles to every muscle', () => {
    const r = muscleRoles(EX.pullup_bw);
    expect(r.dors).toBe('primary');
    expect(r.bic).toBe('secondary');
    expect(r.quad).toBe('none');
  });

  it('opens the body map on the useful side', () => {
    expect(bestView(EX.pullup_bw)).toBe('back');
    expect(bestView(EX.bench)).toBe('front');
    expect(bestView(EX.hipthrust)).toBe('back');
    expect(bestView(EX.legext)).toBe('front');
  });

  it('summarises history: last session, best set and weekly trend', () => {
    const sessions = [
      session(daysAgo(14), [{ id: 'bench', count: 3, load: 70, reps: 8 }]),
      session(daysAgo(2), [{ id: 'bench', count: 3, load: 75, reps: 6 }, { id: 'row', count: 2 }]),
    ];
    const h = exerciseHistory(sessions, EX.bench, 80, TODAY);
    expect(h.sessionsCount).toBe(2);
    expect(h.lastDate).toBe(daysAgo(2));
    expect(h.lastSets).toHaveLength(3);
    expect(h.best).toMatchObject({ load: 75, reps: 6 });
    expect(h.weekly).toHaveLength(8);
    expect(h.weekly[7]).toBeGreaterThan(0);
  });

  it('handles exercises never done and bodyweight ones', () => {
    expect(exerciseHistory([], EX.bench, 80, TODAY)).toMatchObject({ sessionsCount: 0, best: undefined, weekly: [] });
    const s = [session(daysAgo(1), [{ id: 'plank', count: 2, reps: 40 }]), session(daysAgo(3), [{ id: 'plank', count: 1, reps: 50 }])];
    const h = exerciseHistory(s, EX.plank, 80, TODAY);
    expect(h.best?.reps).toBe(50);
    expect(h.weekly).toEqual([]);
  });
});
