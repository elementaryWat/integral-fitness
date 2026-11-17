import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { createStore, validateEntry } from './waitlist.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function toCsv(list) {
  const cols = ['ts', 'email', 'plan', 'goal', 'phone', 'watch', 'need'];
  const cell = (v) => `"${String(Array.isArray(v) ? v.join(' | ') : (v ?? '')).replace(/"/g, '""')}"`;
  return [cols.join(','), ...list.map((e) => cols.map((c) => cell(e[c])).join(','))].join('\n');
}

export function createApp({ store, baseCount = 0, adminToken = '' }) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    try {
      if (path === '/health') return json(res, 200, { ok: true });

      if (path === '/api/waitlist' && req.method === 'GET') {
        return json(res, 200, { count: baseCount + (await store.count()) });
      }

      if (path === '/api/waitlist' && req.method === 'POST') {
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          return json(res, 400, { error: 'Cuerpo inválido' });
        }
        const v = validateEntry(body);
        if (!v.ok) return json(res, 400, { error: v.error });
        const r = await store.add(v.entry);
        return json(res, 200, { position: baseCount + r.position, count: baseCount + r.count, existing: r.existing });
      }

      if (path === '/api/waitlist/export' && req.method === 'GET') {
        const auth = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
        if (!adminToken || !safeEqual(auth, adminToken)) return json(res, 401, { error: 'No autorizado' });
        const list = await store.all();
        if (url.searchParams.get('format') === 'csv') {
          res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' });
          return res.end(toCsv(list));
        }
        return json(res, 200, list);
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido' });

      const rel = path === '/' ? 'index.html' : decodeURIComponent(path).replace(/^\/+/, '');
      const file = normalize(join(PUBLIC_DIR, rel));
      if (!file.startsWith(PUBLIC_DIR)) return json(res, 404, { error: 'No encontrado' });
      let data;
      try {
        data = await readFile(file);
      } catch {
        data = null;
      }
      if (!data) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('No encontrado');
      }
      const ext = extname(file);
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        // HTML, JS y CSS se revalidan siempre para que un despliegue nuevo se vea al momento.
        'cache-control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      });
      return res.end(req.method === 'HEAD' ? undefined : data);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: 'Error interno' });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file =
    process.env.WAITLIST_FILE ??
    (process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'waitlist.json')
      : fileURLToPath(new URL('../data/waitlist.json', import.meta.url)));
  const app = createApp({
    store: createStore(file),
    baseCount: Number(process.env.WAITLIST_BASE_COUNT ?? 0) || 0,
    adminToken: process.env.ADMIN_TOKEN ?? '',
  });
  const port = Number(process.env.PORT ?? 3000);
  createServer(app).listen(port, () => console.log(`Wrep landing en :${port} · lista en ${file}`));
}
