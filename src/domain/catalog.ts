import type { MuscleKey } from './muscles';
import type { Exercise, Pattern } from './types';

type Opts = Partial<Exercise>;
const base = (id: string, name: string, pattern: Pattern, primary: MuscleKey[], secondary: MuscleKey[], o: Opts): Exercise => ({
  id, name, discipline: 'Pesas', loadMode: 'peso', pattern, region: 'superior', unit: 'reps', primary, secondary,
  step: 2.5, defaultLoad: 20, defaultReps: 10, repRange: [8, 12], ...o,
});
/** Free weights / machines. */
const w = (id: string, name: string, pattern: Pattern, p: MuscleKey[], s: MuscleKey[], o: Opts = {}) => base(id, name, pattern, p, s, o);
/** Upper-body isolation (accessory slot). */
const iso = (id: string, name: string, p: MuscleKey[], s: MuscleKey[], o: Opts = {}) => base(id, name, 'aislamiento', p, s, { defaultReps: 12, repRange: [10, 15], ...o });
/** Bodyweight calisthenics. */
const cal = (id: string, name: string, pattern: Pattern, p: MuscleKey[], s: MuscleKey[], o: Opts = {}) =>
  base(id, name, pattern, p, s, { discipline: 'Calistenia', loadMode: 'corporal', step: 0, defaultLoad: 0, ...o });
/** Calisthenics skill progressed by lever level. */
const lever = (id: string, name: string, pattern: Pattern, p: MuscleKey[], s: MuscleKey[], levers: string[], o: Opts = {}) =>
  base(id, name, pattern, p, s, { discipline: 'Calistenia', loadMode: 'palanca', step: 1, defaultLoad: 1, defaultReps: 6, repRange: [5, 10], levers, ...o });
const core = (id: string, name: string, p: MuscleKey[], s: MuscleKey[], o: Opts = {}) =>
  base(id, name, 'core', p, s, { discipline: 'Core', region: 'core', step: 0, defaultLoad: 0, defaultReps: 12, repRange: [10, 15], ...o });
const cardio = (id: string, name: string, legImpact: 'bajo' | 'alto', mins: number, range: [number, number]): Exercise =>
  base(id, name, 'aerobico', [], [], { discipline: 'Cardio', loadMode: 'tiempo', region: 'inferior', unit: 'min', step: 0, defaultLoad: 0, defaultReps: mins, repRange: range, legImpact });

/**
 * Built-in exercise library (editable by the user; custom ones are added alongside).
 * Order matters: on equal score the generator keeps the first match, so the original
 * core lifts stay ahead of their variations.
 */
export const SEED_EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Press banca', discipline: 'Pesas', loadMode: 'peso', pattern: 'empuje', plane: 'horizontal', region: 'superior', unit: 'reps', primary: ['pecho'], secondary: ['tri', 'delt'], step: 2.5, defaultLoad: 80, defaultReps: 8, repRange: [6, 10] },
  { id: 'row', name: 'Remo con barra', discipline: 'Pesas', loadMode: 'peso', pattern: 'traccion', plane: 'horizontal', region: 'superior', unit: 'reps', primary: ['dors', 'trap'], secondary: ['bic', 'deltp', 'lumb'], step: 2.5, defaultLoad: 70, defaultReps: 10, repRange: [8, 12] },
  { id: 'pull', name: 'Dominada lastrada', discipline: 'Calistenia', loadMode: 'lastre', pattern: 'traccion', plane: 'vertical', region: 'superior', unit: 'reps', primary: ['dors'], secondary: ['bic', 'ante', 'trap'], step: 1.25, defaultLoad: 15, defaultReps: 6, repRange: [5, 8] },
  { id: 'dips', name: 'Fondos lastrados', discipline: 'Calistenia', loadMode: 'lastre', pattern: 'empuje', plane: 'vertical', region: 'superior', unit: 'reps', primary: ['tri', 'pecho'], secondary: ['delt'], step: 1.25, defaultLoad: 20, defaultReps: 8, repRange: [6, 10] },
  { id: 'ohp', name: 'Press militar', discipline: 'Pesas', loadMode: 'peso', pattern: 'empuje', plane: 'vertical', region: 'superior', unit: 'reps', primary: ['delt'], secondary: ['tri', 'trap'], step: 2.5, defaultLoad: 47.5, defaultReps: 8, repRange: [6, 10] },
  { id: 'flever', name: 'Front lever', discipline: 'Calistenia', loadMode: 'palanca', pattern: 'traccion', plane: 'horizontal', region: 'superior', unit: 's', primary: ['dors'], secondary: ['abs', 'deltp'], step: 1, defaultLoad: 1, defaultReps: 10, repRange: [8, 20], levers: ['Tuck', 'Tuck avanzado', 'Una pierna', 'Straddle', 'Completo'] },
  { id: 'bulg', name: 'Sentadilla búlgara', discipline: 'Pesas', loadMode: 'peso', pattern: 'pierna', region: 'inferior', unit: 'reps', primary: ['quad', 'glut'], secondary: ['isq'], step: 2, defaultLoad: 22, defaultReps: 10, repRange: [8, 12] },
  { id: 'rdl', name: 'Peso muerto rumano', discipline: 'Pesas', loadMode: 'peso', pattern: 'bisagra', region: 'inferior', unit: 'reps', primary: ['isq', 'glut'], secondary: ['lumb'], step: 2.5, defaultLoad: 95, defaultReps: 8, repRange: [6, 10] },
  { id: 'calf', name: 'Elevación de gemelos', discipline: 'Pesas', loadMode: 'peso', pattern: 'pierna', region: 'inferior', unit: 'reps', primary: ['gem'], secondary: [], step: 5, defaultLoad: 60, defaultReps: 12, repRange: [10, 15] },
  { id: 'hlr', name: 'Elevación de piernas colgado', discipline: 'Core', loadMode: 'corporal', pattern: 'core', region: 'core', unit: 'reps', primary: ['abs'], secondary: ['obl', 'ante'], step: 0, defaultLoad: 0, defaultReps: 12, repRange: [10, 15] },
  { id: 'plank', name: 'Plancha RKC', discipline: 'Core', loadMode: 'tiempo', pattern: 'core', region: 'core', unit: 's', primary: ['abs'], secondary: ['obl'], step: 0, defaultLoad: 0, defaultReps: 40, repRange: [30, 60] },
  { id: 'pallof', name: 'Press Pallof', discipline: 'Core', loadMode: 'peso', pattern: 'core', region: 'core', unit: 'reps', primary: ['obl'], secondary: ['abs'], step: 1, defaultLoad: 18, defaultReps: 12, repRange: [10, 15] },
  { id: 'lat', name: 'Elevación lateral', discipline: 'Pesas', loadMode: 'peso', pattern: 'aislamiento', region: 'superior', unit: 'reps', primary: ['delt'], secondary: [], step: 1, defaultLoad: 12, defaultReps: 15, repRange: [12, 20] },
  { id: 'curl', name: 'Curl inclinado', discipline: 'Pesas', loadMode: 'peso', pattern: 'aislamiento', region: 'superior', unit: 'reps', primary: ['bic'], secondary: ['ante'], step: 1, defaultLoad: 14, defaultReps: 10, repRange: [8, 12] },
  { id: 'facepull', name: 'Face pull', discipline: 'Pesas', loadMode: 'peso', pattern: 'aislamiento', region: 'superior', unit: 'reps', primary: ['deltp'], secondary: ['trap'], step: 2.5, defaultLoad: 20, defaultReps: 15, repRange: [12, 20] },
  { id: 'triext', name: 'Extensión de tríceps', discipline: 'Pesas', loadMode: 'peso', pattern: 'aislamiento', region: 'superior', unit: 'reps', primary: ['tri'], secondary: [], step: 2.5, defaultLoad: 25, defaultReps: 12, repRange: [10, 15] },
  { id: 'z2', name: 'Carrera Z2', discipline: 'Cardio', loadMode: 'tiempo', pattern: 'aerobico', region: 'inferior', unit: 'min', primary: [], secondary: [], step: 0, defaultLoad: 0, defaultReps: 12, repRange: [10, 30], legImpact: 'bajo' },

  // ---- Pecho ----
  w('incline_db', 'Press inclinado con mancuernas', 'empuje', ['pecho'], ['delt', 'tri'], { plane: 'horizontal', step: 2, defaultLoad: 28 }),
  w('db_bench', 'Press banca con mancuernas', 'empuje', ['pecho'], ['tri', 'delt'], { plane: 'horizontal', step: 2, defaultLoad: 30 }),
  cal('pushup', 'Flexiones', 'empuje', ['pecho'], ['tri', 'delt'], { plane: 'horizontal', defaultReps: 15, repRange: [10, 25] }),
  cal('pushup_w', 'Flexiones lastradas', 'empuje', ['pecho'], ['tri', 'delt'], { plane: 'horizontal', loadMode: 'lastre', step: 2.5, defaultLoad: 10, defaultReps: 10, repRange: [8, 15] }),
  lever('archer_pu', 'Flexiones arquero → a una mano', 'empuje', ['pecho'], ['tri', 'delt'], ['Inclinadas', 'Arquero asistida', 'Arquero', 'Una mano inclinada', 'Una mano'], { plane: 'horizontal' }),
  iso('cable_fly', 'Aperturas en polea', ['pecho'], ['delt'], { step: 2.5, defaultLoad: 15 }),
  iso('pec_deck', 'Contractora (pec deck)', ['pecho'], [], { step: 5, defaultLoad: 50 }),

  // ---- Espalda ----
  w('latpull', 'Jalón al pecho', 'traccion', ['dors'], ['bic', 'deltp'], { plane: 'vertical', defaultLoad: 60 }),
  cal('pullup_bw', 'Dominada', 'traccion', ['dors'], ['bic', 'ante', 'trap'], { plane: 'vertical', defaultReps: 8, repRange: [5, 12] }),
  cal('chinup', 'Dominada supina', 'traccion', ['dors'], ['bic', 'ante'], { plane: 'vertical', defaultReps: 8, repRange: [5, 12] }),
  cal('muscleup', 'Muscle-up', 'traccion', ['dors'], ['tri', 'pecho', 'bic'], { plane: 'vertical', defaultReps: 4, repRange: [3, 6], advanced: true }),
  w('db_row', 'Remo con mancuerna', 'traccion', ['dors'], ['bic', 'deltp', 'trap'], { plane: 'horizontal', step: 2, defaultLoad: 32 }),
  w('cable_row', 'Remo en polea baja', 'traccion', ['dors'], ['trap', 'bic', 'deltp'], { plane: 'horizontal', defaultLoad: 55, defaultReps: 12, repRange: [10, 15] }),
  cal('inv_row', 'Remo invertido', 'traccion', ['dors'], ['trap', 'bic', 'deltp'], { plane: 'horizontal', defaultReps: 12, repRange: [8, 15] }),
  iso('pullover', 'Pullover en polea', ['dors'], ['tri'], { step: 2.5, defaultLoad: 25 }),
  iso('shrug', 'Encogimientos con mancuernas', ['trap'], ['ante'], { step: 2, defaultLoad: 30 }),
  w('backext', 'Hiperextensión lumbar', 'bisagra', ['lumb'], ['glut', 'isq'], { region: 'inferior', loadMode: 'lastre', defaultLoad: 10, defaultReps: 12, repRange: [10, 15] }),

  // ---- Hombros ----
  w('db_ohp', 'Press de hombros con mancuernas', 'empuje', ['delt'], ['tri'], { plane: 'vertical', step: 2, defaultLoad: 22 }),
  w('landmine', 'Press landmine', 'empuje', ['delt'], ['pecho', 'tri'], { plane: 'vertical', defaultLoad: 25 }),
  lever('hspu', 'Pike → flexión en pino', 'empuje', ['delt'], ['tri', 'trap'], ['Pike', 'Pike elevado', 'Pino asistido en pared', 'Pino en pared', 'Pino libre'], { plane: 'vertical' }),
  iso('cable_lat', 'Elevación lateral en polea', ['delt'], [], { step: 1.25, defaultLoad: 7.5, defaultReps: 15, repRange: [12, 20] }),
  iso('rear_fly', 'Pájaros (deltoides posterior)', ['deltp'], ['trap'], { step: 1, defaultLoad: 8, defaultReps: 15, repRange: [12, 20] }),
  iso('ytw', 'Y-T-W en banco inclinado', ['deltp'], ['trap'], { step: 1, defaultLoad: 4, defaultReps: 12, repRange: [10, 15] }),

  // ---- Brazos ----
  iso('bb_curl', 'Curl con barra', ['bic'], ['ante'], { step: 2.5, defaultLoad: 30 }),
  iso('hammer', 'Curl martillo', ['bic'], ['ante'], { step: 1, defaultLoad: 14 }),
  iso('preacher', 'Curl predicador', ['bic'], [], { step: 2.5, defaultLoad: 25 }),
  iso('skull', 'Press francés', ['tri'], [], { step: 2.5, defaultLoad: 30 }),
  iso('pushdown', 'Extensión en polea (pushdown)', ['tri'], [], { step: 2.5, defaultLoad: 30, defaultReps: 12, repRange: [10, 15] }),
  w('cgbench', 'Press banca agarre cerrado', 'empuje', ['tri'], ['pecho', 'delt'], { plane: 'horizontal', defaultLoad: 65, defaultReps: 8, repRange: [6, 10] }),
  iso('wrist', 'Curl de muñeca', ['ante'], [], { step: 1, defaultLoad: 15, defaultReps: 15, repRange: [12, 20] }),
  { id: 'farmer', name: 'Paseo del granjero', discipline: 'Pesas', loadMode: 'peso', pattern: 'core', region: 'core', unit: 's', primary: ['ante'], secondary: ['trap', 'obl'], step: 2, defaultLoad: 32, defaultReps: 40, repRange: [30, 60] },

  // ---- Piernas ----
  w('squat', 'Sentadilla trasera', 'pierna', ['quad', 'glut'], ['isq'], { region: 'inferior', step: 5, defaultLoad: 100, defaultReps: 6, repRange: [5, 8] }),
  w('goblet', 'Sentadilla goblet', 'pierna', ['quad'], ['glut'], { region: 'inferior', step: 2, defaultLoad: 28, defaultReps: 12, repRange: [10, 15] }),
  w('legpress', 'Prensa de piernas', 'pierna', ['quad'], ['glut'], { region: 'inferior', step: 10, defaultLoad: 160 }),
  w('lunge', 'Zancadas caminando', 'pierna', ['quad', 'glut'], ['isq'], { region: 'inferior', step: 2, defaultLoad: 16, defaultReps: 12, repRange: [10, 14] }),
  w('stepup', 'Subida al cajón', 'pierna', ['quad', 'glut'], ['isq'], { region: 'inferior', step: 2, defaultLoad: 16 }),
  lever('pistol', 'Sentadilla pistol', 'pierna', ['quad', 'glut'], ['isq'], ['A caja', 'Asistida', 'Talón elevado', 'Completa', 'Lastrada'], { region: 'inferior' }),
  w('legext', 'Extensión de cuádriceps', 'pierna', ['quad'], [], { region: 'inferior', step: 5, defaultLoad: 45, defaultReps: 12, repRange: [10, 15] }),
  w('legcurl', 'Curl femoral tumbado', 'pierna', ['isq'], ['gem'], { region: 'inferior', step: 5, defaultLoad: 35, defaultReps: 12, repRange: [10, 15] }),
  w('deadlift', 'Peso muerto', 'bisagra', ['glut', 'isq'], ['lumb', 'trap', 'quad'], { region: 'inferior', step: 5, defaultLoad: 120, defaultReps: 5, repRange: [3, 6], advanced: true }),
  w('hipthrust', 'Hip thrust', 'bisagra', ['glut'], ['isq'], { region: 'inferior', step: 5, defaultLoad: 100 }),
  w('kbswing', 'Swing con kettlebell', 'bisagra', ['glut', 'isq'], ['lumb'], { region: 'inferior', step: 4, defaultLoad: 24, defaultReps: 15, repRange: [12, 20] }),
  lever('nordic', 'Curl nórdico', 'bisagra', ['isq'], ['gem'], ['Excéntrico parcial', 'Excéntrico completo', 'Asistido con banda', 'Completo'], { region: 'inferior', defaultReps: 5, repRange: [3, 8] }),
  w('seated_calf', 'Gemelo sentado', 'pierna', ['gem'], [], { region: 'inferior', step: 5, defaultLoad: 40, defaultReps: 15, repRange: [12, 20] }),

  // ---- Core ----
  core('abwheel', 'Rueda abdominal', ['abs'], ['obl'], { loadMode: 'corporal', defaultReps: 10, repRange: [8, 15] }),
  core('cablecrunch', 'Crunch en polea', ['abs'], [], { loadMode: 'peso', step: 2.5, defaultLoad: 35 }),
  core('deadbug', 'Dead bug', ['abs'], ['obl'], { loadMode: 'corporal', defaultReps: 10, repRange: [8, 12] }),
  core('sideplank', 'Plancha lateral', ['obl'], ['abs'], { loadMode: 'tiempo', unit: 's', defaultReps: 30, repRange: [20, 45] }),
  core('woodchop', 'Leñador en polea', ['obl'], ['abs'], { loadMode: 'peso', step: 2.5, defaultLoad: 15 }),
  core('suitcase', 'Paseo con maleta', ['obl'], ['ante'], { loadMode: 'peso', unit: 's', step: 2, defaultLoad: 24, defaultReps: 40, repRange: [30, 60] }),
  { id: 'lsit', name: 'L-sit → V-sit', discipline: 'Calistenia', loadMode: 'palanca', pattern: 'core', region: 'core', unit: 's', primary: ['abs'], secondary: ['obl'], step: 1, defaultLoad: 1, defaultReps: 10, repRange: [8, 20], levers: ['Tuck', 'Una pierna', 'L-sit', 'V-sit'] },

  // ---- Cardio ----
  cardio('bike', 'Bicicleta Z2', 'bajo', 20, [10, 45]),
  cardio('rower', 'Remoergómetro Z2', 'bajo', 15, [10, 30]),
  cardio('incline_walk', 'Caminata en cinta inclinada', 'bajo', 20, [15, 45]),
  { ...cardio('hiit', 'Intervalos HIIT', 'alto', 12, [8, 20]), advanced: true },
  cardio('jumprope', 'Comba', 'alto', 10, [5, 15]),
];

export const DISCIPLINES = ['Pesas', 'Calistenia', 'Core', 'Cardio'] as const;
export const PATTERN_LABEL: Record<Exercise['pattern'], string> = {
  empuje: 'Empuje', traccion: 'Tracción', pierna: 'Pierna', bisagra: 'Bisagra', core: 'Core', aislamiento: 'Aislamiento', aerobico: 'Aeróbico',
};
export const LOAD_MODE_LABEL: Record<Exercise['loadMode'], string> = {
  peso: 'Peso (kg)', lastre: 'Lastre (+kg)', corporal: 'Peso corporal', palanca: 'Palanca', tiempo: 'Tiempo',
};

/** Body sections used to organise the library; an exercise belongs to the group of its first primary muscle. */
export const MUSCLE_GROUPS = [
  { key: 'pecho', label: 'Pecho', muscles: ['pecho'] },
  { key: 'espalda', label: 'Espalda', muscles: ['dors', 'trap', 'lumb'] },
  { key: 'hombros', label: 'Hombros', muscles: ['delt', 'deltp'] },
  { key: 'biceps', label: 'Bíceps', muscles: ['bic', 'ante'] },
  { key: 'triceps', label: 'Tríceps', muscles: ['tri'] },
  { key: 'piernas', label: 'Piernas', muscles: ['quad', 'glut', 'isq', 'gem'] },
  { key: 'core', label: 'Core', muscles: ['abs', 'obl'] },
  { key: 'cardio', label: 'Cardio', muscles: [] },
] as const satisfies readonly { key: string; label: string; muscles: readonly MuscleKey[] }[];

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]['key'];

export function groupOf(e: Exercise): MuscleGroup {
  const m = e.primary[0];
  if (!m) return 'cardio';
  return MUSCLE_GROUPS.find((g) => (g.muscles as readonly MuscleKey[]).includes(m))?.key ?? 'core';
}
