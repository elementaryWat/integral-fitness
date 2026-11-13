import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjustLoad, enqueue, loadLabel, nextPending, RepDetector, restAfter, restEnd } from '../shared/logic.js';

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

test('rest ends on HR recovery (after 20 s) or on time', () => {
  assert.equal(restEnd({ t: 10, hr: 100, target: 90, hrRule: true, threshold: 112 }), null);
  assert.equal(restEnd({ t: 25, hr: 110, target: 90, hrRule: true, threshold: 112 }), 'hr');
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
