// Pure session logic shared by the watch page (no Zepp OS imports, so it is unit-tested with node --test).

export const TRANSITION_SEC = 30;
export const MIN_REST_FOR_HR_RULE = 20;
export const RPES = [7, 8, 9, 10];

/** First queue index at or after `from` that is not logged yet; -1 when the session is done. */
export function nextPending(queue, doneQis, from = 0) {
  const done = new Set(doneQis);
  for (let i = from; i < queue.length; i++) if (!done.has(queue[i].qi)) return i;
  for (let i = 0; i < from; i++) if (!done.has(queue[i].qi)) return i;
  return -1;
}

/**
 * Rest after finishing queue[i]: a short transition when the superset partner of the same round
 * comes next (no heart-rate rule), otherwise the full rest that may end early on HR recovery.
 */
export function restAfter(queue, i, restSec) {
  const cur = queue[i];
  const next = queue[i + 1];
  const partner = !!next && next.block === cur.block && next.set === cur.set;
  return partner ? { target: TRANSITION_SEC, hrRule: false } : { target: restSec, hrRule: true };
}

/** Why the rest is over, or null while it continues. */
export function restEnd({ t, hr, target, hrRule, threshold }) {
  if (hrRule && t >= MIN_REST_FOR_HR_RULE && hr > 0 && hr <= threshold) return 'hr';
  if (t >= target) return 'time';
  return null;
}

/** Load step for the +/- buttons, bounded by the lever list for skill progressions. */
export function adjustLoad(item, load, dir) {
  if (!item.step) return load;
  const max = item.loadMode === 'palanca' ? Math.max(0, (item.levers || []).length - 1) : Infinity;
  return Math.min(max, Math.max(0, Math.round((load + dir * item.step) * 100) / 100));
}

export function adjustReps(item, reps, dir) {
  return Math.max(1, reps + dir * (item.unit === 's' ? 5 : 1));
}

export function loadLabel(item, load) {
  switch (item.loadMode) {
    case 'peso': return `${fmt(load)} kg`;
    case 'lastre': return load ? `+${fmt(load)} kg` : 'Sin lastre';
    case 'palanca': return (item.levers && item.levers[load]) || `Nivel ${load + 1}`;
    case 'corporal': return 'Peso corporal';
    default: return '';
  }
}

export function repsLabel(item, reps) {
  return item.unit === 's' ? `${reps} s` : item.unit === 'min' ? `${reps} min` : `${reps} reps`;
}

export const fmt = (n) => (Math.round(n * 100) / 100).toString().replace('.', ',');
export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Rough repetition detector on wrist acceleration (cm/s²). Each repetition shows up as a peak of
 * dynamic acceleration (magnitude minus gravity); the drop between the first and last reps' peaks
 * approximates velocity loss within the set. It is only a proxy: a wrist sensor cannot measure
 * bar speed, so values are reported only with ≥ 4 clear peaks.
 */
export class RepDetector {
  constructor({ threshold = 120, refractoryMs = 600 } = {}) {
    this.threshold = threshold;
    this.refractoryMs = refractoryMs;
    this.peaks = [];
    this.rising = false;
    this.cur = 0;
    this.lastPeakAt = -Infinity;
  }

  push(x, y, z, t) {
    const dyn = Math.abs(Math.sqrt(x * x + y * y + z * z) - 981);
    if (dyn >= this.threshold) {
      if (dyn > this.cur) this.cur = dyn;
      this.rising = true;
    } else if (this.rising) {
      if (t - this.lastPeakAt >= this.refractoryMs) {
        this.peaks.push(this.cur);
        this.lastPeakAt = t;
      }
      this.rising = false;
      this.cur = 0;
    }
  }

  get reps() {
    return this.peaks.length;
  }

  /** 0–1, or undefined when there are not enough peaks to say anything. */
  velocityLoss() {
    const p = this.peaks;
    if (p.length < 4) return undefined;
    const first = (p[0] + p[1]) / 2;
    const last = (p[p.length - 1] + p[p.length - 2]) / 2;
    if (first <= 0) return undefined;
    return Math.round(Math.min(1, Math.max(0, 1 - last / first)) * 100) / 100;
  }
}

/** Outbox for set logs that could not be delivered (phone out of range, relay down). */
export function enqueue(outbox, entry) {
  return [...outbox.filter((e) => e.log.id !== entry.log.id), entry];
}
