import type { BlockKey, Exercise, PlannedBlock, Session } from '../domain/types';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import { SHORT } from './focus';
import { estimateMinutes } from './generator';
import { lastPerformance, suggestNext } from './progression';
import type { ExMap } from './volume';

export const MAX_BLOCKS = 6;
export const MAX_PER_BLOCK = 3;
export const MAX_ROUNDS = 6;
const KEYS: BlockKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** A saved routine: blocks of exercises (supersets) with their rounds; loads come from history when loaded. */
export interface Routine {
  id: string;
  name: string;
  blocks: { exerciseIds: string[]; rounds: number }[];
  createdAt: string;
}

export interface EditCtx { ex: ExMap; history: Session[]; deload: boolean; restSec: number }

const titleFor = (ids: string[], ex: ExMap) => {
  const names = [...new Set(ids.map((id) => ex[id]?.primary[0]).filter((m): m is MuscleKey => !!m).map((m) => SHORT[m]))];
  if (names.length) return names.join(' + ');
  return ids.some((id) => ex[id]?.discipline === 'Cardio') ? 'Aeróbico' : 'Bloque';
};

const item = (e: Exercise, sets: number, ctx: EditCtx) =>
  e.discipline === 'Cardio' ? { exerciseId: e.id, sets: 1, load: 0, reps: e.defaultReps } : { exerciseId: e.id, sets, ...suggestNext(e, lastPerformance(ctx.history, e.id), ctx.deload) };

/** Re-letters blocks in order and refreshes their titles and kind. */
export function normalize(blocks: PlannedBlock[], ex: ExMap): PlannedBlock[] {
  return blocks
    .filter((b) => b.items.length)
    .slice(0, MAX_BLOCKS)
    .map((b, i) => {
      const cardio = b.items.every((it) => ex[it.exerciseId]?.discipline === 'Cardio');
      return { ...b, key: KEYS[i], kind: cardio ? 'cardio' : 'superserie', title: titleFor(b.items.map((it) => it.exerciseId), ex) };
    });
}

const rounds = (b: PlannedBlock) => Math.max(1, ...b.items.map((i) => i.sets));
const clone = (blocks: PlannedBlock[]) => blocks.map((b) => ({ ...b, items: b.items.map((i) => ({ ...i })) }));

export function replaceExercise(blocks: PlannedBlock[], bi: number, ii: number, e: Exercise, ctx: EditCtx) {
  const out = clone(blocks);
  out[bi].items[ii] = item(e, out[bi].items[ii].sets, ctx);
  return normalize(out, ctx.ex);
}

export function addToBlock(blocks: PlannedBlock[], bi: number, e: Exercise, ctx: EditCtx) {
  const out = clone(blocks);
  if (out[bi].items.length >= MAX_PER_BLOCK) return blocks;
  out[bi].items.push(item(e, rounds(out[bi]), ctx));
  return normalize(out, ctx.ex);
}

export function addBlock(blocks: PlannedBlock[], e: Exercise, ctx: EditCtx) {
  if (blocks.length >= MAX_BLOCKS) return blocks;
  return normalize([...clone(blocks), { key: 'A', title: '', kind: 'superserie', restSec: ctx.restSec, items: [item(e, ctx.deload ? 2 : 3, ctx)] }], ctx.ex);
}

export function removeExercise(blocks: PlannedBlock[], bi: number, ii: number, ex: ExMap) {
  const out = clone(blocks);
  out[bi].items.splice(ii, 1);
  return normalize(out, ex);
}

export function setRounds(blocks: PlannedBlock[], bi: number, n: number, ex: ExMap) {
  const out = clone(blocks);
  const r = Math.max(1, Math.min(MAX_ROUNDS, n));
  out[bi].items = out[bi].items.map((it) => (ex[it.exerciseId]?.discipline === 'Cardio' ? it : { ...it, sets: r }));
  return normalize(out, ex);
}

export function moveBlock(blocks: PlannedBlock[], bi: number, dir: -1 | 1, ex: ExMap) {
  const j = bi + dir;
  if (j < 0 || j >= blocks.length) return blocks;
  const out = clone(blocks);
  [out[bi], out[j]] = [out[j], out[bi]];
  return normalize(out, ex);
}

/** Takes an exercise out of its superset into its own block, right after. */
export function splitOut(blocks: PlannedBlock[], bi: number, ii: number, ex: ExMap) {
  if (blocks[bi].items.length < 2 || blocks.length >= MAX_BLOCKS) return blocks;
  const out = clone(blocks);
  const [it] = out[bi].items.splice(ii, 1);
  out.splice(bi + 1, 0, { ...out[bi], items: [it] });
  return normalize(out, ex);
}

/** Joins a block with the next one into a single superset (when it fits). */
export function mergeWithNext(blocks: PlannedBlock[], bi: number, ex: ExMap) {
  const next = blocks[bi + 1];
  if (!next || blocks[bi].items.length + next.items.length > MAX_PER_BLOCK) return blocks;
  const out = clone(blocks);
  const r = rounds(out[bi]);
  out[bi].items.push(...out[bi + 1].items.map((i) => ({ ...i, sets: r })));
  out.splice(bi + 1, 1);
  return normalize(out, ex);
}

export function toRoutine(name: string, blocks: PlannedBlock[], id: string, createdAt: string): Routine {
  return { id, name: name.trim() || 'Mi rutina', createdAt, blocks: blocks.map((b) => ({ exerciseIds: b.items.map((i) => i.exerciseId), rounds: rounds(b) })) };
}

/** Builds today's blocks from a routine, prescribing loads from history; unknown or archived exercises are skipped. */
export function fromRoutine(r: Routine, ctx: EditCtx): PlannedBlock[] {
  const blocks = r.blocks.map((b) => ({
    key: 'A' as BlockKey,
    title: '',
    kind: 'superserie' as const,
    restSec: ctx.restSec,
    items: b.exerciseIds.map((id) => ctx.ex[id]).filter((e): e is Exercise => !!e && !e.archived).map((e) => item(e, ctx.deload ? Math.max(1, b.rounds - 1) : b.rounds, ctx)),
  }));
  return normalize(blocks, ctx.ex);
}

/** Short muscle summary of a routine, e.g. "Pecho · Dorsal · Tríceps". */
export function routineMuscles(r: Routine, ex: ExMap) {
  const ms = [...new Set(r.blocks.flatMap((b) => b.exerciseIds.map((id) => ex[id]?.primary[0]).filter((m): m is MuscleKey => !!m)))];
  return ms.map((m) => MUSCLE_INFO[m].name).slice(0, 5).join(' · ');
}

export interface AiRoutineResponse { name: string; rationale: string; blocks: { exerciseIds: string[]; rounds: number; why?: string }[] }

/**
 * Turns an AI-built routine into today's blocks: unknown/archived/repeated exercises are dropped,
 * blocks are capped (6 blocks, 3 exercises, 1–6 rounds) and rounds are trimmed from the end until
 * the session fits the available minutes.
 */
export function blocksFromAi(res: AiRoutineResponse, ctx: EditCtx, minutes: number): PlannedBlock[] {
  const seen = new Set<string>();
  const routine: Routine = {
    id: 'ai',
    name: res.name,
    createdAt: '',
    blocks: (res.blocks ?? [])
      .map((b) => ({
        exerciseIds: (b.exerciseIds ?? []).filter((id) => ctx.ex[id] && !ctx.ex[id].archived && !seen.has(id) && (seen.add(id), true)).slice(0, MAX_PER_BLOCK),
        rounds: Math.max(1, Math.min(MAX_ROUNDS, Math.round(Number(b.rounds) || 3))),
      }))
      .filter((b) => b.exerciseIds.length)
      .slice(0, MAX_BLOCKS),
  };
  let blocks = fromRoutine(routine, { ...ctx, deload: false });
  if (ctx.deload) blocks = blocks.map((b) => ({ ...b, items: b.items.map((i) => ({ ...i, ...suggestNext(ctx.ex[i.exerciseId], lastPerformance(ctx.history, i.exerciseId), true) })) }));
  for (let guard = 0; guard < 40 && blocks.length && estimateMinutes(blocks, ctx.ex) > minutes; guard++) {
    const bi = blocks.length - 1 - [...blocks].reverse().findIndex((b) => rounds(b) > 2);
    if (bi >= blocks.length) blocks = blocks.slice(0, -1);
    else blocks = setRounds(blocks, bi, rounds(blocks[bi]) - 1, ctx.ex);
  }
  return blocks;
}

export interface MuscleWork { sets: number; primary: boolean; exercises: string[] }

/**
 * Muscles a session works: hard sets per muscle (primary 1, secondary 0.5, as in the weekly
 * volume) and which exercises hit them; `primary` when any exercise targets it directly.
 */
export function musclesWorked(blocks: PlannedBlock[], ex: ExMap): Partial<Record<MuscleKey, MuscleWork>> {
  const out: Partial<Record<MuscleKey, MuscleWork>> = {};
  const add = (m: MuscleKey, sets: number, primary: boolean, name: string) => {
    const w = (out[m] ??= { sets: 0, primary: false, exercises: [] });
    w.sets += sets;
    w.primary ||= primary;
    if (!w.exercises.includes(name)) w.exercises.push(name);
  };
  for (const b of blocks) {
    for (const it of b.items) {
      const e = ex[it.exerciseId];
      if (!e) continue;
      for (const m of e.primary) add(m, it.sets, true, e.name);
      for (const m of e.secondary) add(m, it.sets * 0.5, false, e.name);
    }
  }
  return out;
}
