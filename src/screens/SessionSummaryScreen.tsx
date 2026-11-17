import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BodyMap } from '../components/charts';
import { Screen } from '../components/Screen';
import { fmt, loadText, mmss, unitSuffix } from '../data';
import { shortDay } from '../domain/dates';
import { muscleName, type MuscleKey } from '../domain/muscles';
import { blockTimes, FEEL_LABEL, FEEL_TAGS, restStats, sessionExercises, sessionSummary } from '../engines/liveSession';
import type { Exercise, Session, SessionFeel, SetLog } from '../domain/types';
import { weekStreak } from '../engines/streak';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, WORK_NONE, WORK_PRIMARY, WORK_SECONDARY, body, cond, em, mono } from '../theme';
import { Card, PrimaryButton, Row, SheetHeader, StatTile, T } from '../ui';

/** "80 × 8", "+20 × 6", "Tuck · 10", "12 reps", "40 s". */
function setText(e: Exercise, l: SetLog) {
  const amount = e.unit === 'reps' ? String(l.reps) : `${l.reps}${unitSuffix(e.unit)}`;
  if (e.loadMode === 'peso' || e.loadMode === 'lastre') return `${loadText(e, l.load)} × ${amount}`;
  if (e.loadMode === 'palanca') return `${loadText(e, l.load)} · ${amount}`;
  return e.unit === 'reps' ? `${amount} reps` : amount;
}

const FEEL_COLOR = { 1: C.coral, 2: C.amber, 3: C.soft, 4: C.lime, 5: C.lime } as const;

/** "How do you feel?" right after the session: 1–5 plus optional tags, saved with the session. */
function FeelCard({ s }: { s: Session }) {
  const rate = useStore((st) => st.rateSession);
  const feel = s.feel;
  const set = (patch: Partial<SessionFeel>) => rate(s.id, { score: feel?.score ?? 3, tags: feel?.tags, ...patch, at: Date.now() });
  const toggle = (t: string) => {
    const tags = feel?.tags ?? [];
    set({ tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });
  };
  return (
    <Card gap={10} style={!feel ? { borderWidth: 1, borderColor: C.border } : undefined}>
      <Row>
        <Label>¿CÓMO TE SIENTES?</Label>
        {feel ? <T style={[mono(10), { color: FEEL_COLOR[feel.score] }]}>{FEEL_LABEL[feel.score].toUpperCase()}</T> : <T style={[mono(10, 500), { color: C.dim }]}>TOCA UNA</T>}
      </Row>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {([1, 2, 3, 4, 5] as const).map((v) => {
          const on = feel?.score === v;
          return (
            <Pressable key={v} onPress={() => set({ score: v })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={FEEL_LABEL[v]} style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: on ? FEEL_COLOR[v] : C.chip, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <T style={[cond(22, 900), { color: on ? C.bg : C.text }]}>{v}</T>
              <T style={[mono(8, 500), { color: on ? C.bg : C.muted }]} lines={1}>{FEEL_LABEL[v].toUpperCase()}</T>
            </Pressable>
          );
        })}
      </View>
      {feel ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FEEL_TAGS.map((t) => {
            const on = feel.tags?.includes(t);
            return (
              <Pressable key={t} onPress={() => toggle(t)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: on ? C.lime : C.border, backgroundColor: on ? '#12160a' : 'transparent' }}>
                <T style={[mono(10), { color: on ? C.lime : C.soft }]}>{t.toUpperCase()}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const Label = ({ children }: { children: string }) => <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted }]}>{children}</T>;

/** What a saved session achieved: time, volume, pulse, records, muscles and the week's streak. */
export function SessionSummaryScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'SessionSummary'>) {
  const { id, celebrate } = route.params;
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const { ex, weight, today } = useDerived();
  const [sel, setSel] = useState<MuscleKey | undefined>();
  const s = sessions.find((x) => x.id === id);
  const sum = useMemo(() => (s ? sessionSummary(s, sessions, ex, weight) : undefined), [s, sessions, ex, weight]);
  const done = useMemo(() => (s ? sessionExercises(s, ex, weight) : []), [s, ex, weight]);
  const restTarget = useStore((st) => st.settings.restSec);
  const rests = useMemo(() => (s ? restStats(s, restTarget) : undefined), [s, restTarget]);
  const blocks = useMemo(() => (s ? blockTimes(s) : []), [s]);
  const streak = profile ? weekStreak({ sessions, trainingDays: profile.trainingDays, today, startDate: profile.createdAt }) : undefined;
  const close = () => navigation.goBack();

  if (!s || !sum) {
    return (
      <Screen sheet>
        <SheetHeader eyebrow="SESIÓN" title="No encontrada" onClose={close} />
      </Screen>
    );
  }
  const m = sum.metrics;
  const color = (k: MuscleKey) => (sum.muscles[k]?.primary ? WORK_PRIMARY : sum.muscles[k] ? WORK_SECONDARY : WORK_NONE);
  const ranked = (Object.entries(sum.muscles) as [MuscleKey, { sets: number; primary: boolean }][]).sort((a, b) => b[1].sets - a[1].sets);
  const picked = sel ? sum.muscles[sel] : undefined;

  return (
    <Screen sheet>
      <SheetHeader eyebrow={`RESUMEN · ${shortDay(s.date).toUpperCase()}${s.deload ? ' · DESCARGA' : ''}`} title={celebrate ? '¡Semana cumplida!' : 'Sesión guardada'} onClose={close} closeLabel="LISTO" />

      <Card gap={6} style={{ borderWidth: 1, borderColor: C.lime }}>
        <Label>DURACIÓN</Label>
        <Row style={{ alignItems: 'flex-end' }}>
          <T style={cond(56, 900)}>{mmss(m.totalSec)}</T>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <T style={[cond(24), { color: C.lime }]}>{sum.sets} SERIES</T>
            <T style={[mono(10, 500), { color: C.muted }]}>{sum.exercises} EJERCICIOS{sum.skipped ? ` · ${sum.skipped} OMITIDAS` : ''}</T>
          </View>
        </Row>
        <T style={[mono(11, 500), { color: C.soft }]}>ACTIVO {mmss(m.activeSec)} · DESCANSO {mmss(m.restSec)}{m.activeSec > 0 ? ` · 1:${fmt(m.restRatio, 1)}` : ''}</T>
      </Card>

      <FeelCard s={s} />

      {rests && (rests.full.count || rests.transition.count) ? (
        <Card gap={10}>
          <Label>DESCANSOS REALES Y TIEMPOS</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[mono(9, 500), { color: C.muted }]}>DESCANSO MEDIO</T>
              <T style={[cond(26), { color: rests.full.avg > rests.target + 30 ? C.amber : C.text }]}>{rests.full.count ? mmss(rests.full.avg) : '—'}</T>
              <T style={[mono(9, 500), { color: C.dim }]}>OBJETIVO {mmss(rests.target)}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[mono(9, 500), { color: C.muted }]}>MÁS LARGO</T>
              <T style={cond(26)}>{rests.full.count ? mmss(rests.full.max) : '—'}</T>
              <T style={[mono(9, 500), { color: rests.full.overTarget ? C.amber : C.dim }]}>{rests.full.overTarget} +30 S DE MÁS</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={[mono(9, 500), { color: C.muted }]}>TRANSICIÓN</T>
              <T style={cond(26)}>{rests.transition.count ? mmss(rests.transition.avg) : '—'}</T>
              <T style={[mono(9, 500), { color: C.dim }]}>ENTRE SUPERSERIE</T>
            </View>
          </View>
          {blocks.map((b) => {
            const pb = s.blocks.find((x) => x.key === b.block);
            return (
              <Row key={b.block} style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
                    <T style={[cond(15, 900), { color: C.bg }]}>{b.block}</T>
                  </View>
                  <T style={[body(13, 600), { flexShrink: 1 }]} lines={1}>{pb?.title ?? 'Bloque'}</T>
                </View>
                <T style={[mono(11, 500), { color: C.soft }]}>{mmss(b.durationSec)} · {b.rounds} {b.rounds === 1 ? 'RONDA' : 'RONDAS'} · {mmss(b.durationSec / Math.max(1, b.rounds))}/RONDA</T>
              </Row>
            );
          })}
          <T style={[mono(9, 500, 1.4), { color: C.dim }]}>DESCANSO REAL = FIN DE UNA SERIE → INICIO DE LA SIGUIENTE (INCLUYE ESPERAR LA BARRA).</T>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="TONELAJE" value={m.tonnage ? fmt(m.tonnage) : '—'} sub="kg efectivos" />
        <StatTile label="DENSIDAD" value={m.tonnage && m.totalSec ? fmt(m.density, 1) : '—'} sub="kg/min" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="PULSO PICO" value={sum.hrMax ? String(sum.hrMax) : '—'} sub={sum.hrAvgPeak ? `medio ${sum.hrAvgPeak} lpm` : 'sin datos del reloj'} />
        <StatTile label="HRR-60 MEDIO" value={m.hrrAvg ? fmt(m.hrrAvg) : '—'} sub="lpm de caída" />
      </View>

      {done.length ? (
        <Card gap={0}>
          <Label>EJERCICIOS Y CARGAS</Label>
          {done.map((g, i) => {
            const e = ex[g.exerciseId];
            if (!e) return null;
            const record = sum.records.some((r) => r.exerciseId === g.exerciseId);
            return (
              <Pressable
                key={g.exerciseId}
                onPress={() => navigation.navigate('ExerciseDetail', { id: e.id })}
                accessibilityRole="button"
                accessibilityHint="Ver técnica e historial"
                style={({ pressed }) => ({ gap: 8, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}
              >
                <Row style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{ minWidth: 30, height: 24, paddingHorizontal: 5, borderRadius: 6, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
                      <T style={[mono(10), { color: C.lime }]}>{g.slot}</T>
                    </View>
                    <T style={[body(15, 600), { flexShrink: 1 }]} lines={1}>{e.name}</T>
                    {record ? <T style={[mono(10), { color: C.lime }]}>★ RÉCORD</T> : null}
                  </View>
                  <T style={[mono(11, 500), { color: C.muted }]}>{g.tonnage ? `${fmt(g.tonnage)} KG` : `${g.sets.length} SERIES`}</T>
                </Row>
                <T style={[mono(10, 500), { color: C.soft }]}>⏱ {mmss(g.durationSec)} EN TOTAL · {mmss(g.avgSetSec)} POR SERIE</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {g.sets.map((l, k) => (
                    <View key={l.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8, backgroundColor: C.chip, borderWidth: 1, borderColor: l.load === g.topLoad && g.topLoad > 0 && (e.loadMode === 'peso' || e.loadMode === 'lastre') ? C.lime : C.chip }}>
                      <T style={[mono(9, 500), { color: C.dim }]}>S{k + 1}</T>
                      <T style={[mono(12), { color: C.text }]}>{setText(e, l)}</T>
                      {l.rpe ? <T style={[mono(9, 500), { color: C.muted }]}>RPE {l.rpe}</T> : null}
                      {g.restBefore[k] !== undefined ? <T style={[mono(9, 500), { color: C.dim }]}>↺{mmss(g.restBefore[k]!)}</T> : null}
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
          <T style={[mono(9, 500, 1.4), { color: C.dim, paddingTop: 4 }]}>BORDE LIMA: CARGA MÁS ALTA. ↺ DESCANSO REAL ANTES DE LA SERIE. TOCA UNO PARA VER SU HISTORIAL.</T>
        </Card>
      ) : null}

      <Card gap={10}>
        <Label>RÉCORDS (1RM ESTIMADO)</Label>
        {sum.records.length ? (
          sum.records.map((r) => (
            <Row key={r.exerciseId} style={{ gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={body(15, 600)} lines={1}>{r.name}</T>
                <T style={[mono(11, 500), { color: C.muted }]}>{fmt(r.load)} kg × {r.reps}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T style={[cond(22), { color: C.lime }]}>{fmt(r.e1rm, 1)} KG</T>
                <T style={[mono(10, 500), { color: C.lime }]}>+{fmt(((r.e1rm - r.prev) / r.prev) * 100, 1)} %</T>
              </View>
            </Row>
          ))
        ) : (
          <T style={[body(13, 400, 1.4), { color: C.muted }]}>Hoy no hubo nuevos récords. Mantener la carga en déficit también es progreso.</T>
        )}
      </Card>

      {ranked.length ? (
        <Card gap={12}>
          <Label>MÚSCULOS TRABAJADOS</Label>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {(['front', 'back'] as const).map((v) => (
              <BodyMap key={v} view={v} width={130} fill={color} selected={sel} onSelect={(k) => setSel(sel === k ? undefined : k)} />
            ))}
          </View>
          {sel ? (
            <Row style={{ backgroundColor: C.chip, borderRadius: 12, padding: 12 }}>
              <T style={[cond(18), { textTransform: 'uppercase' }]}>{muscleName(sel)}</T>
              <T style={[mono(11), { color: picked?.primary ? C.lime : C.soft }]}>{picked ? `${fmt(picked.sets, 1)} SERIES` : 'NO SE TRABAJÓ'}</T>
            </Row>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ranked.slice(0, 8).map(([k, w]) => (
                <View key={k} style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: w.primary ? C.lime : C.border }}>
                  <T style={[mono(10), { color: w.primary ? C.lime : C.soft }]}>{muscleName(k).toUpperCase()} · {fmt(w.sets, 1)}</T>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      {streak ? (
        <Card gap={6}>
          <Label>RACHA</Label>
          <Row>
            <T style={[cond(28), { color: streak.current ? C.lime : C.text }]}>{streak.current} {streak.current === 1 ? 'SEMANA' : 'SEMANAS'}</T>
            <T style={[mono(11), { color: streak.thisWeek.done >= streak.thisWeek.goal ? C.lime : C.soft }]}>{streak.thisWeek.done}/{streak.thisWeek.goal} ESTA SEMANA</T>
          </Row>
          {streak.best > streak.current ? <T style={[mono(10, 500), { color: C.muted }]}>RÉCORD: {streak.best} SEMANAS</T> : null}
        </Card>
      ) : null}

      <PrimaryButton label="Listo" onPress={close} />
    </Screen>
  );
}
