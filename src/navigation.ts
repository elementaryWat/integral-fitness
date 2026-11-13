import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { create } from 'zustand';
import type { WatchLive } from './watch/relay';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  ExerciseLibrary: undefined;
  ExerciseEdit: { id?: string };
  FoodAdd: undefined;
  BodyEntry: undefined;
  ActivityEntry: undefined;
  ProfileEdit: undefined;
  WatchPair: undefined;
  FoodScan: { kind: 'plato' | 'etiqueta' | 'ticket' };
  ExercisePicker: { mode: 'replace' | 'add' | 'addBlock'; block?: number; index?: number };
  Routines: undefined;
};

export type TabParamList = {
  Hoy: undefined;
  Entreno: undefined;
  Nutricion: undefined;
  Cuerpo: undefined;
  Coach: undefined;
};

export const useNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList & TabParamList>>();

/** Ephemeral UI state (not persisted). */
export type WatchStatus = 'off' | 'ok' | 'error';

export const useUi = create<{
  watchOpen: boolean;
  setWatchOpen: (v: boolean) => void;
  /** Real watch link state (relay reachable) and the latest heart rate / mode it reported. */
  watchStatus: WatchStatus;
  watchLive: WatchLive | null;
  /** Last sync error, shown on the pairing screen */
  watchError: string | null;
  /** Last Apple Health read result, shown on the recovery card when HRV is missing */
  healthStatus: string | null;
  setHealth: (s: string | null) => void;
  setWatch: (p: { watchStatus?: WatchStatus; watchLive?: WatchLive | null; watchError?: string | null }) => void;
}>((set) => ({
  watchOpen: false,
  setWatchOpen: (watchOpen) => set({ watchOpen }),
  watchStatus: 'off',
  watchLive: null,
  watchError: null,
  healthStatus: null,
  setHealth: (healthStatus) => set({ healthStatus }),
  setWatch: (p) => set(p),
}));
