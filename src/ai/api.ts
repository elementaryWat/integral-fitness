import type { WatchLink } from '../watch/relay';
import { cleanUrl } from '../watch/relay';

/** Shapes returned by the server (server/src/ai/schemas.js). */
export interface Macros100 { kcal: number; p: number; c: number; f: number }
export interface ScanItem extends Macros100 { name: string; grams: number; per100: Macros100 | null; confidence: 'alta' | 'media' | 'baja' }
export type ScanKind = 'plato' | 'etiqueta' | 'ticket';
export interface FoodScan { kind: ScanKind; title: string; items: ScanItem[]; notes: string }
export interface ExerciseDraftRaw {
  name: string; discipline: string; loadMode: string; pattern: string; plane: string | null; region: string; unit: string;
  primary: string[]; secondary: string[]; step: number; defaultLoad: number; defaultReps: number; repMin: number; repMax: number;
  levers: string[] | null; legImpact: string | null; notes: string;
}
export interface CoachNarrative { headline: string; summary: string; wins: string[]; watch: string[]; photoNote: string | null }

/** The AI shares the relay server and pairing code with the watch link. */
export const aiReady = (l: WatchLink | undefined) => !!l && /^https?:\/\/.+/.test(cleanUrl(l.serverUrl)) && /^[A-Z0-9]{6,12}$/.test(l.code);

export class AiRequestError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

async function post<T>(l: WatchLink, action: string, body: unknown): Promise<T> {
  if (!aiReady(l)) throw new AiRequestError('Configura el servidor en Hoy → Bip 6 → Reloj para usar la IA.', 'no_server');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`${cleanUrl(l.serverUrl)}/v1/${l.code}/ai/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiRequestError(data.error ?? `Error del servidor (${res.status})`, data.code ?? 'http');
    return data as T;
  } catch (e) {
    if (e instanceof AiRequestError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new AiRequestError('La IA tardó demasiado. Vuelve a intentarlo.', 'timeout');
    throw new AiRequestError('No hay conexión con el servidor de Recomp.', 'network');
  } finally {
    clearTimeout(t);
  }
}

export const scanFood = (l: WatchLink, image: string, hint?: ScanKind) => post<FoodScan>(l, 'scan', { image, hint });
export const draftExercise = (l: WatchLink, text: string) => post<ExerciseDraftRaw>(l, 'exercise', { text });
export const coachReview = (l: WatchLink, review: unknown, stats: unknown, photos?: [string, string]) => post<CoachNarrative>(l, 'coach', { review, stats, photos });

export interface RoutineRequest {
  groups: string[];
  minutes: number;
  experience?: string;
  goal?: string;
  deload: boolean;
  muscles: Record<string, { sets: number; target: number; rec: number; status: string }>;
  catalog: { id: string; name: string; primary: string[]; secondary: string[]; pattern: string; plane?: string; discipline: string; advanced?: boolean }[];
}
export const buildRoutine = (l: WatchLink, req: RoutineRequest) => post<import('../engines/planEdit').AiRoutineResponse>(l, 'routine', req);
