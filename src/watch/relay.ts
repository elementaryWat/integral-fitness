import type { Exercise, Session, SetLog } from '../domain/types';

/** Connection to the watch relay (server/), shared by the pairing screen and the sync hook. */
export interface WatchLink {
  enabled: boolean;
  serverUrl: string;
  code: string;
}

export interface WatchLive {
  hr: number | null;
  mode: string | null;
  qi: number | null;
  at: number;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newPairCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const cleanUrl = (u: string) => u.trim().replace(/\/+$/, '');
export const linkReady = (l: WatchLink | undefined): l is WatchLink => !!l && l.enabled && /^https?:\/\/.+/.test(cleanUrl(l.serverUrl)) && /^[A-Z0-9]{6,12}$/.test(l.code);

async function call<T>(l: WatchLink, method: string, path: string, body?: unknown, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cleanUrl(l.serverUrl)}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const health = (l: WatchLink) => call<{ ok: boolean }>(l, 'GET', '/health');

/** What the watch needs to run the session without looking anything up. */
export function sessionPayload(s: Session, ex: Record<string, Exercise>, settings: { restSec: number; hrThreshold: number }) {
  return {
    id: s.id,
    restSec: settings.restSec,
    hrThreshold: settings.hrThreshold,
    doneQis: s.sets.map((l) => l.qi),
    queue: s.queue.map((q, qi) => {
      const e = ex[q.exerciseId];
      return {
        qi, block: q.block, pos: q.pos, set: q.set, sets: q.sets, exerciseId: q.exerciseId, load: q.load, reps: q.reps,
        name: e?.name ?? q.exerciseId, unit: e?.unit ?? 'reps', loadMode: e?.loadMode ?? 'peso', step: e?.step ?? 0, levers: e?.levers,
      };
    }),
  };
}

export const putSession = (l: WatchLink, session: ReturnType<typeof sessionPayload>) => call(l, 'PUT', `/v1/${l.code}/session`, { session });
export const deleteSession = (l: WatchLink) => call(l, 'DELETE', `/v1/${l.code}/session`);
export const getSets = (l: WatchLink, since: number) =>
  call<{ sessionId: string | null; seq: number; sets: (SetLog & { seq: number })[] }>(l, 'GET', `/v1/${l.code}/sets?since=${since}`);
export const getLive = (l: WatchLink) => call<{ live: WatchLive | null }>(l, 'GET', `/v1/${l.code}/live`);

export interface WatchDaily { steps?: number; deepSleepMin?: number; sleepMin?: number; restingHr?: number; at?: number }
export const getDaily = (l: WatchLink) => call<{ days: Record<string, WatchDaily> }>(l, 'GET', `/v1/${l.code}/daily`);

/** Watch values for a day as a DailyActivity patch (HRV and manual fields the watch lacks are left untouched). */
export function dailyToActivity(date: string, d: WatchDaily) {
  const out: { date: string; steps?: number; deepSleepMin?: number; sleepMin?: number; restingHr?: number } = { date };
  for (const k of ['steps', 'deepSleepMin', 'sleepMin', 'restingHr'] as const) {
    const v = d[k];
    if (typeof v === 'number' && v > 0) out[k] = v;
  }
  return Object.keys(out).length > 1 ? out : null;
}
