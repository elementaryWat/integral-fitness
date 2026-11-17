import type { PlannedBlock, Session, SetLog } from '../../domain/types';
import { sessionMetrics } from '../efficiency';
import { buildQueue } from '../generator';
import { blockTimes, firstPending, pendingOfBlock, realRests, remainingEstimate, restStats, sessionExercises, hrRuleFrom, rebuildSession, sessionProgress, sessionSummary, skippedSet } from '../liveSession';
import { removeExercise, replaceExercise, addBlock } from '../planEdit';
import { EX, session, TODAY } from './fixtures';

const ctx = { ex: EX, history: [], deload: false, restSec: 90 };
const plan = (): PlannedBlock[] => [
  { key: 'A', title: '', kind: 'superserie', restSec: 90, items: [{ exerciseId: 'bench', sets: 3, load: 80, reps: 8 }, { exerciseId: 'row', sets: 3, load: 70, reps: 10 }] },
  { key: 'B', title: '', kind: 'superserie', restSec: 90, items: [{ exerciseId: 'curl', sets: 3, load: 14, reps: 10 }] },
];
const log = (qi: number, s: Session, extra: Partial<SetLog> = {}): SetLog => {
  const q = s.queue[qi];
  return { id: `l${qi}`, qi, exerciseId: q.exerciseId, block: q.block, load: q.load, reps: q.reps, rpe: 8, startedAt: 1000 * qi, endedAt: 1000 * qi + 500, ...extra };
};
const active = (): Session => {
  const blocks = plan();
  const s: Session = { id: 'a', date: TODAY, plannedMinutes: 45, startedAt: 0, blocks, queue: buildQueue(blocks), sets: [], deload: false };
  // A1 bench S1, A2 row S1, A1 bench S2 done
  return { ...s, sets: [log(0, s), log(1, s), log(2, s)] };
};

describe('rest rule shared with the watch', () => {
  it('a recovered pulse ends a rest only after max(60 s, 60 %)', () => {
    expect(hrRuleFrom(90)).toBe(60);
    expect(hrRuleFrom(180)).toBe(108);
    expect(hrRuleFrom(45)).toBe(45);
  });
});

describe('live session editing', () => {
  it('replacing an exercise keeps its logged sets and leaves only the remaining ones', () => {
    const a = active();
    const r = rebuildSession(a, replaceExercise(a.blocks, 0, 0, EX.db_bench, ctx), 'b');
    expect(r.id).toBe('b');
    expect(r.sets.map((l) => [l.qi, l.exerciseId])).toEqual([[0, 'bench'], [1, 'row'], [2, 'bench']]);
    const pending = r.queue.slice(3).map((q) => `${q.block}${q.pos}${q.exerciseId}#${q.set}`);
    // bench sets 1–2 were done: db_bench only does set 3; row still has 2 and 3; curl untouched.
    expect(pending).toEqual(['A2row#2', 'A1db_bench#3', 'A2row#3', 'B1curl#1', 'B1curl#2', 'B1curl#3']);
    expect(firstPending(r.queue, r.sets)).toBe(3);
  });

  it('adds a block at the end and removes a pending exercise', () => {
    const a = active();
    let blocks = addBlock(a.blocks, EX.squat, ctx);
    blocks = removeExercise(blocks, 1, 0, EX);
    const r = rebuildSession(a, blocks, 'c');
    expect(r.queue.some((q) => q.exerciseId === 'curl')).toBe(false);
    expect(r.queue.filter((q) => q.exerciseId === 'squat').map((q) => q.block)).toEqual(['B', 'B', 'B']);
    expect(r.queue).toHaveLength(3 + 3 + 3);
  });

  it('skipped sets mark progress but are not work', () => {
    const a = active();
    const withSkip = { ...a, sets: [...a.sets, skippedSet('a', 3, a.queue[3], 5000)] };
    expect(sessionProgress(withSkip)).toEqual({ done: 4, total: 9, skipped: 1 });
    expect(firstPending(withSkip.queue, withSkip.sets)).toBe(4);
    expect(sessionMetrics(withSkip, EX, 80).tonnage).toBe(sessionMetrics(a, EX, 80).tonnage);
  });
});

describe('session summary', () => {
  it('counts work sets, HR and records against earlier sessions', () => {
    const prev = session('2026-11-05', [{ id: 'bench', count: 2, load: 80, reps: 8 }]);
    const now = session(TODAY, [{ id: 'bench', count: 2, load: 85, reps: 8 }, { id: 'curl', count: 1 }]);
    now.sets[0].hrPeak = 150;
    now.sets[1].hrPeak = 160;
    const sum = sessionSummary(now, [prev, now], EX, 80);
    expect(sum.sets).toBe(3);
    expect(sum.exercises).toBe(2);
    expect(sum.hrMax).toBe(160);
    expect(sum.hrAvgPeak).toBe(155);
    expect(sum.records.map((r) => r.exerciseId)).toEqual(['bench']);
    expect(sum.muscles[EX.bench.primary[0]]?.primary).toBe(true);
  });
});

describe('session exercises', () => {
  it('groups work sets by exercise in order, without skipped ones', () => {
    const a = active();
    const withSkip = { ...a, sets: [...a.sets, skippedSet('a', 3, a.queue[3], 5000)] };
    const list = sessionExercises(withSkip, EX, 80);
    expect(list.map((g) => [g.slot, g.exerciseId, g.sets.length])).toEqual([['A1', 'bench', 2], ['A2', 'row', 1]]);
    expect(list[0].tonnage).toBe(2 * 80 * 8);
    expect(list[0].topLoad).toBe(80);
  });
});

describe('times and rests', () => {
  // log(qi) starts at 1000·qi and lasts 500 ms → 0.5 s gaps; use explicit times instead.
  const timed = (): Session => {
    const a = active();
    const t = [[0, 40], [70, 110], [200, 240]]; // A1 S1, A2 S1 (30 s transition), A1 S2 (90 s rest)
    return { ...a, sets: a.sets.map((l, i) => ({ ...l, startedAt: t[i][0] * 1000, endedAt: t[i][1] * 1000 })) };
  };

  it('measures the real rest before each set and splits transitions from full rests', () => {
    const s = timed();
    const r = realRests(s.sets);
    expect([...r.values()]).toEqual([30, 90]);
    const st = restStats(s, 90);
    expect(st.transition).toEqual({ count: 1, avg: 30 });
    expect(st.full).toMatchObject({ count: 1, avg: 90, max: 90, overTarget: 0 });
  });

  it('times each exercise and block', () => {
    const s = timed();
    const bench = sessionExercises(s, EX, 80)[0];
    expect(bench.durationSec).toBe(240);
    expect(bench.avgSetSec).toBe(40);
    expect(bench.restBefore).toEqual([undefined, 90]);
    expect(blockTimes(s)).toEqual([{ block: 'A', durationSec: 240, rounds: 2, sets: 3 }]);
  });

  it('estimates the time left from the real pace, or the plan at the start', () => {
    expect(remainingEstimate({ elapsedSec: 0, done: 0, total: 20, plannedSec: 2400 })).toEqual({ remainingSec: 2400, pctLeft: 100 });
    expect(remainingEstimate({ elapsedSec: 600, done: 5, total: 20, plannedSec: 2400 })).toEqual({ remainingSec: 1800, pctLeft: 75 });
    expect(remainingEstimate({ elapsedSec: 900, done: 20, total: 20, plannedSec: 2400 }).pctLeft).toBe(0);
  });
});

describe('skip superset', () => {
  it('lists every pending set of the current block', () => {
    const a = active(); // A1 S1, A2 S1, A1 S2 done
    expect(pendingOfBlock(a.queue, a.sets, 3)).toEqual([3, 4, 5]);
  });
});
