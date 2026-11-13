import { inRange } from '../domain/dates';
import type { Exercise, ISODate, QueueItem, Session } from '../domain/types';
import type { ExMap } from './volume';

export const LOWER_TARGET = 0.2;
const LOWER_BAND: [number, number] = [0.17, 0.25];
const PUSH_MUSCLES = new Set(['pecho', 'delt', 'tri']);

export type BalanceStatus = 'sin-datos' | 'en-objetivo' | 'pierna-baja' | 'pierna-alta';

export interface Balance {
  total: number;
  upperCore: number;
  lower: number;
  /** 0–1 share of lower-body sets */
  lowerShare: number;
  push: number;
  pull: number;
  /** push : pull (1 = balanced) */
  pushPull: number;
  status: BalanceStatus;
  pushPullOk: boolean;
}

export const isPush = (e: Exercise) => e.pattern === 'empuje' || (e.pattern === 'aislamiento' && PUSH_MUSCLES.has(e.primary[0]));
export const isPull = (e: Exercise) => e.pattern === 'traccion' || (e.pattern === 'aislamiento' && !PUSH_MUSCLES.has(e.primary[0]));

function summarize(exercises: (Exercise | undefined)[]): Balance {
  let lower = 0, upperCore = 0, push = 0, pull = 0;
  for (const e of exercises) {
    if (!e) continue;
    if (e.region === 'inferior') lower++;
    else upperCore++;
    if (isPush(e)) push++;
    else if (isPull(e)) pull++;
  }
  const total = lower + upperCore;
  const lowerShare = total ? lower / total : 0;
  const status: BalanceStatus = !total ? 'sin-datos' : lowerShare < LOWER_BAND[0] ? 'pierna-baja' : lowerShare > LOWER_BAND[1] ? 'pierna-alta' : 'en-objetivo';
  const pushPull = pull ? push / pull : push ? Infinity : 1;
  return { total, upperCore, lower, lowerShare, push, pull, pushPull, status, pushPullOk: pushPull >= 0.85 && pushPull <= 1.15 };
}

/** 80/20 split and push:pull ratio over logged sets in [from, to]. */
export function weeklyBalance(sessions: Session[], ex: ExMap, from: ISODate, to: ISODate): Balance {
  return summarize(sessions.filter((s) => inRange(s.date, from, to)).flatMap((s) => s.sets.map((l) => ex[l.exerciseId])));
}

/** Same split for a planned queue. */
export function queueBalance(queue: QueueItem[], ex: ExMap): Balance {
  return summarize(queue.map((q) => ex[q.exerciseId]));
}

export const BALANCE_LABEL: Record<BalanceStatus, string> = {
  'sin-datos': 'SIN DATOS',
  'en-objetivo': 'EN OBJETIVO',
  'pierna-baja': 'PIERNA BAJA',
  'pierna-alta': 'PIERNA ALTA',
};
