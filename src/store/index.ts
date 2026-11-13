import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { SEED_EXERCISES, type MuscleGroup } from '../domain/catalog';
import { today, uid } from '../domain/dates';
import type {
  AiCoachReview, BodyComp, CoachState, PantryItem, DailyActivity, DayType, Exercise, FoodEntry, ISODate, Perimeters, PlannedBlock,
  Profile, ProgressPhoto, Proposal, Session, SetLog, WeighIn,
} from '../domain/types';
import type { Recalibration } from '../engines/energy';
import { buildQueue, type Minutes } from '../engines/generator';
import type { Routine } from '../engines/planEdit';
import { sanitizeSettings, withSeedExercises } from './seedMerge';
import { newPairCode, type WatchLink } from '../watch/relay';

const mmkv = createMMKV({ id: 'recomp' });
const storage: StateStorage = {
  getItem: (k) => mmkv.getString(k) ?? null,
  setItem: (k, v) => mmkv.set(k, v),
  removeItem: (k) => { mmkv.remove(k); },
};

/** Session edited by hand for a given day; `routineId` when it was loaded from a saved routine. */
export interface PlanDraft {
  date: ISODate;
  blocks: PlannedBlock[];
  name?: string;
  routineId?: string;
  /** Why the AI built it this way (shown above the blocks) */
  note?: string;
}

export interface Settings {
  /** Max rest between supersets (s) */
  restSec: number;
  /** HR recovery threshold that ends rest (bpm) */
  hrThreshold: number;
  /** Watch simulator speed multiplier */
  simSpeed: number;
  plannedMinutes: Minutes;
  /** Muscle groups chosen for today's session; empty = balanced 80/20 plan */
  focus: MuscleGroup[];
  /** Exercise swaps chosen in the plan (generated id → replacement id) */
  swaps: Record<string, string>;
  /** Link to the Zepp OS watch app through the relay server */
  watch: WatchLink;
}

export interface AppState {
  profile?: Profile;
  exercises: Exercise[];
  sessions: Session[];
  activeSession?: Session;
  weighIns: WeighIn[];
  bodyComps: BodyComp[];
  perimeters: Perimeters[];
  photos: ProgressPhoto[];
  foods: FoodEntry[];
  pantry: PantryItem[];
  /** Today's hand-edited session (replaces the generated plan for that date) */
  planDraft?: PlanDraft;
  routines: Routine[];
  activity: DailyActivity[];
  dayTypeOverride: Record<ISODate, DayType>;
  coach: CoachState;
  settings: Settings;

  setProfile: (p: Profile) => void;
  updateSettings: (s: Partial<Settings>) => void;

  upsertExercise: (e: Exercise) => void;
  setArchived: (id: string, archived: boolean) => void;

  startSession: (blocks: PlannedBlock[], minutes: Minutes, deload: boolean) => void;
  logSet: (log: SetLog) => void;
  /** Insert or replace a set by id (sets recorded on the watch, HRR-60 updates). */
  upsertSet: (log: SetLog) => void;
  finishSession: () => void;
  discardSession: () => void;

  addWeighIn: (w: WeighIn) => void;
  addBodyComp: (b: BodyComp) => void;
  addPerimeters: (p: Perimeters) => void;
  addPhoto: (p: ProgressPhoto) => void;
  removePhoto: (id: string) => void;

  addFood: (f: Omit<FoodEntry, 'id'>) => void;
  removeFood: (id: string) => void;
  /** Adds products to the pantry, replacing any with the same name. */
  addPantry: (items: Omit<PantryItem, 'id' | 'addedAt'>[]) => void;
  removePantry: (id: string) => void;
  setAiReview: (weekOf: ISODate, review: AiCoachReview) => void;
  setPlanDraft: (d: PlanDraft | undefined) => void;
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  setActivity: (a: DailyActivity) => void;
  setDayType: (date: ISODate, t: DayType | undefined) => void;

  applyProposals: (ps: Proposal[], weekOf: ISODate) => void;
  applyRecalibration: (r: Recalibration, date: ISODate) => void;

  replaceAll: (data: Partial<AppState>) => void;
  reset: () => void;
}

const freshCoach = (): CoachState => ({ kcalOffset: 0, restDayKcal: 0, volumeDelta: {}, mesoStart: today() });

const initialData = () => ({
  profile: undefined,
  exercises: SEED_EXERCISES,
  sessions: [] as Session[],
  activeSession: undefined,
  weighIns: [] as WeighIn[],
  bodyComps: [] as BodyComp[],
  perimeters: [] as Perimeters[],
  photos: [] as ProgressPhoto[],
  foods: [] as FoodEntry[],
  pantry: [] as PantryItem[],
  planDraft: undefined as PlanDraft | undefined,
  routines: [] as Routine[],
  activity: [] as DailyActivity[],
  dayTypeOverride: {} as Record<ISODate, DayType>,
  coach: freshCoach(),
  settings: { restSec: 90, hrThreshold: 112, simSpeed: 3, plannedMinutes: 45 as Minutes, focus: [] as MuscleGroup[], swaps: {} as Record<string, string>, watch: { enabled: false, serverUrl: '', code: newPairCode() } as WatchLink },
});

/** Replace the entry for the same date, keeping the list sorted by date. */
const byDate = <T extends { date: ISODate }>(list: T[], item: T) =>
  [...list.filter((x) => x.date !== item.date), item].sort((a, b) => (a.date < b.date ? -1 : 1));

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialData(),

      setProfile: (profile) => set((s) => ({
        profile,
        weighIns: s.weighIns.length ? s.weighIns : [{ date: profile.createdAt, kg: profile.startWeightKg }],
        coach: { ...s.coach, mesoStart: s.coach.mesoStart ?? profile.createdAt },
      })),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      upsertExercise: (e) => set((s) => ({ exercises: s.exercises.some((x) => x.id === e.id) ? s.exercises.map((x) => (x.id === e.id ? e : x)) : [...s.exercises, e] })),
      setArchived: (id, archived) => set((s) => ({ exercises: s.exercises.map((x) => (x.id === id ? { ...x, archived } : x)) })),

      startSession: (blocks, minutes, deload) => set(() => ({
        activeSession: { id: uid(), date: today(), plannedMinutes: minutes, startedAt: Date.now(), blocks, queue: buildQueue(blocks), sets: [], deload },
      })),
      logSet: (log) => set((s) => (s.activeSession ? { activeSession: { ...s.activeSession, sets: [...s.activeSession.sets, log] } } : {})),
      upsertSet: (log) => set((s) => {
        const a = s.activeSession;
        if (!a) return {};
        const others = a.sets.filter((x) => x.id !== log.id && x.qi !== log.qi);
        return { activeSession: { ...a, sets: [...others, log].sort((x, y) => x.qi - y.qi) } };
      }),
      finishSession: () => set((s) => {
        const a = s.activeSession;
        if (!a) return {};
        if (!a.sets.length) return { activeSession: undefined };
        return { activeSession: undefined, sessions: [...s.sessions, { ...a, endedAt: a.sets.at(-1)!.endedAt }] };
      }),
      discardSession: () => set({ activeSession: undefined }),

      addWeighIn: (w) => set((s) => ({ weighIns: byDate(s.weighIns, w) })),
      addBodyComp: (b) => set((s) => ({ bodyComps: byDate(s.bodyComps, b) })),
      addPerimeters: (p) => set((s) => ({ perimeters: byDate(s.perimeters, p) })),
      addPhoto: (p) => set((s) => ({ photos: [...s.photos.filter((x) => !(x.date === p.date && x.view === p.view)), p] })),
      removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),

      addFood: (f) => set((s) => ({ foods: [...s.foods, { ...f, id: uid() }] })),
      removeFood: (id) => set((s) => ({ foods: s.foods.filter((f) => f.id !== id) })),
      addPantry: (items) => set((s) => {
        const names = new Set(items.map((i) => i.name.trim().toLowerCase()));
        const added = items.map((i) => ({ ...i, name: i.name.trim(), id: uid(), addedAt: today() }));
        return { pantry: [...added, ...s.pantry.filter((p) => !names.has(p.name.toLowerCase()))] };
      }),
      removePantry: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      setPlanDraft: (planDraft) => set({ planDraft }),
      saveRoutine: (r) => set((s) => ({ routines: [r, ...s.routines.filter((x) => x.id !== r.id && x.name.toLowerCase() !== r.name.toLowerCase())] })),
      deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      setAiReview: (weekOf, review) => set((s) => ({ coach: { ...s.coach, aiReview: { ...s.coach.aiReview, [weekOf]: review } } })),
      setActivity: (a) => set((s) => ({ activity: byDate(s.activity, { ...s.activity.find((x) => x.date === a.date), ...a }) })),
      setDayType: (date, t) => set((s) => {
        const next = { ...s.dayTypeOverride };
        if (t) next[date] = t; else delete next[date];
        return { dayTypeOverride: next };
      }),

      applyProposals: (ps, weekOf) => set((s) => {
        const coach = { ...s.coach, volumeDelta: { ...s.coach.volumeDelta }, appliedWeekOf: weekOf };
        for (const p of ps) {
          const a = p.action;
          if (a.type === 'volume') coach.volumeDelta[a.muscle] = (coach.volumeDelta[a.muscle] ?? 0) + a.delta;
          else if (a.type === 'kcal' && a.dayType === 'Descanso') coach.restDayKcal += a.delta;
          else if (a.type === 'kcal') coach.kcalOffset += a.delta;
          else if (a.type === 'deload') coach.deloadWeekOf = a.weekOf;
        }
        return { coach };
      }),
      applyRecalibration: (r, date) => set((s) => ({
        coach: { ...s.coach, kcalOffset: s.coach.kcalOffset + r.delta, lastRecalibration: { date, delta: r.delta, observedKgWk: r.observedKgWk, expectedKgWk: r.expectedKgWk } },
      })),

      replaceAll: (data) => set(data),
      reset: () => set(initialData()),
    }),
    {
      name: 'recomp-store',
      version: 1,
      storage: createJSONStorage(() => storage),
      // Built-in exercises added in later versions reach existing users; their own edits win.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, exercises: withSeedExercises(p.exercises ?? current.exercises), settings: sanitizeSettings({ ...current.settings, ...p.settings }) };
      },
      // Persist data only; actions come from the store definition.
      partialize: ({ profile, exercises, sessions, activeSession, weighIns, bodyComps, perimeters, photos, foods, pantry, planDraft, routines, activity, dayTypeOverride, coach, settings }) =>
        ({ profile, exercises, sessions, activeSession, weighIns, bodyComps, perimeters, photos, foods, pantry, planDraft, routines, activity, dayTypeOverride, coach, settings }),
    },
  ),
);
