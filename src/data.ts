// Presentation constants and es-ES formatters shared across screens.
import type { Discipline, Exercise, Unit } from './domain/types';
import type { MuscleStatus } from './engines/volume';

export const C = {
  bg: '#050505',
  text: '#f4f5f0',
  lime: '#c8f53c',
  cyan: '#6cc7e8',
  coral: '#ff7a5c',
  amber: '#f0c85a',
  low: '#3f7388',
  muted: '#9a9e95',
  soft: '#c4c8bf',
  dim: '#5f635c',
  card: '#0f100f',
  line: '#1f211f',
  chip: '#1a1b1a',
  border: '#2a2c2a',
} as const;

export const TAG_COLORS: Record<Discipline, string> = { Pesas: C.lime, Calistenia: C.cyan, Core: C.amber, Cardio: C.coral };
export const STATUS_COLOR: Record<MuscleStatus, string> = { b: C.low, o: C.lime, f: C.coral };
export const STATUS_LABEL: Record<MuscleStatus, string> = { b: 'SUB-ENTRENADO', o: 'ZONA ÓPTIMA', f: 'FATIGA AGUDA' };

/** es-ES number: "." thousands, "," decimals, "−" minus. */
export const fmt = (n: number, d = 0): string => {
  const [i, f] = Math.abs(n).toFixed(d).split('.');
  return (n < 0 && Number(Math.abs(n).toFixed(d)) !== 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
};
export const fmtWeight = (w: number) => (w % 1 === 0 ? fmt(w) : (w * 10) % 1 === 0 ? fmt(w, 1) : fmt(w, 2));
export const fmtSigned = (n: number, d = 0) => (n > 0 ? '+' : '') + fmt(n, d);
export const mmss = (t: number) => {
  const s = Math.max(0, Math.round(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
export const unitSuffix = (u: Unit) => (u === 's' ? ' s' : u === 'min' ? ' min' : '');
export const unitLabel = (u: Unit) => (u === 'reps' ? 'REPS' : u.toUpperCase());

/** Load as shown on watch/phone: "82,5", "+20" weighted, "PC" bodyweight, "Z2" cardio, lever name. */
export function loadText(e: Exercise, load: number) {
  switch (e.loadMode) {
    case 'peso': return fmtWeight(load);
    case 'lastre': return '+' + fmtWeight(load);
    case 'palanca': return (e.levers?.[load] ?? `N${load + 1}`).toUpperCase();
    case 'corporal': return 'PC';
    default: return e.discipline === 'Cardio' ? 'Z2' : 'PC';
  }
}
export const loadUnit = (e: Exercise) =>
  e.loadMode === 'peso' || e.loadMode === 'lastre' ? 'KG' : e.loadMode === 'palanca' ? 'PALANCA' : e.discipline === 'Cardio' ? 'ZONA' : 'PESO CORP.';

/** "4 × 8 @ 82,5 kg", "3 × 40 s · peso corporal", "1 × 12 min" */
export function prescription(e: Exercise, sets: number, load: number, reps: number) {
  const base = `${sets} × ${reps}${unitSuffix(e.unit) || (e.unit === 'reps' && e.loadMode !== 'peso' && e.loadMode !== 'lastre' ? ' reps' : '')}`;
  if (e.loadMode === 'peso' || e.loadMode === 'lastre') return `${base} @ ${loadText(e, load)} kg`;
  if (e.loadMode === 'palanca') return `${base} · ${loadText(e, load).toLowerCase()}`;
  if (e.discipline === 'Core') return `${base} · peso corporal`;
  return base;
}

export const BLOCK_REST_LABEL = (b: { kind: string; restSec: number }) => (b.kind === 'cardio' ? 'CONTINUO' : `DESC. ${b.restSec} S`);
