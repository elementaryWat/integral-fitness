import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TrendChart, type TrendKey } from '../components/charts';
import { Engine8020Card } from '../components/Balance';
import { PhysiqueCard } from '../components/PhysiqueCard';
import { Screen } from '../components/Screen';
import { fmtSigned } from '../data';
import { addDays, shortDay } from '../domain/dates';
import { muscleName, type MuscleKey } from '../domain/muscles';
import { AiRequestError, coachReview } from '../ai/api';
import type { WeeklyReview } from '../engines/coachRules';
import { weeklyReview } from '../engines/coachRules';
import type { TrendSeries } from '../engines/trends';
import { weeklyTrends } from '../engines/trends';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Empty, Eyebrow, GhostButton, PrimaryButton, ScreenHeader, T } from '../ui';

const SERIES: [TrendKey, string, string][] = [
  ['f', 'FUERZA REL.', C.lime],
  ['m', 'MÚSCULO', C.cyan],
  ['g', 'GRASA', C.coral],
  ['b', 'BALANCE', C.amber],
];
const TONE = { fatiga: C.coral, rezagado: C.cyan, ok: C.lime } as const;

function reviewBody(review: WeeklyReview) {
  return {
    weekOf: review.weekOf,
    weekNumber: review.weekNumber,
    headline: review.headline,
    summary: review.summary,
    signals: review.signals,
    proposals: review.proposals,
  };
}

function trendStats(trends: TrendSeries, goal: string | undefined, targetRateKgWk: number | undefined, weightKg: number, fatPct: number | undefined) {
  const n = 8;
  return {
    weeks: trends.weeks.slice(-n),
    fuerza: trends.f.slice(-n),
    musculo: trends.m.slice(-n),
    grasa: trends.g.slice(-n),
    balanceKcal: trends.b.slice(-n),
    goal: goal ?? null,
    targetRateKgWk: targetRateKgWk ?? null,
    weightKg,
    fatPct: fatPct ?? null,
  };
}

export function CoachScreen() {
  const s = useStore();
  const d = useDerived();
  const nav = useNav();
  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({ f: true, m: true, g: true, b: true });
  const [rejected, setRejected] = useState<string[]>([]);
  const [busy, setBusy] = useState<'review' | 'photos' | null>(null);

  const review = useMemo(
    () => weeklyReview({ today: d.today, profile: d.profile, weightKg: d.weight, states: d.states, sessions: d.all, ex: d.ex, weighIns: s.weighIns, bodyComps: s.bodyComps, perimeters: s.perimeters, foods: s.foods, coach: s.coach }),
    [d, s.weighIns, s.bodyComps, s.perimeters, s.foods, s.coach],
  );
  const trends = useMemo(
    () => weeklyTrends({ today: d.today, weeks: 12, sessions: d.all, ex: d.ex, weighIns: s.weighIns, bodyComps: s.bodyComps, foods: s.foods, tdeeOn: (x) => d.energyOn(x).tdee }),
    [d, s.weighIns, s.bodyComps, s.foods],
  );
  // Trim leading empty weeks so new users don't see 12 blank columns.
  const firstData = trends.weeks.findIndex((_, i) => [trends.f, trends.m, trends.g, trends.b].some((x) => x[i] !== null));
  const shown = firstData < 0 ? null : {
    weeks: trends.weeks.slice(firstData), f: trends.f.slice(firstData), m: trends.m.slice(firstData), g: trends.g.slice(firstData), b: trends.b.slice(firstData),
  };

  const applied = s.coach.appliedWeekOf === review.weekOf;
  const accepted = review.proposals.filter((p) => !rejected.includes(p.id));

  const activeAdjustments = [
    s.coach.kcalOffset ? `${fmtSigned(s.coach.kcalOffset)} kcal/día` : null,
    s.coach.restDayKcal ? `${fmtSigned(s.coach.restDayKcal)} kcal en descanso` : null,
    ...Object.entries(s.coach.volumeDelta).filter(([, v]) => v).map(([k, v]) => `${muscleName(k as MuscleKey)} ${fmtSigned(v as number)} series`),
    s.coach.deloadWeekOf ? `descarga ${shortDay(s.coach.deloadWeekOf)}` : null,
  ].filter((x): x is string => !!x);

  const ai = s.coach.aiReview?.[review.weekOf];
  // What the AI review is based on: when any of these change, offer to regenerate it.
  const from = addDays(d.today, -6);
  const basis = [
    d.weight.toFixed(1),
    d.fatPct?.toFixed(1) ?? '-',
    s.sessions.filter((x) => x.date >= from).length,
    s.foods.filter((f) => f.date >= from).length,
    s.weighIns.filter((w) => w.date >= from).length,
  ].join('|');
  const outdated = !!ai && ai.basis !== basis;
  const ago = ai ? Math.max(0, Math.round((Date.now() - ai.at) / 60000)) : 0;
  const agoText = ago < 60 ? `HACE ${ago} MIN` : ago < 60 * 24 ? `HACE ${Math.round(ago / 60)} H` : `HACE ${Math.round(ago / 1440)} D`;

  const reset = () =>
    Alert.alert('Borrar todos los datos', 'Se eliminan perfil, sesiones, medidas, comidas y ajustes. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: s.reset },
    ]);

  const sendReview = async (photos?: [string, string]) => {
    setBusy(photos ? 'photos' : 'review');
    try {
      const res = await coachReview(
        s.settings.watch,
        reviewBody(review),
        trendStats(trends, d.profile.goal, d.profile.targetRateKgWk, d.weight, d.fatPct),
        photos,
      );
      // A plain regenerate keeps the last photo note (photos are only sent on request).
      s.setAiReview(review.weekOf, { ...res, photoNote: res.photoNote ?? (photos ? null : ai?.photoNote ?? null), at: Date.now(), basis });
    } catch (e) {
      Alert.alert('IA', e instanceof AiRequestError ? e.message : 'No se pudo completar la revisión.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="COACH · REVISIÓN SEMANAL" title={`Semana ${review.weekNumber}`} sub={`${shortDay(addDays(d.today, -6))} – ${shortDay(d.today)} · RELOJ, ENTRENOS, NUTRICIÓN, MEDIDAS Y FOTOS`} />

      <Card>
        <Eyebrow>TENDENCIA UNIFICADA · {shown ? shown.weeks.length : 0} SEMANAS</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {SERIES.map(([k, label, color]) => {
            const on = visible[k];
            return (
              <Pressable key={k} onPress={() => setVisible({ ...visible, [k]: !on })} accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: on ? color : C.border }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? color : C.border }} />
                <T style={[mono(10), { color: on ? C.text : C.dim }]}>{label}</T>
              </Pressable>
            );
          })}
        </View>
        {shown ? <TrendChart series={shown} visible={visible} /> : <Empty text="Las tendencias aparecen tras tu primera semana de registros." />}
        <T style={[mono(10, 500, 1.4), { color: C.dim }]}>LÍNEAS NORMALIZADAS POR SERIE · BARRAS: BALANCE MEDIO KCAL/DÍA</T>
      </Card>

      <View style={{ backgroundColor: C.text, borderRadius: 20, padding: 18, gap: 10 }}>
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.bg }]}>{ai ? 'RESUMEN · IA' : 'RESUMEN'}</T>
        <T style={[cond(26, 800, 1.1), { color: C.bg, textTransform: 'uppercase' }]}>{ai ? ai.headline : review.headline}</T>
        <T style={[body(14, 500, 1.45), { color: C.bg }]}>{ai ? ai.summary : review.summary}</T>
      </View>

      {ai && (ai.wins.length > 0 || ai.watch.length > 0) ? (
        <Card>
          {ai.wins.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Eyebrow color={C.lime}>LO QUE VA BIEN</Eyebrow>
              {ai.wins.map((line, i) => <T key={`win-${i}`} style={[body(14, 500, 1.4)]}>{line}</T>)}
            </View>
          ) : null}
          {ai.watch.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Eyebrow color={C.amber}>A VIGILAR</Eyebrow>
              {ai.watch.map((line, i) => <T key={`watch-${i}`} style={[body(14, 500, 1.4)]}>{line}</T>)}
            </View>
          ) : null}
        </Card>
      ) : null}
      {!ai ? <PrimaryButton label={busy === 'review' ? 'Revisando…' : 'Revisión con IA'} onPress={() => { sendReview(); }} disabled={busy !== null} /> : (
        <View style={{ gap: 6 }}>
          <T style={[mono(10, 500, 1.4), { color: outdated ? C.amber : C.dim, paddingHorizontal: 2 }]}>
            {outdated ? `GENERADO ${agoText} · TUS DATOS CAMBIARON DESDE ENTONCES` : `GENERADO ${agoText} CON TUS DATOS ACTUALES`}
          </T>
          {outdated ? (
            <PrimaryButton label={busy === 'review' ? 'Regenerando…' : '↻ Regenerar con datos actuales'} onPress={() => { sendReview(); }} disabled={busy !== null} height={44} />
          ) : (
            <GhostButton label={busy === 'review' ? 'REGENERANDO…' : '↻ REGENERAR RESUMEN'} onPress={() => { if (!busy) sendReview(); }} height={40} />
          )}
        </View>
      )}

      <Card gap={0}>
        <Eyebrow style={{ paddingBottom: 4 }}>SEÑALES DETECTADAS</Eyebrow>
        {review.signals.length === 0 && <Empty text="Sin señales esta semana. Registra series con RPE, pesajes y comidas para que el coach pueda cruzarlos." />}
        {review.signals.map((sig, i) => {
          const lastRow = i === review.signals.length - 1;
          return (
            <View key={sig.id} style={{ flexDirection: 'row', gap: 12, paddingTop: 12, paddingBottom: lastRow ? 0 : 12, borderBottomWidth: lastRow ? 0 : 1, borderBottomColor: C.line }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: TONE[sig.tone] }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T style={[cond(18), { textTransform: 'uppercase' }]}>{sig.title}</T>
                <T style={[body(13, 400, 1.4), { color: C.soft }]}>{sig.detail}</T>
              </View>
            </View>
          );
        })}
      </Card>

      <PhysiqueCard review={review} />

      <Card gap={8}>
        <Eyebrow style={{ paddingBottom: 4 }}>AJUSTES PROPUESTOS · PRÓXIMA SEMANA</Eyebrow>
        {review.proposals.length === 0 && <Empty text="Nada que ajustar: sigue el plan." />}
        {review.proposals.map((p) => {
          const on = !rejected.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => setRejected((r) => (on ? [...r, p.id] : r.filter((x) => x !== p.id)))}
              disabled={applied}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.chip, borderRadius: 14, padding: 12, opacity: applied ? 0.6 : 1 }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: on ? C.lime : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: '#4c504a', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <T style={[body(14, 700), { color: C.bg }]}>✓</T> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T style={body(14, 600, 1.25)}>{p.title}</T>
                <T style={[body(12, 400, 1.35), { color: C.muted }]}>{p.detail}</T>
              </View>
            </Pressable>
          );
        })}
        {review.proposals.length > 0 && (
          <Pressable
            onPress={() => !applied && accepted.length && s.applyProposals(accepted, review.weekOf)}
            disabled={applied || accepted.length === 0}
            style={{ marginTop: 6, height: 50, borderRadius: 25, backgroundColor: applied ? C.chip : C.lime, alignItems: 'center', justifyContent: 'center', opacity: !applied && accepted.length === 0 ? 0.5 : 1 }}
          >
            <T style={[cond(18), { color: applied ? C.lime : C.bg, textTransform: 'uppercase' }]}>
              {applied ? 'Aplicado · generador actualizado' : `Aplicar ${accepted.length} ajuste${accepted.length === 1 ? '' : 's'}`}
            </T>
          </Pressable>
        )}
        {activeAdjustments.length > 0 && (
          <T style={[mono(10, 500, 1.4), { color: C.dim, paddingTop: 4 }]}>ACTIVOS: {activeAdjustments.join(' · ').toUpperCase()}</T>
        )}
      </Card>

      <Engine8020Card />
      <GhostButton label="EDITAR PERFIL Y OBJETIVO" onPress={() => nav.navigate('ProfileEdit')} />
      <GhostButton label="BORRAR TODOS LOS DATOS" onPress={reset} color={C.coral} />
    </Screen>
  );
}
