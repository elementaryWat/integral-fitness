import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelay } from '../src/relay.js';

async function withRelay(fn) {
  const { server } = createRelay();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call); } finally { server.close(); }
}

const session = { id: 's1', queue: [{ qi: 0 }, { qi: 1 }, { qi: 2 }], doneQis: [] };
const log = (id, qi, extra = {}) => ({ id, qi, exerciseId: 'bench', block: 'A', load: 80, reps: 8, rpe: 8, startedAt: 1, endedAt: 2, ...extra });

test('health and code validation', () => withRelay(async (call) => {
  assert.equal((await call('GET', '/health')).body.ok, true);
  assert.equal((await call('GET', '/v1/bad!/session')).status, 400);
  assert.equal((await call('GET', '/v1/ABC123/session')).body.session, null);
}));

test('phone pushes a session, watch logs sets, phone polls them', () => withRelay(async (call) => {
  await call('PUT', '/v1/ABC123/session', { session });
  const r1 = await call('POST', '/v1/ABC123/sets', { sessionId: 's1', log: log('a', 0) });
  assert.deepEqual(r1.body.doneQis, [0]);
  const polled = await call('GET', '/v1/ABC123/sets?since=0');
  assert.equal(polled.body.sets.length, 1);
  // HRR-60 arrives later as an upsert of the same id with a newer seq.
  await call('POST', '/v1/ABC123/sets', { sessionId: 's1', log: log('a', 0, { hrr60: 31 }) });
  const later = await call('GET', `/v1/ABC123/sets?since=${polled.body.seq}`);
  assert.equal(later.body.sets.length, 1);
  assert.equal(later.body.sets[0].hrr60, 31);
}));

test('phone-logged sets show as done for the watch; stale sessions are rejected', () => withRelay(async (call) => {
  await call('PUT', '/v1/ABC123/session', { session: { ...session, doneQis: [0] } });
  assert.deepEqual((await call('GET', '/v1/ABC123/session')).body.doneQis, [0]);
  assert.equal((await call('POST', '/v1/ABC123/sets', { sessionId: 'old', log: log('x', 1) })).status, 409);
  assert.equal((await call('POST', '/v1/ABC123/sets', { sessionId: 's1', log: { id: 'x' } })).status, 400);
  await call('DELETE', '/v1/ABC123/session');
  assert.equal((await call('GET', '/v1/ABC123/session')).body.session, null);
}));

test('live heart rate', () => withRelay(async (call) => {
  await call('POST', '/v1/ABC123/live', { hr: 141, mode: 'set', qi: 2 });
  const { live } = (await call('GET', '/v1/ABC123/live')).body;
  assert.equal(live.hr, 141);
  assert.equal(live.mode, 'set');
}));

test('daily wearable metrics are merged per date and validated', () => withRelay(async (call) => {
  assert.equal((await call('POST', '/v1/ABC123/daily', { date: 'hoy', steps: 10 })).status, 400);
  await call('POST', '/v1/ABC123/daily', { date: '2026-11-13', steps: 5400, restingHr: 54, sleepMin: -1 });
  await call('POST', '/v1/ABC123/daily', { date: '2026-11-13', deepSleepMin: 82 });
  const { days } = (await call('GET', '/v1/ABC123/daily')).body;
  assert.equal(days['2026-11-13'].steps, 5400);
  assert.equal(days['2026-11-13'].deepSleepMin, 82);
  assert.equal(days['2026-11-13'].sleepMin, undefined);
}));
