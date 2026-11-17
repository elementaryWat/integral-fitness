import { addDays, dayLetter, startOfWeek, weekday } from '../domain/dates';
import type { ISODate, Session } from '../domain/types';

/**
 * Consistency without punishing rest: a week counts when you hit your weekly sessions, and a
 * planned training day counts when you train it (or make it up with an extra day that week).
 * Rest days never break anything, and today never breaks a streak before it is over.
 */

export type DayState = 'done' | 'extra' | 'live' | 'today' | 'planned' | 'missed' | 'rest';

export interface StreakInput {
  sessions: Session[];
  /** 1 = Monday … 7 = Sunday */
  trainingDays: number[];
  today: ISODate;
  /** Profile creation: weeks before it are not counted. */
  startDate: ISODate;
  /** A session is in progress today. */
  activeToday?: boolean;
}

export const trainedDays = (sessions: Session[]) => new Set(sessions.filter((s) => s.sets.length > 0).map((s) => s.date));

const days7 = (monday: ISODate) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** Planned days of a week that count as done: trained, or covered by an extra (unplanned) training day. */
function weekPlan(monday: ISODate, trained: Set<ISODate>, plan: Set<number>, from: ISODate, upTo: ISODate) {
  const days = days7(monday).filter((d) => d >= from && d <= upTo);
  const scheduled = days.filter((d) => plan.has(weekday(d)));
  let extras = days.filter((d) => !plan.has(weekday(d)) && trained.has(d)).length;
  const fulfilled = new Map<ISODate, boolean>();
  for (const d of scheduled) {
    if (trained.has(d)) fulfilled.set(d, true);
    else if (extras > 0) { extras -= 1; fulfilled.set(d, true); }
    else fulfilled.set(d, false);
  }
  return { scheduled, fulfilled };
}

export function weekStrip({ sessions, trainingDays, today, startDate, activeToday }: StreakInput) {
  const trained = trainedDays(sessions);
  const plan = new Set(trainingDays);
  const monday = startOfWeek(today);
  const { fulfilled } = weekPlan(monday, trained, plan, startDate, addDays(today, -1));
  return days7(monday).map((date) => {
    const planned = plan.has(weekday(date));
    let state: DayState;
    if (date === today && activeToday) state = 'live';
    else if (trained.has(date)) state = planned ? 'done' : 'extra';
    else if (date === today) state = planned ? 'today' : 'rest';
    else if (date > today) state = planned ? 'planned' : 'rest';
    else state = planned && date >= startDate && fulfilled.get(date) === false ? 'missed' : 'rest';
    return { date, letter: dayLetter(date), state, isToday: date === today };
  });
}

const firstDay = (sessions: Session[], startDate: ISODate) => sessions.reduce((m, s) => (s.date < m ? s.date : m), startDate);

/** Consecutive weeks with your weekly sessions done. The current week only adds, never breaks. */
export function weekStreak({ sessions, trainingDays, today, startDate }: StreakInput) {
  const trained = trainedDays(sessions);
  const plan = new Set(trainingDays);
  const goalFull = Math.max(1, plan.size);
  const from = firstDay(sessions, startDate);
  const thisMonday = startOfWeek(today);
  const weeks: { complete: boolean; neutral: boolean }[] = [];
  for (let m = startOfWeek(from); m < thisMonday; m = addDays(m, 7)) {
    const days = days7(m).filter((d) => d >= from);
    // The first, partial week only asks for the planned days that were left in it.
    const goal = Math.min(goalFull, Math.max(1, days.filter((d) => plan.has(weekday(d))).length));
    const done = days.filter((d) => trained.has(d)).length;
    weeks.push({ complete: done >= goal, neutral: days.length < 7 && done === 0 });
  }
  const doneNow = days7(thisMonday).filter((d) => trained.has(d)).length;
  const currentComplete = doneNow >= goalFull;

  let run = 0;
  let best = 0;
  for (const w of weeks) {
    if (w.neutral) continue;
    run = w.complete ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const current = run + (currentComplete ? 1 : 0);
  return { current, best: Math.max(best, current), thisWeek: { done: doneNow, goal: goalFull } };
}

/** Consecutive planned training days done (rest days skipped, today pending does not break). */
export function planStreak({ sessions, trainingDays, today, startDate }: StreakInput) {
  const trained = trainedDays(sessions);
  const plan = new Set(trainingDays);
  const from = firstDay(sessions, startDate);
  const seq: boolean[] = [];
  for (let m = startOfWeek(from); m <= today; m = addDays(m, 7)) {
    const { scheduled, fulfilled } = weekPlan(m, trained, plan, from, today);
    for (const d of scheduled) {
      const ok = fulfilled.get(d)!;
      if (d === today && !ok) continue;
      seq.push(ok);
    }
  }
  let run = 0;
  let best = 0;
  for (const ok of seq) {
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}
