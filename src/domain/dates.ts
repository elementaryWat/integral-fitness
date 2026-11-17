import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = (): ISODate => isoDate(new Date());
export const parseISO = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: ISODate, n: number): ISODate => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
/** ISO weekday: 1 = lunes … 7 = domingo */
export const weekday = (s: ISODate) => ((parseISO(s).getDay() + 6) % 7) + 1;
/** Monday of the week containing `s` */
export const startOfWeek = (s: ISODate): ISODate => addDays(s, 1 - weekday(s));
export const inRange = (s: ISODate, from: ISODate, to: ISODate) => s >= from && s <= to;

const DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "MIÉ 12 NOV" */
export const longDay = (s: ISODate) => {
  const d = parseISO(s);
  return `${DAYS[weekday(s) - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
/** "12 NOV" */
export const shortDay = (s: ISODate) => {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
/** "HOY", "AYER", "MAÑANA" or "MIÉ 12 NOV", relative to `ref`. */
export const dayName = (s: ISODate, ref: ISODate) => {
  const n = daysBetween(ref, s);
  return n === 0 ? 'HOY' : n === -1 ? 'AYER' : n === 1 ? 'MAÑANA' : longDay(s);
};
export const dayLetter = (s: ISODate) => DAY_LETTERS[weekday(s) - 1];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
