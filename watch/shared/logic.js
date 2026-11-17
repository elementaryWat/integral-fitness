// Pure session logic shared by the watch page (no Zepp OS imports, so it is unit-tested with node --test).

export const TRANSITION_SEC = 30;
/** The heart-rate rule never ends a full rest before this (s), nor before HR_RULE_SHARE of the target. */
export const MIN_REST_FOR_HR_RULE = 60;
export const HR_RULE_SHARE = 0.6;
export const EXTEND_SEC = 30;
export const RPES = [7, 8, 9, 10];
/** Heart rate keeps climbing for a few seconds after the last rep, so the peak window extends into the rest. */
export const POST_SET_PEAK_SEC = 20;

/** Peak heart rate including the post-set climb: readings up to POST_SET_PEAK_SEC after the set still count. */
export function recoveryPeak(peak, hr, sinceEndSec) {
  return hr > 0 && sinceEndSec <= POST_SET_PEAK_SEC && hr > peak ? hr : peak;
}

/** HRR-60 measured from the real (post-set) peak, not from the reading at the last rep. */
export function hrr60From(peak, hrAt60) {
  return peak > 0 && hrAt60 > 0 ? Math.max(0, peak - hrAt60) : undefined;
}

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

/** Earliest second at which a recovered heart rate may end the rest. */
export function hrRuleFrom(target) {
  return Math.max(MIN_REST_FOR_HR_RULE, POST_SET_PEAK_SEC, Math.round(target * HR_RULE_SHARE))
}

/**
 * Why the rest is over, or null while it continues. A low pulse only ends it after
 * max(60 s, 60 % of the target): a 3-minute rest is never cut at 20 s any more.
 */
export function restEnd({ t, hr, target, hrRule, threshold }) {
  if (hrRule && t >= Math.min(target, hrRuleFrom(target)) && hr > 0 && hr <= threshold) return 'hr';
  if (t >= target) return 'time';
  return null;
}

/**
 * Time left (s) and share of the session still to go: real pace once ≥ 2 sets are handled,
 * the plan's estimate before that. Same formula as the phone (src/engines/liveSession.ts).
 */
export function remainingEstimate({ elapsedSec, done, total, plannedSec }) {
  if (!total || done >= total) return { remainingSec: 0, pctLeft: 0 }
  const left = total - done
  const remainingSec = done >= 2 && elapsedSec > 0 ? (elapsedSec / done) * left : Math.max(0, plannedSec * (left / total))
  const pctLeft = Math.round((remainingSec / Math.max(1, elapsedSec + remainingSec)) * 100)
  return { remainingSec: Math.round(remainingSec), pctLeft }
}

/** "~18'" for the watch header. */
export const minutesLeft = (sec) => `~${Math.max(1, Math.round(sec / 60))}'`

/** Load step for the +/- buttons, bounded by the lever list for skill progressions. */
export function adjustLoad(item, load, dir) {
  if (!item.step) return load;
  const max = item.loadMode === 'palanca' ? Math.max(0, (item.levers || []).length - 1) : Infinity;
  return Math.min(max, Math.max(0, Math.round((load + dir * item.step) * 100) / 100));
}

/** Fine step for exact loads (66 instead of 65): 1 kg, or 0.5 kg when the normal step is already ≤ 1. */
export function fineStep(item) {
  if (!item.step || item.loadMode === 'palanca') return item.step || 0;
  return item.step > 1 ? 1 : 0.5;
}

/** Same as adjustLoad with an explicit step (fine mode). */
export function adjustLoadBy(item, load, dir, step) {
  return adjustLoad({ ...item, step }, load, dir);
}

/** Log for a set skipped on the watch: marks the queue slot as done without counting as work. */
export function skippedLog(sessionId, item, at) {
  return { id: `${sessionId}-${item.qi}`, qi: item.qi, exerciseId: item.exerciseId, block: item.block, load: 0, reps: 0, rpe: 0, startedAt: at, endedAt: at, skipped: true };
}

/** Queue indexes still pending in the block (superset) of queue[i], every exercise and round. */
export function pendingOfBlock(queue, doneQis, i) {
  const done = new Set(doneQis)
  const block = queue[i].block
  return queue.filter((q) => q.block === block && !done.has(q.qi)).map((q) => q.qi)
}

/** Queue indexes still pending for the exercise of queue[i] (the current set and the rest of its sets). */
export function pendingOfExercise(queue, doneQis, i) {
  const done = new Set(doneQis);
  const id = queue[i].exerciseId;
  return queue.filter((q) => q.exerciseId === id && !done.has(q.qi)).map((q) => q.qi);
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

// ---------- daily wellness (sleep, stress, PAI) ----------

/** Mean of the valid (> 0) values, rounded; undefined when there are none. */
export function avgValid(arr) {
  const v = (arr || []).filter((x) => x > 0)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined
}

/** Mean of a per-minute series (index = minute since 00:00) between two minutes of the day. */
export function windowAvg(arr, from, to) {
  if (!arr || !arr.length) return undefined
  const a = Math.max(0, Math.floor(from))
  const b = Math.min(arr.length, Math.ceil(to))
  return b > a ? avgValid(arr.slice(a, b)) : undefined
}

/** Totals per sleep stage (minutes) plus score, from Sleep.getInfo/getStage/getStageConstantObj. */
export function sleepSummary(info, stages, k) {
  const out = {}
  if (!info || !(info.totalTime > 0)) return out
  out.sleepMin = info.totalTime
  if (info.deepTime > 0) out.deepSleepMin = info.deepTime
  if (info.score > 0) out.sleepScore = info.score
  if (stages && stages.length && k) {
    const sum = (m) => stages.filter((s) => s.model === m).reduce((t, s) => t + Math.max(0, s.stop - s.start), 0)
    const rem = sum(k.REM_STAGE), light = sum(k.LIGHT_STAGE), wake = sum(k.WAKE_STAGE)
    if (rem > 0) out.remMin = rem
    if (light > 0) out.lightMin = light
    if (wake > 0) out.awakeMin = wake
  }
  return out
}

/** Pairs a 7-value "last week" array (index 0 = six days ago, 6 = today) with dates. */
export function lastWeekByDate(arr, today) {
  const out = []
  if (!arr || arr.length !== 7) return out
  const [y, m, d] = today.split('-').map(Number)
  for (let i = 0; i < 7; i++) {
    const t = new Date(y, m - 1, d - (6 - i))
    const date = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    out.push({ date, value: arr[i] })
  }
  return out
}
