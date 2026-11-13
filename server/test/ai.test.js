import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAi } from '../src/ai/client.js';
import { Quota } from '../src/ai/routes.js';
import { createRelay } from '../src/relay.js';

const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');

/** Fake OpenAI client: records requests and answers with canned JSON per schema name. */
function fakeClient(answers) {
  const calls = [];
  return {
    calls,
    responses: {
      create: async (req) => {
        calls.push(req);
        const name = req.text.format.name;
        if (answers[name] instanceof Error) throw answers[name];
        if (answers[name] === 'refusal') return { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No puedo.' }] }], output_text: '' };
        return { status: 'completed', output: [], output_text: JSON.stringify(answers[name]) };
      },
    },
  };
}

async function withServer(client, fn, { codes = ['ABC123'], limit = 60 } = {}) {
  const ai = { ai: createAi({ client, model: 'test-model' }), quota: new Quota(limit), codes: new Set(codes) };
  const { server } = createRelay({ ai });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call); } finally { server.close(); }
}

const scan = { kind: 'plato', title: 'Pollo con arroz', items: [{ name: 'Pechuga', grams: 150, kcal: 248, p: 46.5, c: 0, f: 5.4, per100: null, confidence: 'media' }], notes: '' };

test('scans a plate with a strict json_schema request and the image as input_image', async () => {
  const client = fakeClient({ food_scan: scan });
  await withServer(client, async (call) => {
    const r = await call('POST', '/v1/abc123/ai/scan', { image: IMG, hint: 'plato' });
    assert.equal(r.status, 200);
    assert.equal(r.body.items[0].name, 'Pechuga');
    const req = client.calls[0];
    assert.equal(req.model, 'test-model');
    assert.equal(req.text.format.type, 'json_schema');
    assert.equal(req.text.format.strict, true);
    assert.deepEqual(req.input[0].content.map((c) => c.type), ['input_text', 'input_image']);
    assert.equal(req.input[0].content[1].image_url, IMG);
  });
});

test('rejects codes without access, bad images and over-quota calls before spending', async () => {
  const client = fakeClient({ food_scan: scan, exercise_draft: {} });
  await withServer(client, async (call) => {
    assert.equal((await call('POST', '/v1/ZZZ999/ai/scan', { image: IMG })).status, 403);
    assert.equal((await call('POST', '/v1/ABC123/ai/scan', { image: 'http://x/y.jpg' })).status, 400);
    assert.equal((await call('POST', '/v1/ABC123/ai/exercise', { text: 'x' })).status, 400);
    assert.equal(client.calls.length, 0);
    assert.equal((await call('POST', '/v1/ABC123/ai/scan', { image: IMG })).status, 200);
    const over = await call('POST', '/v1/ABC123/ai/scan', { image: IMG });
    assert.equal(over.status, 429);
    assert.equal(over.body.code, 'quota');
    assert.equal(client.calls.length, 1);
  }, { limit: 1 });
});

test('maps refusals and missing configuration to clear errors', async () => {
  await withServer(fakeClient({ food_scan: 'refusal' }), async (call) => {
    const r = await call('POST', '/v1/ABC123/ai/scan', { image: IMG });
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'ai_refusal');
  });
  await withServer(null, async (call) => {
    const r = await call('POST', '/v1/ABC123/ai/exercise', { text: 'press inclinado' });
    assert.equal(r.status, 503);
    assert.equal((await call('GET', '/v1/ABC123/ai/status')).body.enabled, false);
  });
});

test('coach review sends both photos only when two are provided', async () => {
  const client = fakeClient({ coach_narrative: { headline: 'Buena semana', summary: 'x', wins: [], watch: [], photoNote: null } });
  await withServer(client, async (call) => {
    await call('POST', '/v1/ABC123/ai/coach', { review: { headline: 'h' }, stats: {} });
    await call('POST', '/v1/ABC123/ai/coach', { review: { headline: 'h' }, photos: [IMG, IMG] });
    assert.equal(client.calls[0].input[0].content.length, 1);
    assert.equal(client.calls[1].input[0].content.filter((c) => c.type === 'input_image').length, 2);
  });
});

test('accepts image/jpg and whitespace in base64 (what iOS sends)', async () => {
  const client = fakeClient({ food_scan: scan });
  await withServer(client, async (call) => {
    const jpg = 'data:image/jpg;base64,' + Buffer.from('fake-jpeg').toString('base64').replace(/(.{4})/, '$1\n');
    const r = await call('POST', '/v1/ABC123/ai/scan', { image: jpg });
    assert.equal(r.status, 200);
    assert.match(client.calls[0].input[0].content[1].image_url, /^data:image\/jpeg;base64,[^\s]+$/);
  });
});

test('builds a routine limited to the given catalog ids', async () => {
  const client = fakeClient({ ai_routine: { name: 'Torso', rationale: 'x', blocks: [{ exerciseIds: ['bench', 'ghost'], rounds: 3, why: '' }, { exerciseIds: ['ghost'], rounds: 2, why: '' }] } });
  await withServer(client, async (call) => {
    assert.equal((await call('POST', '/v1/ABC123/ai/routine', { catalog: [{ id: 'bench' }] })).status, 400);
    const r = await call('POST', '/v1/ABC123/ai/routine', { groups: ['pecho'], minutes: 45, catalog: [{ id: 'bench' }, { id: 'row' }] });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.blocks.map((b) => b.exerciseIds), [['bench']]);
    assert.deepEqual(client.calls[0].text.format.schema.properties.blocks.items.properties.exerciseIds.items.enum, ['bench', 'row']);
  });
});
