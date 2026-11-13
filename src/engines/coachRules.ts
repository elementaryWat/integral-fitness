import { addDays, daysBetween, inRange, startOfWeek } from '../domain/dates';
import { MUSCLE_INFO, MUSCLE_KEYS, type MuscleKey } from '../domain/muscles';
import type { BodyComp, CoachState, FoodEntry, ISODate, Perimeters, Profile, Proposal, Session, Signal, WeighIn } from '../domain/types';
import { fmt } from '../data';
import { weightSlope } from './energy';
import { isLoaded, weeklyBestE1rm } from './progression';
import { hardSetsByMuscle, type ExMap, type MuscleState } from './volume';

export const TARGET_LOSS_KG_WK = -0.25;

export interface ReviewInput {
  today: ISODate;
  profile: Profile;
  weightKg: number;
  states: Record<MuscleKey, MuscleState>;
  sessions: Session[];
  ex: ExMap;
  weighIns: WeighIn[];
  bodyComps: BodyComp[];
  perimeters: Perimeters[];
  foods: FoodEntry[];
  coach: CoachState;
}

export interface WeeklyReview {
  weekOf: ISODate;
  weekNumber: number;
  headline: string;
  summary: string;
  signals: Signal[];
  proposals: Proposal[];
  hasData: boolean;
}

const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 1)}%`;

/** Average hrr60 for sets whose exercise trains `m` as primary, within [from, to]. */
function hrrFor(m: MuscleKey, s: Session[], ex: ExMap, from: ISODate, to: ISODate) {
  const vals = s.filter((x) => inRange(x.date, from, to)).flatMap((x) => x.sets)
    .filter((l) => l.hrr60 !== undefined && ex[l.exerciseId]?.primary.includes(m)).map((l) => l.hrr60 as number);
  return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function velocityLossFor(m: MuscleKey, s: Session[], ex: ExMap, from: ISODate, to: ISODate) {
  const vals = s.filter((x) => inRange(x.date, from, to)).flatMap((x) => x.sets)
    .filter((l) => l.velocityLoss !== undefined && ex[l.exerciseId]?.primary.includes(m)).map((l) => l.velocityLoss as number);
  return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Sum of best weekly e1RM across loaded exercises trained in both weeks, as a % change. */
export function strengthChange(sessions: Session[], ex: ExMap, bw: number, day: ISODate): number | null {
  let now = 0, prev = 0;
  for (const e of Object.values(ex)) {
    if (!isLoaded(e)) continue;
    const a = weeklyBestE1rm(sessions, e, bw, day);
    const b = weeklyBestE1rm(sessions, e, bw, addDays(day, -7));
    if (a && b) { now += a; prev += b; }
  }
  return prev ? ((now - prev) / prev) * 100 : null;
}

/**
 * Rule-based weekly review crossing training, recovery, nutrition and body data.
 * Produces signals (what's happening) and concrete proposals for next week.
 */
export function weeklyReview(i: ReviewInput): WeeklyReview {
  const { today, sessions, ex, states } = i;
  const from = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const prevTo = addDays(today, -7);
  const weekOf = startOfWeek(today);
  const weekNumber = Math.max(1, Math.floor(daysBetween(i.profile.createdAt, today) / 7) + 1);
  const weekSessions = sessions.filter((s) => inRange(s.date, from, today) && s.sets.length);
  const signals: Signal[] = [];
  const proposals: Proposal[] = [];

  // --- fatigue: volume above MAV, HRR-60 dropping, velocity loss, RPE drift ---
  const prevSets = hardSetsByMuscle(sessions, ex, prevFrom, prevTo);
  const fatigued: MuscleKey[] = [];
  for (const m of MUSCLE_KEYS) {
    const st = states[m];
    const reasons: string[] = [];
    if (st.sets > MUSCLE_INFO[m].mav) reasons.push(`${fmt(st.sets, st.sets % 1 ? 1 : 0)} series/sem (máx. ${MUSCLE_INFO[m].mav})`);
    const hNow = hrrFor(m, sessions, ex, from, today);
    const hPrev = hrrFor(m, sessions, ex, prevFrom, prevTo);
    if (hNow !== null && hPrev !== null && hPrev - hNow >= 6) reasons.push(`HRR-60 −${fmt(hPrev - hNow)} lpm`);
    const vl = velocityLossFor(m, sessions, ex, from, today);
    if (vl !== null && vl >= 0.2) reasons.push(`pérdida de velocidad del ${fmt(vl * 100)}%`);
    if (reasons.length && (st.sets >= MUSCLE_INFO[m].mev || reasons.length > 1)) {
      fatigued.push(m);
      const growth = prevSets[m] ? ((st.sets - prevSets[m]) / prevSets[m]) * 100 : null;
      signals.push({
        id: `fatiga-${m}`,
        tone: 'fatiga',
        title: `Fatiga acumulada · ${MUSCLE_INFO[m].name.toLowerCase()}`,
        detail: reasons.join(', ') + (growth !== null && growth > 0 ? ` (${pctFmt(growth)} vs sem. ant.)` : '') + '.',
      });
      const cut = Math.max(2, Math.min(4, Math.ceil(st.sets - st.target)));
      proposals.push({
        id: `vol-${m}`,
        title: `${MUSCLE_INFO[m].name}: −${cut} series la próxima semana`,
        detail: 'El generador elegirá menos ejercicios que lo carguen como principal.',
        action: { type: 'volume', muscle: m, delta: -cut },
      });
    }
  }

  // --- lagging groups (only meaningful once the week has training) ---
  if (weekSessions.length) {
    const lagging = MUSCLE_KEYS.filter((m) => states[m].sets < MUSCLE_INFO[m].mev && !fatigued.includes(m))
      .sort((a, b) => (states[b].target - states[b].sets) - (states[a].target - states[a].sets));
    if (lagging.length) {
      signals.push({
        id: 'rezagados',
        tone: 'rezagado',
        title: `${lagging.slice(0, 2).map((m) => MUSCLE_INFO[m].name).join(' y ')} rezagado${lagging.length > 1 ? 's' : ''}`,
        detail: lagging.slice(0, 3).map((m) => `${MUSCLE_INFO[m].name} ${fmt(states[m].sets, states[m].sets % 1 ? 1 : 0)}/${MUSCLE_INFO[m].mev}`).join(' · ') + ' series/sem, por debajo del mínimo efectivo.',
      });
      for (const m of lagging.slice(0, 2)) {
        const add = Math.max(2, Math.min(3, Math.ceil(MUSCLE_INFO[m].mev - states[m].sets)));
        proposals.push({
          id: `vol-${m}`,
          title: `${MUSCLE_INFO[m].name}: +${add} series`,
          detail: 'Se priorizará en las superseries de la próxima semana.',
          action: { type: 'volume', muscle: m, delta: add },
        });
      }
    }
  }

  // --- nutrition & body: catabolism risk and rate of loss ---
  const foodDays = new Map<ISODate, number>();
  for (const f of i.foods) if (inRange(f.date, from, today)) foodDays.set(f.date, (foodDays.get(f.date) ?? 0) + f.p);
  const proteinGkg = foodDays.size ? [...foodDays.values()].reduce((a, b) => a + b, 0) / foodDays.size / i.weightKg : null;
  const rate = weightSlope(i.weighIns, addDays(today, -13), today);
  const comps = i.bodyComps.filter((b) => b.smmKg !== undefined).sort((a, b) => (a.date < b.date ? -1 : 1));
  const smmNow = comps.at(-1);
  const smmRef = comps.filter((b) => smmNow && daysBetween(b.date, smmNow.date) >= 21).at(-1);
  const smmDelta = smmNow && smmRef ? (smmNow.smmKg as number) - (smmRef.smmKg as number) : null;

  const risks: string[] = [];
  if (proteinGkg !== null && proteinGkg < 1.6) risks.push(`proteína media ${fmt(proteinGkg, 1)} g/kg (< 1,6)`);
  if (rate !== null && rate < -(i.weightKg * 0.01)) risks.push(`pérdida de ${fmt(rate, 2)} kg/sem (> 1 % del peso)`);
  if (smmDelta !== null && smmDelta <= -0.3) risks.push(`masa muscular ${fmt(smmDelta, 1)} kg en 4 sem`);
  if (risks.length) {
    signals.push({ id: 'catabolismo', tone: 'fatiga', title: 'Riesgo de catabolismo: alto', detail: risks.join(', ') + '.' });
  } else if (proteinGkg !== null || smmDelta !== null) {
    const parts = [
      proteinGkg !== null ? `Proteína media ${fmt(proteinGkg, 1)} g/kg` : null,
      smmDelta !== null ? `masa muscular ${smmDelta >= 0 ? '+' : ''}${fmt(smmDelta, 1)} kg` : null,
    ].filter(Boolean);
    signals.push({ id: 'catabolismo', tone: 'ok', title: 'Riesgo de catabolismo: bajo', detail: parts.join(', ') + '.' });
  }

  const targetRate = i.profile.targetRateKgWk ?? TARGET_LOSS_KG_WK;
  if (rate !== null) {
    if (rate < targetRate - 0.12) {
      proposals.push({
        id: 'kcal-descanso',
        title: '+150 kcal en días de descanso',
        detail: `Todo en carbohidratos. Acerca el ritmo (${fmt(rate, 2)} kg/sem) a tu objetivo de ${fmt(targetRate, 2)}.`,
        action: { type: 'kcal', delta: 150, dayType: 'Descanso' },
      });
    } else if (rate > targetRate + 0.2) {
      proposals.push({
        id: 'kcal-menos',
        title: '−100 kcal diarias',
        detail: `${targetRate < 0 ? 'El peso medio no baja' : 'El peso sube más rápido de lo previsto'} (${rate >= 0 ? '+' : ''}${fmt(rate, 2)} kg/sem). Recorte desde grasas.`,
        action: { type: 'kcal', delta: -100 },
      });
    }
  }

  // --- deload ---
  const mesoWeeks = Math.floor(daysBetween(i.coach.mesoStart, today) / 7) + 1;
  const strength = strengthChange(sessions, ex, i.weightKg, today);
  const nextWeek = addDays(weekOf, 7);
  if (mesoWeeks >= 4 && ((strength !== null && strength <= 0) || fatigued.length >= 2)) {
    proposals.push({
      id: 'descarga',
      title: 'Semana de descarga la próxima semana',
      detail: `${mesoWeeks} semanas de acumulación${strength !== null && strength <= 0 ? ' y fuerza estancada' : ' y fatiga en varios grupos'}. Volumen −40 %, cargas al 90 %.`,
      action: { type: 'deload', weekOf: nextWeek },
    });
  }

  // --- headline & summary ---
  const waist = i.perimeters.filter((p) => p.waist !== undefined).sort((a, b) => (a.date < b.date ? -1 : 1));
  const waistDelta = waist.length >= 2 ? (waist.at(-1)!.waist as number) - (waist.filter((p) => daysBetween(p.date, waist.at(-1)!.date) >= 6).at(-1)?.waist ?? waist[0].waist as number) : null;
  const hasData = weekSessions.length > 0 || i.weighIns.some((w) => inRange(w.date, from, today));
  const onTrack = (strength ?? 0) >= 0 && (rate === null || Math.abs(rate - targetRate) <= 0.25);
  const ON_TRACK = { recomp: 'Recomposición en marcha.', definir: 'Definición en marcha.', volumen: 'Ganancia muscular en marcha.', mantener: 'Mantenimiento estable.' } as const;
  const headline = !hasData
    ? 'Registra una semana para tu primera revisión.'
    : `${onTrack ? ON_TRACK[i.profile.goal ?? 'recomp'] : 'Semana de ajuste.'} ${fatigued.length ? `${MUSCLE_INFO[fatigued[0]].name} acumula fatiga.` : signals.some((s) => s.tone === 'rezagado') ? 'Hay grupos rezagados.' : 'Volumen en rango.'}`;
  const summary = [
    strength !== null ? `Fuerza relativa ${pctFmt(strength)}` : null,
    waistDelta !== null ? `cintura ${waistDelta >= 0 ? '+' : ''}${fmt(waistDelta, 1)} cm` : null,
    rate !== null ? `peso medio ${fmt(rate, 2)} kg/sem (objetivo ${fmt(targetRate, 2)})` : null,
    `${weekSessions.length} sesiones esta semana`,
  ].filter(Boolean).join(', ') + '.';

  return { weekOf, weekNumber, headline, summary: summary.charAt(0).toUpperCase() + summary.slice(1), signals, proposals, hasData };
}
