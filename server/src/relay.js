// Watch ↔ phone relay. The Zepp OS side service (inside the Zepp phone app) can only reach the
// watch and HTTP, so both ends meet here, keyed by a pairing code the Wrep app generates.
//
//   phone app ── PUT session / GET sets / GET live ──▶ relay ◀── GET session / POST sets / POST live ── watch
//
// Each pairing code owns: the active session plan (pushed by the phone), the set logs recorded
// on the watch (upserted by id, with a sequence number the phone polls from) and the latest
// live state (heart rate, mode) for the phone's live card.

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { handleAi } from './ai/routes.js';

export const CODE_RE = /^[A-Z0-9]{6,12}$/;
const MAX_BODY = 256 * 1024;

export class RelayStore {
  constructor(file) {
    this.file = file;
    this.pairs = new Map();
    this.timer = null;
    if (file) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        for (const [code, p] of Object.entries(raw)) this.pairs.set(code, p);
      } catch {
        // First run or unreadable file: start empty.
      }
    }
  }

  pair(code) {
    let p = this.pairs.get(code);
    if (!p) {
      p = { session: null, rev: 0, sets: [], seq: 0, live: null, daily: {} };
      this.pairs.set(code, p);
    }
    return p;
  }

  /** Queue indexes already logged, from the phone (session.doneQis) or the watch (sets). */
  doneQis(p) {
    const s = new Set(p.session?.doneQis ?? []);
    for (const l of p.sets) s.add(l.qi);
    return [...s].sort((a, b) => a - b);
  }

  putSession(code, session) {
    const p = this.pair(code);
    if (!p.session || p.session.id !== session.id) p.sets = [];
    p.session = session;
    p.rev += 1;
    this.save();
    return { rev: p.rev };
  }

  deleteSession(code) {
    const p = this.pair(code);
    p.session = null;
    p.sets = [];
    p.live = null;
    p.rev += 1;
    this.save();
  }

  /** Upsert a set log by id (the watch re-sends it once HRR-60 is known). */
  postSet(code, sessionId, log) {
    const p = this.pair(code);
    if (!p.session || p.session.id !== sessionId) return { ok: false, reason: 'session' };
    p.seq += 1;
    const entry = { ...log, seq: p.seq };
    const i = p.sets.findIndex((x) => x.id === log.id);
    if (i >= 0) p.sets[i] = entry;
    else p.sets.push(entry);
    this.save();
    return { ok: true, seq: p.seq, doneQis: this.doneQis(p) };
  }

  setsSince(code, since) {
    const p = this.pair(code);
    return { sessionId: p.session?.id ?? null, seq: p.seq, sets: p.sets.filter((l) => l.seq > since) };
  }

  /** Daily wearable metrics from the watch, merged per date (history only fills gaps); only the last 14 days are kept. */
  putDaily(code, date, metrics, { onlyMissing = false } = {}) {
    const p = this.pair(code);
    const prev = p.daily?.[date] ?? {};
    const next = onlyMissing ? { ...metrics, ...prev } : { ...prev, ...metrics };
    p.daily = { ...(p.daily ?? {}), [date]: { ...next, at: Date.now() } };
    const keep = Object.keys(p.daily).sort().slice(-14);
    p.daily = Object.fromEntries(keep.map((d) => [d, p.daily[d]]));
    this.save();
  }

  getDaily(code) {
    return this.pair(code).daily ?? {};
  }

  setLive(code, live) {
    this.pair(code).live = { ...live, at: Date.now() };
  }

  save() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.pairs)));
    }, 200);
  }
}

function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** Daily wellness numbers accepted from the watch (all positive; 0 means "no data"). */
export const DAILY_KEYS = ['steps', 'deepSleepMin', 'sleepMin', 'restingHr', 'remMin', 'lightMin', 'awakeMin', 'sleepScore', 'stressAvg', 'nightStress', 'pai'];
function dailyMetrics(b) {
  const metrics = {};
  for (const k of DAILY_KEYS) if (isNum(b[k]) && b[k] > 0 && b[k] < 200000) metrics[k] = Math.round(b[k]);
  return metrics;
}

function validLog(l) {
  return l && typeof l.id === 'string' && Number.isInteger(l.qi) && typeof l.exerciseId === 'string' &&
    isNum(l.load) && isNum(l.reps) && isNum(l.rpe) && isNum(l.startedAt) && isNum(l.endedAt);
}

const MAX_AI_BODY = 16 * 1024 * 1024; // up to 4 photos for the physique review

/**
 * `ai` (optional): `{ ai, quota, codes }` from src/ai — enables /v1/:code/ai/{scan,food,exercise,coach,physique,routine,status}.
 */
export function createRelay({ file, ai } = {}) {
  const store = new RelayStore(file);
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? '/', 'http://relay');
      if (url.pathname === '/health') return send(200, { ok: true, service: 'recomp-relay', time: Date.now() });

      const aiMatch = url.pathname.match(/^\/v1\/([^/]+)\/ai\/([a-z]+)$/);
      if (aiMatch) {
        const code = aiMatch[1].toUpperCase();
        if (!CODE_RE.test(code)) return send(400, { error: 'invalid pairing code' });
        if (!ai) return send(503, { error: 'La IA no está disponible en este servidor.', code: 'ai_disabled' });
        const action = aiMatch[2];
        if ((action === 'status') !== (req.method === 'GET') || (req.method !== 'GET' && req.method !== 'POST')) return send(405, { error: 'method not allowed' });
        const started = Date.now();
        try {
          const body = req.method === 'POST' ? await readBody(req, MAX_AI_BODY) : {};
          const result = await handleAi({ action, code, body, ...ai });
          if (action !== 'status') console.log(`ai ${action} ${code} ok ${Date.now() - started}ms`);
          return send(200, result);
        } catch (e) {
          console.log(`ai ${action} ${code} ${e.code ?? 'error'} ${Date.now() - started}ms`);
          return send(e.status ?? 500, { error: e.message ?? 'error', code: e.code ?? 'error' });
        }
      }

      const m = url.pathname.match(/^\/v1\/([^/]+)\/(session|sets|live|daily)$/);
      if (!m) return send(404, { error: 'not found' });
      const code = m[1].toUpperCase();
      if (!CODE_RE.test(code)) return send(400, { error: 'invalid pairing code' });
      const key = `${req.method} ${m[2]}`;

      switch (key) {
        case 'GET session': {
          const p = store.pair(code);
          return send(200, { session: p.session, rev: p.rev, doneQis: store.doneQis(p) });
        }
        case 'PUT session': {
          const { session } = await readBody(req);
          if (!session || typeof session.id !== 'string' || !Array.isArray(session.queue)) return send(400, { error: 'invalid session' });
          return send(200, store.putSession(code, session));
        }
        case 'DELETE session':
          store.deleteSession(code);
          return send(200, { ok: true });
        case 'POST sets': {
          const { sessionId, log } = await readBody(req);
          if (typeof sessionId !== 'string' || !validLog(log)) return send(400, { error: 'invalid set' });
          const r = store.postSet(code, sessionId, log);
          return send(r.ok ? 200 : 409, r);
        }
        case 'GET sets':
          return send(200, store.setsSince(code, Number(url.searchParams.get('since') ?? 0) || 0));
        case 'POST live': {
          const { hr, mode, qi } = await readBody(req);
          store.setLive(code, { hr: isNum(hr) ? hr : null, mode: typeof mode === 'string' ? mode : null, qi: Number.isInteger(qi) ? qi : null });
          return send(200, { ok: true });
        }
        case 'POST daily': {
          const b = await readBody(req);
          if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return send(400, { error: 'invalid date' });
          store.putDaily(code, b.date, dailyMetrics(b));
          // Last days of stress/PAI from the watch: fills the baseline even if the app was not opened.
          if (Array.isArray(b.history)) {
            for (const h of b.history.slice(0, 14)) {
              if (h && typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.date < b.date) {
                const m = dailyMetrics(h);
                if (Object.keys(m).length) store.putDaily(code, h.date, m, { onlyMissing: true });
              }
            }
          }
          return send(200, { ok: true });
        }
        case 'GET daily':
          return send(200, { days: store.getDaily(code) });
        case 'GET live':
          return send(200, { live: store.pair(code).live });
        default:
          return send(405, { error: 'method not allowed' });
      }
    } catch (e) {
      return send(e.status ?? 500, { error: e.message ?? 'error' });
    }
  });
  return { server, store };
}
