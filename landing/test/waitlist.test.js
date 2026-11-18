import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, validateEntry } from '../src/waitlist.js';
import { assetsHost, createApp } from '../src/server.js';

const valid = {
  goal: 'Recomposición (ambas)',
  phone: 'iPhone',
  watch: 'Amazfit',
  need: ['Coach IA semanal', 'Sesiones generadas'],
  email: '  Ana@Example.com ',
  plan: 'premium',
};

test('validateEntry normaliza el email y acepta respuestas válidas', () => {
  const r = validateEntry(valid);
  assert.equal(r.ok, true);
  assert.equal(r.entry.email, 'ana@example.com');
  assert.deepEqual(r.entry.need, ['Coach IA semanal', 'Sesiones generadas']);
});

test('validateEntry rechaza email, opciones desconocidas y demasiadas elecciones', () => {
  assert.equal(validateEntry({ ...valid, email: 'no-es-email' }).ok, false);
  assert.equal(validateEntry({ ...valid, goal: 'Otra cosa' }).ok, false);
  assert.equal(validateEntry({ ...valid, need: ['Coach IA semanal', 'Sesiones generadas', 'Fotos y medidas'] }).ok, false);
  assert.equal(validateEntry({ ...valid, need: [] }).ok, false);
  assert.equal(validateEntry(null).ok, false);
});

test('plan desconocido cae en premium', () => {
  assert.equal(validateEntry({ ...valid, plan: 'x' }).entry.plan, 'premium');
  assert.equal(validateEntry({ ...valid, plan: 'free' }).entry.plan, 'free');
});

test('store guarda en disco y no duplica emails', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'wrep-')), 'sub', 'waitlist.json');
  const store = createStore(file);
  const a = await store.add({ email: 'a@x.com', plan: 'free' });
  const b = await store.add({ email: 'b@x.com', plan: 'premium' });
  const a2 = await store.add({ email: 'a@x.com', plan: 'premium' });
  assert.deepEqual([a.position, b.position, a2.position], [1, 2, 1]);
  assert.equal(a2.existing, true);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.length, 2);
  assert.equal(saved[0].plan, 'premium');
  assert.equal(await createStore(file).count(), 2);
});

test('altas simultáneas no se pisan', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'wrep-')), 'waitlist.json');
  const store = createStore(file);
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => store.add({ email: `u${i}@x.com`, plan: 'free' })));
  assert.deepEqual(rs.map((r) => r.position).sort((x, y) => x - y), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 20);
});

async function withServer(opts, fn) {
  const file = join(await mkdtemp(join(tmpdir(), 'wrep-')), 'waitlist.json');
  const server = createServer(createApp({ store: createStore(file), ...opts }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('API: alta, contador con base y exportación protegida', async () => {
  await withServer({ baseCount: 100, adminToken: 'secreto' }, async (base) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/waitlist`)).json(), { count: 100 });

    const post = (body) => fetch(`${base}/api/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const ok = await post(valid);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).position, 101);
    assert.equal((await post({ ...valid, email: 'x' })).status, 400);
    assert.equal((await fetch(`${base}/api/waitlist`, { method: 'POST', body: '{nope' })).status, 400);

    assert.equal((await fetch(`${base}/api/waitlist/export`)).status, 401);
    const exp = await fetch(`${base}/api/waitlist/export?format=csv`, { headers: { authorization: 'Bearer secreto' } });
    assert.equal(exp.status, 200);
    assert.match(await exp.text(), /ana@example\.com/);
  });
});

test('API: sin ADMIN_TOKEN la exportación está cerrada y lo explica', async () => {
  await withServer({}, async (base) => {
    const r = await fetch(`${base}/api/waitlist/export`, { headers: { authorization: 'Bearer ' } });
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /ADMIN_TOKEN/);
  });
});

test('/admin sirve el panel sin indexar y sin datos dentro', async () => {
  await withServer({ adminToken: 'secreto' }, async (base) => {
    const r = await fetch(`${base}/admin`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
    const html = await r.text();
    assert.match(html, /Lista de espera/);
    assert.doesNotMatch(html, /secreto/);
    assert.equal((await fetch(`${base}/api/waitlist/export`, { headers: { authorization: 'Bearer malo' } })).status, 401);
  });
});

test('estáticos: sirve la landing y bloquea rutas fuera de public', async () => {
  await withServer({}, async (base) => {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /El reloj lo registra/);
    assert.equal((await fetch(`${base}/..%2Fsrc%2Fserver.js`)).status, 404);
    assert.equal((await fetch(`${base}/nada.html`)).status, 404);
  });
});

test('config.js expone la clave de PostHog solo si existe', async () => {
  await withServer({}, async (base) => {
    const js = await (await fetch(`${base}/config.js`)).text();
    assert.match(js, /"posthogKey":""/);
    assert.equal((await fetch(`${base}/ingest/e/`, { method: 'POST', body: '{}' })).status, 404);
  });
  await withServer({ posthog: { key: 'phc_test', host: 'https://eu.i.posthog.com' } }, async (base) => {
    const js = await (await fetch(`${base}/config.js`)).text();
    assert.match(js, /"posthogKey":"phc_test"/);
    assert.match(js, /"posthogApiHost":"\/ingest"/);
    assert.match(js, /"posthogUiHost":"https:\/\/eu\.posthog\.com"/);
  });
});

test('assetsHost apunta a los estáticos de PostHog', () => {
  assert.equal(assetsHost('https://eu.i.posthog.com'), 'https://eu-assets.i.posthog.com');
  assert.equal(assetsHost('http://127.0.0.1:9'), 'http://127.0.0.1:9');
});

test('proxy /ingest reenvía eventos y estáticos a PostHog', async () => {
  const seen = [];
  const upstream = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString(), ip: req.headers['x-forwarded-for'] });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":1}');
    });
  });
  await new Promise((r) => upstream.listen(0, r));
  const host = `http://127.0.0.1:${upstream.address().port}`;
  try {
    await withServer({ posthog: { key: 'phc_test', host } }, async (base) => {
      const r = await fetch(`${base}/ingest/e/?compression=gzip-js`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain', 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
        body: 'payload',
      });
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { status: 1 });
      assert.equal((await fetch(`${base}/ingest/static/array.js`)).status, 200);
    });
    assert.deepEqual(seen[0], { method: 'POST', url: '/e/?compression=gzip-js', body: 'payload', ip: '1.2.3.4' });
    assert.equal(seen[1].url, '/static/array.js');
  } finally {
    upstream.close();
  }
});
