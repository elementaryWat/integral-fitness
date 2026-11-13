// Muscle groups shown on the anatomical heatmap (keys match src/bodyPolygons.ts).

export const MUSCLE_KEYS = [
  'pecho', 'delt', 'bic', 'ante', 'abs', 'obl', 'quad', 'gem',
  'trap', 'dors', 'deltp', 'tri', 'lumb', 'glut', 'isq',
] as const;

export type MuscleKey = (typeof MUSCLE_KEYS)[number];

export type Region = 'superior' | 'inferior' | 'core';

interface MuscleInfo {
  name: string;
  region: Region;
  /** Minimum effective volume (hard sets / week) */
  mev: number;
  /** Maximum adaptive volume (hard sets / week) */
  mav: number;
}

export const MUSCLE_INFO: Record<MuscleKey, MuscleInfo> = {
  pecho: { name: 'Pectoral', region: 'superior', mev: 8, mav: 20 },
  delt: { name: 'Deltoides ant./lat.', region: 'superior', mev: 6, mav: 20 },
  bic: { name: 'Bíceps', region: 'superior', mev: 6, mav: 18 },
  ante: { name: 'Antebrazo', region: 'superior', mev: 2, mav: 12 },
  abs: { name: 'Recto abdominal', region: 'core', mev: 6, mav: 16 },
  obl: { name: 'Oblicuos', region: 'core', mev: 4, mav: 14 },
  quad: { name: 'Cuádriceps', region: 'inferior', mev: 6, mav: 16 },
  gem: { name: 'Gemelos', region: 'inferior', mev: 4, mav: 14 },
  trap: { name: 'Trapecio', region: 'superior', mev: 4, mav: 16 },
  dors: { name: 'Dorsal ancho', region: 'superior', mev: 8, mav: 18 },
  deltp: { name: 'Deltoides post.', region: 'superior', mev: 6, mav: 18 },
  tri: { name: 'Tríceps', region: 'superior', mev: 6, mav: 18 },
  lumb: { name: 'Erectores lumbares', region: 'core', mev: 2, mav: 10 },
  glut: { name: 'Glúteos', region: 'inferior', mev: 4, mav: 16 },
  isq: { name: 'Isquiotibiales', region: 'inferior', mev: 6, mav: 16 },
};

export const muscleName = (k: MuscleKey) => MUSCLE_INFO[k].name;
