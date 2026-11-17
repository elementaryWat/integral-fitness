import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avgValid, lastWeekByDate, sleepSummary, windowAvg, adjustLoad, adjustLoadBy, pendingOfBlock, remainingEstimate, enqueue, fineStep, hrRuleFrom, pendingOfExercise, skippedLog, hrr60From, loadLabel, nextPending, recoveryPeak, RepDetector, restAfter, restEnd } from '../shared/logic.js';

const q = [
  { qi: 0, block: 'A', set: 1 }, { qi: 1, block: 'A', set: 1 },
  { qi: 2, block: 'A', set: 2 }, { qi: 3, block: 'A', set: 2 },
  { qi: 4, block: 'B', set: 1 },
];

test('skips sets already logged (on the phone or the watch)', () => {
  assert.equal(nextPending(q, [0, 1]), 2);
  assert.equal(nextPending(q, [0, 2], 1), 1);
  assert.equal(nextPending(q, [0, 1, 2, 3, 4]), -1);
});

test('superset partner gets a 30 s transition; end of round gets the full rest', () => {
  assert.deepEqual(restAfter(q, 0, 90), { target: 30, hrRule: false });
  assert.deepEqual(restAfter(q, 1, 90), { target: 90, hrRule: true });
  assert.deepEqual(restAfter(q, 4, 90), { target: 90, hrRule: true });
});

test('rest ends on HR recovery (after max(60 s, 60 %)) or on time', () => {
  assert.equal(restEnd({ t: 10, hr: 100, target: 90, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 25, hr: 110, target: 90, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 60, hr: 110, target: 90, hrRule: true, threshold: 112 }), 'hr');
  // Long rest: a low pulse at 20 s or 90 s no longer cuts a 3-minute rest.
  assert.equal(hrRuleFrom(180), 108);
  assert.equal(restEnd({ t: 90, hr: 95, target: 180, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 110, hr: 95, target: 180, hrRule: true, threshold: 112 }), 'hr');
  // Short target: the rule cannot wait beyond the target itself.
  assert.equal(restEnd({ t: 45, hr: 95, target: 45, hrRule: true, threshold: 112 }), 'hr');
  assert.equal(restEnd({ t: 25, hr: 110, target: 30, hrRule: false, threshold: 112 }), null);
  assert.equal(restEnd({ t: 90, hr: 130, target: 90, hrRule: true, threshold: 112 }), 'time');
});

test('load steps and labels', () => {
  const lever = { step: 1, loadMode: 'palanca', levers: ['Tuck', 'Una pierna', 'Completo'] };
  assert.equal(adjustLoad(lever, 2, 1), 2);
  assert.equal(loadLabel(lever, 1), 'Una pierna');
  assert.equal(adjustLoad({ step: 2.5, loadMode: 'peso' }, 80, 1), 82.5);
  assert.equal(loadLabel({ loadMode: 'lastre' }, 15), '+15 kg');
});

test('detects repetition peaks and estimates velocity loss', () => {
  const d = new RepDetector();
  const peaks = [600, 580, 520, 450, 400];
  let t = 0;
  for (const p of peaks) {
    for (const a of [981, 981 + p / 2, 981 + p, 981 + p / 2, 981, 981, 981, 981]) d.push(0, 0, a, (t += 100));
  }
  assert.equal(d.reps, 5);
  assert.equal(d.velocityLoss(), Math.round((1 - 425 / 590) * 100) / 100);
  assert.equal(new RepDetector().velocityLoss(), undefined);
});

test('outbox replaces re-sent logs by id', () => {
  const box = enqueue(enqueue([], { log: { id: 'a', hrr60: undefined } }), { log: { id: 'a', hrr60: 30 } });
  assert.equal(box.length, 1);
  assert.equal(box[0].log.hrr60, 30);
});

test('peak includes the climb right after the set and HRR-60 uses it', () => {
  let peak = 150;
  peak = recoveryPeak(peak, 158, 8);
  peak = recoveryPeak(peak, 162, 15);
  assert.equal(peak, 162);
  assert.equal(recoveryPeak(peak, 170, 40), 162);
  assert.equal(recoveryPeak(peak, 0, 5), 162);
  assert.equal(hrr60From(162, 120), 42);
  assert.equal(hrr60From(162, 0), undefined);
});

test('a low reading before the post-set peak does not end the rest', () => {
  assert.equal(restEnd({ t: 10, hr: 100, target: 90, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 25, hr: 100, target: 90, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 60, hr: 100, target: 90, hrRule: true, threshold: 112 }), 'hr');
});

test('fine step for exact loads', () => {
  const bench = { step: 2.5, loadMode: 'peso' };
  assert.equal(fineStep(bench), 1);
  assert.equal(adjustLoadBy(bench, 65, 1, fineStep(bench)), 66);
  assert.equal(fineStep({ step: 1, loadMode: 'peso' }), 0.5);
  assert.equal(adjustLoadBy(bench, 100, 1, 2.5), 102.5);
});

test('skipping marks the slot without work', () => {
  const l = skippedLog('s1', { qi: 3, exerciseId: 'press', block: 'A' }, 1000);
  assert.equal(l.id, 's1-3');
  assert.equal(l.skipped, true);
  assert.equal(l.reps, 0);
  const qq = [
    { qi: 0, exerciseId: 'a' }, { qi: 1, exerciseId: 'b' }, { qi: 2, exerciseId: 'a' }, { qi: 3, exerciseId: 'b' }, { qi: 4, exerciseId: 'a' },
  ];
  assert.deepEqual(pendingOfExercise(qq, [0], 2), [2, 4]);
});

test('time left uses the plan first, then the real pace', () => {
  assert.deepEqual(remainingEstimate({ elapsedSec: 0, done: 0, total: 20, plannedSec: 2400 }), { remainingSec: 2400, pctLeft: 100 });
  assert.deepEqual(remainingEstimate({ elapsedSec: 600, done: 5, total: 20, plannedSec: 2400 }), { remainingSec: 1800, pctLeft: 75 });
});

test('skipping a superset takes every pending set of its block', () => {
  const qq = [
    { qi: 0, block: 'A', exerciseId: 'a' }, { qi: 1, block: 'A', exerciseId: 'b' }, { qi: 2, block: 'A', exerciseId: 'a' },
    { qi: 3, block: 'A', exerciseId: 'b' }, { qi: 4, block: 'B', exerciseId: 'c' },
  ];
  assert.deepEqual(pendingOfBlock(qq, [0], 1), [1, 2, 3]);
});

test('daily wellness helpers', () => {
  assert.equal(avgValid([0, 30, 0, 50]), 40);
  assert.equal(avgValid([0, 0]), undefined);
  const minutes = Array.from({ length: 600 }, (_, i) => (i < 420 ? 20 : 60));
  assert.equal(windowAvg(minutes, 0, 420), 20);
  const k = { WAKE_STAGE: 7, REM_STAGE: 8, LIGHT_STAGE: 4, DEEP_STAGE: 5 };
  const sum = sleepSummary({ totalTime: 430, deepTime: 65, score: 78 }, [{ model: 8, start: 10, stop: 100 }, { model: 4, start: 100, stop: 300 }, { model: 7, start: 300, stop: 315 }], k);
  assert.deepEqual(sum, { sleepMin: 430, deepSleepMin: 65, sleepScore: 78, remMin: 90, lightMin: 200, awakeMin: 15 });
  assert.deepEqual(sleepSummary({ totalTime: 0 }, [], k), {});
  const w = lastWeekByDate([1, 2, 3, 4, 5, 6, 7], '2026-11-02');
  assert.deepEqual([w[0], w[6]], [{ date: '2026-10-27', value: 1 }, { date: '2026-11-02', value: 7 }]);
});
