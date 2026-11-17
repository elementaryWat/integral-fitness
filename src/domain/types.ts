import type { Meal } from './meals';
import type { MuscleKey, Region } from './muscles';

export type { MuscleKey, Region };

/** yyyy-mm-dd in local time */
export type ISODate = string;

export type Sex = 'h' | 'm';

export type Goal = 'recomp' | 'definir' | 'volumen' | 'mantener';
export type Pace = 'suave' | 'moderado' | 'rapido';
export type ActivityLevel = 'sedentario' | 'ligero' | 'activo' | 'muy-activo';
export type Experience = 'principiante' | 'intermedio' | 'avanzado';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  startWeightKg: number;
  /** Daily deficit applied to TDEE (kcal) */
  deficitKcal: number;
  proteinGPerKg: number;
  /** ISO weekdays (1 = lunes … 7 = domingo) usually trained */
  trainingDays: number[];
  createdAt: ISODate;
  goal?: Goal;
  pace?: Pace;
  targetWeightKg?: number;
  /** Planned weekly weight change (kg/week, negative = loss) */
  targetRateKgWk?: number;
  /** Fallback daily activity when no steps/active kcal are logged */
  activityLevel?: ActivityLevel;
  experience?: Experience;
}

// ---------- training ----------

export type Discipline = 'Pesas' | 'Calistenia' | 'Core' | 'Cardio';
/**
 * peso: external load in kg · lastre: kg added to bodyweight · corporal: bodyweight reps
 * palanca: lever progression level (index into `levers`) · tiempo: duration only
 */
export type LoadMode = 'peso' | 'lastre' | 'corporal' | 'palanca' | 'tiempo';
export type Pattern = 'empuje' | 'traccion' | 'pierna' | 'bisagra' | 'core' | 'aislamiento' | 'aerobico';
export type Plane = 'horizontal' | 'vertical';
export type Unit = 'reps' | 's' | 'min';

export interface Exercise {
  id: string;
  name: string;
  discipline: Discipline;
  loadMode: LoadMode;
  pattern: Pattern;
  plane?: Plane;
  region: Region;
  unit: Unit;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  /** Load increment (kg, or 1 lever level). 0 = no load progression. */
  step: number;
  defaultLoad: number;
  defaultReps: number;
  repRange: [number, number];
  levers?: string[];
  /** Cardio: impact on leg recovery */
  legImpact?: 'bajo' | 'alto';
  archived?: boolean;
  custom?: boolean;
  /** Demanding skill or heavy lift: the generator only picks it for advanced lifters. */
  advanced?: boolean;
  /** Own technique cues (custom exercises, or edited ones). Built-ins fall back to TECHNIQUE[id]. */
  technique?: ExerciseTechnique;
}

/** How to perform an exercise: short, actionable cues. */
export interface ExerciseTechnique {
  setup: string[];
  steps: string[];
  /** Common mistake → fix. */
  mistakes: string[];
  /** Where you should feel it (highlighted on the body map). */
  feel: MuscleKey[];
  tip?: string;
}

export type BlockKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface PlannedItem {
  exerciseId: string;
  sets: number;
  load: number;
  reps: number;
}

export interface PlannedBlock {
  key: BlockKey;
  title: string;
  kind: 'superserie' | 'cardio';
  items: PlannedItem[];
  restSec: number;
}

export interface QueueItem {
  block: BlockKey;
  pos: number;
  exerciseId: string;
  set: number;
  sets: number;
  load: number;
  reps: number;
}

export interface SetLog {
  id: string;
  /** Index into the session queue */
  qi: number;
  exerciseId: string;
  block: BlockKey;
  load: number;
  reps: number;
  rpe: number;
  startedAt: number;
  endedAt: number;
  hrPeak?: number;
  /** HR drop 60 s after the set (bpm) */
  hrr60?: number;
  /** Velocity loss within the set, 0–1 (accelerometer, Fase 3) */
  velocityLoss?: number;
  /** Skipped on the watch or the phone: marks the queue slot as done, not counted as work */
  skipped?: boolean;
}

export type SessionSource = 'reloj' | 'movil';

export interface Session {
  id: string;
  date: ISODate;
  plannedMinutes: 35 | 45 | 60;
  startedAt: number;
  endedAt?: number;
  blocks: PlannedBlock[];
  queue: QueueItem[];
  sets: SetLog[];
  deload: boolean;
  /** How you felt at the end (asked in the summary) */
  feel?: SessionFeel;
}

/** 1 agotado · 2 cansado · 3 normal · 4 bien · 5 con energía */
export interface SessionFeel { score: 1 | 2 | 3 | 4 | 5; tags?: string[]; at: number }

// ---------- body ----------

export interface WeighIn { date: ISODate; kg: number }
export interface BodyComp { date: ISODate; fatPct?: number; smmKg?: number }
export interface Perimeters { date: ISODate; waist?: number; chest?: number; arm?: number; thigh?: number }
export type PhotoView = 'frente' | 'perfil' | 'espalda';
export interface ProgressPhoto {
  id: string;
  date: ISODate;
  view: PhotoView;
  uri: string;
  tags: { weightKg?: number; kcalAvg?: number; proteinAvg?: number; phase?: string };
}

// ---------- nutrition & activity ----------

export type DayType = 'Pesado' | 'Moderado' | 'Descanso';

export interface Macros { p: number; c: number; f: number }

export interface FoodEntry extends Macros {
  id: string;
  date: ISODate;
  name: string;
  grams: number;
  kcal: number;
  /** Desayuno, almuerzo, snack o cena. Old entries have none. */
  meal?: Meal;
}

/** Daily wearable data (manual until Apple Health / Health Connect in Fase 4). */
export interface DailyActivity {
  date: ISODate;
  steps?: number;
  activeKcal?: number;
  deepSleepMin?: number;
  sleepMin?: number;
  hrvMs?: number;
  restingHr?: number;
  /** Sleep stages (min) and the watch's sleep score */
  remMin?: number;
  lightMin?: number;
  awakeMin?: number;
  sleepScore?: number;
  /** Zepp stress 1–100 (HRV-based): day average and while asleep */
  stressAvg?: number;
  nightStress?: number;
  pai?: number;
}

// ---------- coach ----------

export type ProposalAction =
  | { type: 'volume'; muscle: MuscleKey; delta: number }
  | { type: 'kcal'; delta: number; dayType?: DayType }
  | { type: 'deload'; weekOf: ISODate };

export interface Proposal {
  id: string;
  title: string;
  detail: string;
  action: ProposalAction;
}

export interface Signal {
  id: string;
  tone: 'fatiga' | 'rezagado' | 'ok';
  title: string;
  detail: string;
}

export interface CoachState {
  /** Daily kcal offset on top of TDEE − deficit (recalibration + accepted proposals) */
  kcalOffset: number;
  /** Extra kcal on rest days only */
  restDayKcal: number;
  /** Desired change of weekly hard sets per muscle */
  volumeDelta: Partial<Record<MuscleKey, number>>;
  deloadWeekOf?: ISODate;
  mesoStart: ISODate;
  lastRecalibration?: { date: ISODate; delta: number; observedKgWk: number; expectedKgWk: number };
  appliedWeekOf?: ISODate;
  /** AI-written weekly review, cached per week (Fase 2) */
  aiReview?: Record<ISODate, AiCoachReview>;
  /** AI read of the progress photos, keyed by the date of the photo set */
  physique?: Record<ISODate, PhysiqueReview>;
}

export interface PhysiqueReview {
  headline: string;
  observations: string[];
  strengths: string[];
  priorities: string[];
  bodyFat: { low: number; high: number; note: string } | null;
  dataCheck: string;
  comparison: string | null;
  actions: string[];
  at: number;
  /** Photo ids it looked at */
  photoIds: string[];
}

export interface AiCoachReview {
  headline: string;
  summary: string;
  wins: string[];
  watch: string[];
  photoNote: string | null;
  at: number;
  /** Snapshot of the data it was based on (weight, sessions, foods…) to tell when it is outdated */
  basis?: string;
}

/** Product saved from a label or receipt scan, logged later by grams. */
export interface PantryItem {
  id: string;
  name: string;
  per100: { kcal: number; p: number; c: number; f: number };
  addedAt: ISODate;
}
