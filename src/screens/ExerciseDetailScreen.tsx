import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AiRequestError, aiReady, draftExercise } from '../ai/api';
import { techniqueFromDraft } from '../ai/logic';
import { BodyMap, Sparkline } from '../components/charts';
import { Screen } from '../components/Screen';
import { TAG_COLORS, fmt, loadText, unitSuffix } from '../data';
import { LOAD_MODE_LABEL, PATTERN_LABEL } from '../domain/catalog';
import { shortDay } from '../domain/dates';
import { muscleName, type MuscleKey } from '../domain/muscles';
import { breathingFor, techniqueOf, videoSearchUrl } from '../domain/technique';
import type { Exercise, ExerciseTechnique } from '../domain/types';
import { bestView, exerciseHistory, muscleRoles } from '../engines/exerciseDetail';
import { alternativesFor } from '../engines/focus';
import { lastPerformance, suggestNext } from '../engines/progression';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, WORK_NONE, WORK_PRIMARY, WORK_SECONDARY, body, cond, em, mono } from '../theme';
import { Card, Chip, Eyebrow, GhostButton, LinkButton, PrimaryButton, Row, SheetHeader, T } from '../ui';

const amount = (e: Exercise, reps: number) => `${reps}${unitSuffix(e.unit) || ' reps'}`;
const withLoad = (e: Exercise, load: number, reps: number) =>
  e.loadMode === 'peso' || e.loadMode === 'lastre' ? `${loadText(e, load)} kg × ${amount(e, reps)}` : e.loadMode === 'palanca' ? `${loadText(e, load)} · ${amount(e, reps)}` : amount(e, reps);

function Bullets({ items, numbered, color = C.soft }: { items: string[]; numbered?: boolean; color?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <T style={[mono(12), { color: C.lime, width: 16 }]}>{numbered ? `${i + 1}` : '·'}</T>
          <T style={[body(14, 400, 1.4), { color, flex: 1 }]}>{x}</T>
        </View>
      ))}
    </View>
  );
}

function MuscleCard({ e, technique }: { e: Exercise; technique?: ExerciseTechnique }) {
  const { width } = useWindowDimensions();
  const { states } = useDerived();
  const roles = useMemo(() => muscleRoles(e), [e]);
  const [sel, setSel] = useState<MuscleKey | undefined>();
  const first = bestView(e);
  const views = first === 'back' ? (['back', 'front'] as const) : (['front', 'back'] as const);
  const mapW = Math.min(170, (width - 32 - 32 - 12) / 2);
  const feel = new Set(technique?.feel ?? []);
  const fill = (k: MuscleKey) => (roles[k] === 'primary' ? WORK_PRIMARY : roles[k] === 'secondary' ? WORK_SECONDARY : WORK_NONE);
  const worked = [...e.primary, ...e.secondary.filter((m) => !e.primary.includes(m))];
  const st = sel ? states[sel] : undefined;

  if (!worked.length) {
    return (
      <Card>
        <Eyebrow>PARTE DEL CUERPO</Eyebrow>
        <T style={[body(14, 400, 1.4), { color: C.muted }]}>Ejercicio aeróbico: trabaja el corazón y la resistencia general más que un músculo concreto.</T>
      </Card>
    );
  }

  return (
    <Card>
      <Row>
        <Eyebrow>PARTE DEL CUERPO</Eyebrow>
        <Row style={{ gap: 10 }}>
          <Legend color={WORK_PRIMARY} label="PRINCIPAL" />
          <Legend color={WORK_SECONDARY} label="SECUNDARIO" />
        </Row>
      </Row>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {views.map((v) => (
          <View key={v} style={{ alignItems: 'center', gap: 4 }}>
            <BodyMap view={v} width={mapW} fill={fill} outline={(k) => feel.has(k)} selected={sel} onSelect={(k) => setSel(sel === k ? undefined : k)} />
            <T style={[mono(9, 500), { color: C.dim }]}>{v === 'front' ? 'FRENTE' : 'ESPALDA'}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {worked.map((m) => {
          const on = sel === m;
          const primary = roles[m] === 'primary';
          return (
            <Pressable key={m} onPress={() => setSel(on ? undefined : m)} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Chip label={muscleName(m).toUpperCase()} bg={on ? C.lime : primary ? '#20280f' : 'transparent'} color={on ? C.bg : primary ? C.lime : C.soft} border={on ? C.lime : primary ? '#3c4d17' : C.border} />
            </Pressable>
          );
        })}
      </View>
      {st && sel ? (
        <T style={[body(13, 400, 1.4), { color: C.soft }]}>
          <T style={body(13, 600)}>{muscleName(sel)}</T> · {fmt(st.sets, Number.isInteger(st.sets) ? 0 : 1)}/{st.target} series esta semana · {Math.round(st.rec)} % recuperado
        </T>
      ) : (
        <T style={[mono(10, 500), { color: C.dim }]}>TOCA UN MÚSCULO PARA VER CÓMO VA ESTA SEMANA{feel.size ? ' · BORDE BLANCO: DÓNDE DEBES SENTIRLO' : ''}</T>
      )}
    </Card>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <T style={[mono(9, 500), { color: C.muted }]}>{label}</T>
  </View>
);

function TechniqueCard({ e }: { e: Exercise }) {
  const upsert = useStore((s) => s.upsertExercise);
  const link = useStore((s) => s.settings.watch);
  const [busy, setBusy] = useState(false);
  const t = techniqueOf(e);
  const video = () => Linking.openURL(videoSearchUrl(e.name)).catch(() => Alert.alert('No se pudo abrir YouTube'));

  const generate = () =>
    Alert.alert('Generar técnica con IA', 'Se envía el nombre y los músculos del ejercicio al servidor de Wrep. Usa una petición de IA.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Generar',
        onPress: async () => {
          setBusy(true);
          try {
            const muscles = [...e.primary, ...e.secondary].map(muscleName).join(', ');
            const raw = await draftExercise(link, `${e.name}${muscles ? `. Músculos: ${muscles}` : ''}`.slice(0, 300));
            const technique = techniqueFromDraft(raw.technique);
            if (!technique) throw new AiRequestError('La IA no devolvió la técnica. Prueba de nuevo.', 'empty');
            upsert({ ...e, technique });
          } catch (err) {
            Alert.alert('No se pudo generar', err instanceof AiRequestError ? err.message : 'Error de conexión.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Card>
      <Row>
        <Eyebrow color={C.lime}>CÓMO SE HACE</Eyebrow>
        {e.technique && e.custom ? <T style={[mono(9, 500), { color: C.dim }]}>{'TUYA'}</T> : null}
      </Row>
      {t ? (
        <>
          {t.setup.length ? (
            <View style={{ gap: 6 }}>
              <Eyebrow spacing={0.08}>PREPARACIÓN</Eyebrow>
              <Bullets items={t.setup} />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <Eyebrow spacing={0.08}>EJECUCIÓN</Eyebrow>
            <Bullets items={t.steps} numbered color={C.text} />
          </View>
          <View style={{ gap: 6 }}>
            <Eyebrow spacing={0.08}>RESPIRACIÓN</Eyebrow>
            <T style={[body(14, 400, 1.4), { color: C.soft }]}>{breathingFor(e.pattern)}</T>
          </View>
          {t.mistakes.length ? (
            <View style={{ gap: 6 }}>
              <Eyebrow spacing={0.08} color={C.amber}>ERRORES COMUNES</Eyebrow>
              <Bullets items={t.mistakes} />
            </View>
          ) : null}
          {t.feel.length ? (
            <T style={[body(13, 400, 1.4), { color: C.soft }]}>
              <T style={[mono(10), { color: C.muted }]}>DÓNDE SENTIRLO  </T>
              {t.feel.map(muscleName).join(', ')}
            </T>
          ) : null}
          {t.tip ? (
            <View style={{ borderLeftWidth: 2, borderLeftColor: C.lime, paddingLeft: 10 }}>
              <T style={[body(13, 500, 1.4), { color: C.text }]}>{t.tip}</T>
            </View>
          ) : null}
        </>
      ) : busy ? (
        <Row style={{ justifyContent: 'flex-start', gap: 10 }}>
          <ActivityIndicator color={C.lime} />
          <T style={[body(14), { color: C.muted }]}>Escribiendo las claves de técnica…</T>
        </Row>
      ) : aiReady(link) ? (
        <>
          <T style={[body(14, 400, 1.4), { color: C.muted }]}>Este ejercicio aún no tiene descripción de técnica.</T>
          <PrimaryButton label="Generar técnica con IA" onPress={generate} height={44} />
        </>
      ) : (
        <T style={[body(14, 400, 1.4), { color: C.muted }]}>Este ejercicio aún no tiene descripción. Empareja el servidor para generarla con IA o añádela en Editar.</T>
      )}
      <GhostButton label="▶ VER VÍDEO DE TÉCNICA" onPress={video} />
    </Card>
  );
}

function PrescriptionCard({ e }: { e: Exercise }) {
  const sessions = useStore((s) => s.sessions);
  const { deload } = useDerived();
  const next = useMemo(() => suggestNext(e, lastPerformance(sessions, e.id), deload), [e, sessions, deload]);
  const [lo, hi] = e.repRange;
  const rows: [string, string][] = [
    ['RANGO', `${lo}–${hi}${unitSuffix(e.unit) || ' reps'}`],
    ['CARGA', LOAD_MODE_LABEL[e.loadMode]],
  ];
  if (e.step > 0 && e.loadMode !== 'palanca') rows.push(['INCREMENTO', `${fmt(e.step, e.step % 1 ? 2 : 0)} kg`]);
  if (e.levers?.length) rows.push(['NIVELES', e.levers.join(' → ')]);
  if (e.legImpact) rows.push(['IMPACTO EN PIERNAS', e.legImpact.toUpperCase()]);
  return (
    <Card gap={10}>
      <Eyebrow>PRESCRIPCIÓN</Eyebrow>
      {rows.map(([k, v]) => (
        <Row key={k} style={{ alignItems: 'flex-start', gap: 12 }}>
          <T style={[mono(10, 500), { color: C.muted, paddingTop: 2 }]}>{k}</T>
          <T style={[body(14, 600), { flex: 1, textAlign: 'right' }]}>{v}</T>
        </Row>
      ))}
      <Row style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}>
        <T style={[mono(10), { color: C.lime }]}>{deload ? 'PRÓXIMA VEZ · DESCARGA' : 'PRÓXIMA VEZ'}</T>
        <T style={cond(22)}>{withLoad(e, next.load, next.reps)}</T>
      </Row>
    </Card>
  );
}

function HistoryCard({ e }: { e: Exercise }) {
  const sessions = useStore((s) => s.sessions);
  const { today, weight } = useDerived();
  const { width } = useWindowDimensions();
  const h = useMemo(() => exerciseHistory(sessions, e, weight, today), [sessions, e, weight, today]);
  if (!h.sessionsCount) {
    return (
      <Card>
        <Eyebrow>TU HISTORIAL</Eyebrow>
        <T style={[body(14, 400, 1.4), { color: C.muted }]}>Aún no lo has hecho. La primera vez se usa la carga inicial y a partir de ahí progresa solo.</T>
      </Card>
    );
  }
  return (
    <Card>
      <Row>
        <Eyebrow>TU HISTORIAL</Eyebrow>
        <T style={[mono(10), { color: C.muted }]}>{h.sessionsCount} {h.sessionsCount === 1 ? 'SESIÓN' : 'SESIONES'}</T>
      </Row>
      {h.lastDate ? (
        <View style={{ gap: 6 }}>
          <T style={[mono(10, 500), { color: C.muted }]}>ÚLTIMA VEZ · {shortDay(h.lastDate).toUpperCase()}</T>
          {h.lastSets.map((l, i) => (
            <Row key={l.id} style={{ gap: 10 }}>
              <T style={[mono(11), { color: C.dim, width: 18 }]}>{i + 1}</T>
              <T style={[body(14, 600), { flex: 1 }]}>{withLoad(e, l.load, l.reps)}</T>
              <T style={[mono(11, 500), { color: C.muted }]}>
                RPE {l.rpe}{l.hrPeak ? ` · ♥ ${l.hrPeak}` : ''}{l.hrr60 !== undefined ? ` · −${l.hrr60}` : ''}
              </T>
            </Row>
          ))}
        </View>
      ) : null}
      {h.best ? (
        <Row style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}>
          <T style={[mono(10), { color: C.muted }]}>MEJOR MARCA · {shortDay(h.best.date).toUpperCase()}</T>
          <T style={cond(20)}>{withLoad(e, h.best.load, h.best.reps)}</T>
        </Row>
      ) : null}
      {h.weekly.some((v) => v > 0) ? (
        <View style={{ gap: 4 }}>
          <T style={[mono(10, 500), { color: C.muted }]}>1RM ESTIMADO · 8 SEMANAS</T>
          <Sparkline values={h.weekly} width={width - 64} />
        </View>
      ) : null}
      <T style={[mono(11, 500, 1.4), { color: C.soft }]}>{h.note}</T>
    </Card>
  );
}

export function ExerciseDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>) {
  const { id, block, index } = route.params;
  const exercises = useStore((s) => s.exercises);
  const setArchived = useStore((s) => s.setArchived);
  const e = exercises.find((x) => x.id === id);
  const alternatives = useMemo(() => (e ? alternativesFor(e, exercises, new Set([e.id]), 4) : []), [e, exercises]);
  if (!e) {
    return (
      <Screen sheet>
        <SheetHeader eyebrow="EJERCICIO" title="No encontrado" onClose={() => navigation.goBack()} />
      </Screen>
    );
  }
  const technique = techniqueOf(e);
  const fromPlan = block !== undefined && index !== undefined;
  const eyebrow = [e.discipline, PATTERN_LABEL[e.pattern], e.plane].filter(Boolean).join(' · ').toUpperCase();

  const archive = () =>
    Alert.alert(e.archived ? 'Restaurar ejercicio' : 'Archivar ejercicio', e.archived ? 'Volverá a estar disponible para el generador.' : 'No se usará en nuevas sesiones; el historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: e.archived ? 'Restaurar' : 'Archivar', onPress: () => { setArchived(e.id, !e.archived); navigation.goBack(); } },
    ]);

  return (
    <Screen sheet>
      <SheetHeader eyebrow={eyebrow} title={e.name} onClose={() => navigation.goBack()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 }}>
        <Chip label={LOAD_MODE_LABEL[e.loadMode].toUpperCase()} color={TAG_COLORS[e.discipline]} border={TAG_COLORS[e.discipline]} />
        {e.advanced ? <Chip label="AVANZADO" color={C.amber} border={C.amber} /> : null}
        {e.custom ? <Chip label="PROPIO" /> : null}
        {e.archived ? <Chip label="ARCHIVADO" color={C.coral} border={C.coral} /> : null}
      </View>

      <MuscleCard e={e} technique={technique} />
      <TechniqueCard e={e} />
      <PrescriptionCard e={e} />
      <HistoryCard e={e} />

      {alternatives.length > 0 && (
        <Card gap={0}>
          <Eyebrow style={{ paddingBottom: 4 }}>ALTERNATIVAS</Eyebrow>
          {alternatives.map((a) => (
            <Pressable key={a.id} onPress={() => navigation.push('ExerciseDetail', { id: a.id })} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.line, opacity: pressed ? 0.6 : 1 })}>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={body(15, 600)}>{a.name}</T>
                  <T style={[mono(10, 500), { color: C.muted }]} lines={1}>{a.primary.map(muscleName).join(', ').toUpperCase()}</T>
                </View>
                <T style={[mono(10), { color: C.lime, letterSpacing: em(10, 0.06) }]}>VER</T>
              </Row>
            </Pressable>
          ))}
        </Card>
      )}

      {fromPlan ? (
        <PrimaryButton label="Cambiar por otro" onPress={() => navigation.replace('ExercisePicker', { mode: 'replace', block, index })} height={46} />
      ) : null}
      <Row style={{ justifyContent: 'center', gap: 28, paddingVertical: 4 }}>
        <LinkButton label="EDITAR" onPress={() => navigation.navigate('ExerciseEdit', { id: e.id })} />
        <LinkButton label={e.archived ? 'RESTAURAR' : 'ARCHIVAR'} color={C.muted} onPress={archive} />
      </Row>
    </Screen>
  );
}
