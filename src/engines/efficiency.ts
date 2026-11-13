import type { Session } from '../domain/types';
import { isLoaded, systemLoad } from './progression';
import type { ExMap } from './volume';

export interface SessionMetrics {
  hasLogs: boolean;
  /** Effective tonnage (kg): loaded rep sets only, bodyweight included for weighted calisthenics */
  tonnage: number;
  activeSec: number;
  restSec: number;
  totalSec: number;
  /** kg per minute of total session time */
  density: number;
  /** rest seconds per active second */
  restRatio: number;
  hrrAvg: number;
}

/**
 * Efficiency metrics from the watch timestamps of each set.
 * `liveRestSec` adds the ongoing rest when the session is in progress.
 */
export function sessionMetrics(s: Pick<Session, 'sets'>, ex: ExMap, bw: number, liveRestSec = 0): SessionMetrics {
  const sets = [...s.sets].sort((a, b) => a.startedAt - b.startedAt);
  let tonnage = 0, activeSec = 0, restSec = liveRestSec, hrrSum = 0, hrrN = 0;
  sets.forEach((l, i) => {
    const e = ex[l.exerciseId];
    if (e && isLoaded(e)) tonnage += systemLoad(e, l.load, bw) * l.reps;
    activeSec += Math.max(0, (l.endedAt - l.startedAt) / 1000);
    if (i > 0) restSec += Math.max(0, (l.startedAt - sets[i - 1].endedAt) / 1000);
    if (l.hrr60 !== undefined) { hrrSum += l.hrr60; hrrN++; }
  });
  const totalSec = activeSec + restSec;
  return {
    hasLogs: sets.length > 0,
    tonnage,
    activeSec,
    restSec,
    totalSec,
    density: totalSec > 0 ? tonnage / (totalSec / 60) : 0,
    restRatio: activeSec > 0 ? restSec / activeSec : 0,
    hrrAvg: hrrN ? hrrSum / hrrN : 0,
  };
}
