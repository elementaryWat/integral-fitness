import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Screen } from '../components/Screen';
import { RpeChips, StepperRow } from '../components/Watch';
import { BLOCK_REST_LABEL, TAG_COLORS, fmt, loadText, loadUnit, mmss, prescription, unitLabel, unitSuffix } from '../data';
import { MUSCLE_GROUPS, type MuscleGroup } from '../domain/catalog';
import { shortDay } from '../domain/dates';
import type { PlannedBlock, Session } from '../domain/types';
import { queueBalance } from '../engines/balance';
import { sessionMetrics } from '../engines/efficiency';
import { alternativesFor, groupStatus, recommendedGroups, relatedGroups, type GroupReadiness } from '../engines/focus';
import { buildQueue, estimateMinutes, SESSION_MINUTES } from '../engines/generator';
import { progressNote } from '../engines/progression';
import { useNav, useUi } from '../navigation';
import { useLive } from '../session';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, GhostButton, LinkButton, PrimaryButton, Row, ScreenHeader, Segmented, StatTile, T } from '../ui';

function LiveCard() {
  const { live, current, exercise, session, nextText } = useLive();
  const open = useUi((s) => s.setWatchOpen);
  const watchLive = useUi((s) => s.watchLive);
  const { ex, weight } = useDerived();
  let tag: string, text: string, right: string;
  if (live.mode === 'set' && current && exercise) {
    tag = `EN EL RELOJ · SERIE ${current.set}/${current.sets}`;
    text = `${current.block}${current.pos} ${exercise.name}`;
    right = `${Math.round(watchLive?.hr ?? live.hr)} LPM`;
  } else if (live.mode === 'rest') {
    tag = live.hrRule ? `DESCANSO · FC ${Math.round(watchLive?.hr ?? live.hr)}` : 'TRANSICIÓN SUPERSERIE';
    text = 'Sig. ' + nextText;
    right = mmss(Math.max(0, live.restTarget - live.restT));
  } else if (live.mode === 'alert') {
    tag = 'VIBRANDO EN MUÑECA';
    text = live.alertReason;
    right = '● ● ●';
  } else {
    tag = 'SESIÓN COMPLETADA';
    text = 'Todas las series registradas';
    right = session ? mmss(sessionMetrics(session, ex, weight).totalSec) : '—';
  }
  return (
    <Pressable onPress={() => open(true)} accessibilityLabel="Abrir el reloj" style={{ borderWidth: 1, borderColor: C.lime, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.lime }} />
          <T style={[mono(10), { letterSpacing: em(10, 0.1), color: C.lime }]}>{tag}</T>
        </View>
        <T style={body(14, 600)} lines={1}>{text}</T>
      </View>
      <T style={cond(30)}>{right}</T>
    </Pressable>
  );
}

/** Same set controls as the watch, for training without it. */
function PhoneLogger() {
  const { live, current, exercise, adjust, register, advance } = useLive();
  if (live.mode === 'rest' || live.mode === 'alert') {
    return <GhostButton label={live.mode === 'alert' ? 'EMPEZAR SIGUIENTE SERIE' : 'SALTAR DESCANSO'} onPress={advance} color={C.text} />;
  }
  if (live.mode !== 'set' || !current || !exercise) return null;
  return (
    <Card gap={10}>
      <Row>
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted }]}>REGISTRO EN EL MÓVIL</T>
        <T style={[mono(10), { color: C.lime }]}>{`${current.block}${current.pos} · ${current.set}/${current.sets}`}</T>
      </Row>
      <T style={[cond(22), { textTransform: 'uppercase' }]} lines={1}>{exercise.name}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><StepperRow value={loadText(exercise, live.cur.load)} unit={loadUnit(exercise)} disabled={!exercise.step} onMinus={() => adjust('load', -1)} onPlus={() => adjust('load', 1)} /></View>
        <View style={{ flex: 1 }}><StepperRow value={live.cur.reps} unit={unitLabel(exercise.unit)} onMinus={() => adjust('reps', -1)} onPlus={() => adjust('reps', 1)} /></View>
      </View>
      <RpeChips />
      <PrimaryButton label={`Registrar · RIR ${10 - live.cur.rpe}`} onPress={register} height={46} />
    </Card>
  );
}

const GROUP_LABEL = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.key, g.label])) as Record<MuscleGroup, string>;
const READY: Record<GroupReadiness, { label: string; color: string }> = {
  listo: { label: 'RECOMENDADO', color: C.lime },
  pendiente: { label: 'DISPONIBLE', color: C.soft },
  cubierto: { label: 'SEMANA CUBIERTA', color: C.muted },
  fatiga: { label: 'RECUPERANDO', color: C.coral },
};

/** Pick the muscle groups for today; tiles show how ready each one is. */
function FocusPicker() {
  const focus = useStore((s) => s.settings.focus);
  const update = useStore((s) => s.updateSettings);
  const { states } = useDerived();
  const setFocus = (f: MuscleGroup[]) => update({ focus: f, swaps: {} });
  const toggle = (g: MuscleGroup) => setFocus(focus.includes(g) ? focus.filter((x) => x !== g) : [...focus, g]);
  const recommended = recommendedGroups(states);
  const presets: { label: string; groups: MuscleGroup[] }[] = [
    { label: 'Equilibrado 80/20', groups: [] },
    ...(recommended.length ? [{ label: '✦ Recomendado hoy', groups: recommended }] : []),
    { label: 'Torso', groups: ['pecho', 'espalda', 'hombros'] },
    { label: 'Brazos', groups: ['biceps', 'triceps'] },
    { label: 'Pierna + core', groups: ['piernas', 'core'] },
  ];
  const same = (a: MuscleGroup[], b: MuscleGroup[]) => a.length === b.length && a.every((x) => b.includes(x));
  const tiles = MUSCLE_GROUPS.map((g) => g.key);

  return (
    <Card gap={12}>
      <Row>
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted }]}>GRUPOS MUSCULARES · TOCA PARA ELEGIR</T>
        {focus.length ? <LinkButton label="LIMPIAR" onPress={() => setFocus([])} color={C.muted} /> : null}
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {presets.map((p) => {
          const on = same(focus, p.groups);
          return (
            <Pressable key={p.label} onPress={() => setFocus(p.groups)} accessibilityState={{ selected: on }} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: on ? C.lime : C.border, backgroundColor: on ? C.lime : 'transparent', justifyContent: 'center' }}>
              <T style={[mono(11), { color: on ? C.bg : C.soft }]}>{p.label.toUpperCase()}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiles.map((g) => {
          const on = focus.includes(g);
          const st = groupStatus(states, g);
          const r = READY[st.readiness === 'listo' && !recommended.includes(g) ? 'pendiente' : st.readiness];
          const wide = g === 'cardio';
          return (
            <Pressable
              key={g}
              onPress={() => toggle(g)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => ({
                flexBasis: wide ? '100%' : '46%', flexGrow: 1, padding: 12, gap: 6, borderRadius: 14, borderWidth: 1,
                borderColor: on ? C.lime : C.line, backgroundColor: on ? '#12160a' : C.chip, opacity: pressed ? 0.85 : 1,
              })}
            >
              <Row>
                <T style={[cond(22), { textTransform: 'uppercase', color: on ? C.text : C.soft }]}>{GROUP_LABEL[g]}</T>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 0 : 1.5, borderColor: '#4c504a', backgroundColor: on ? C.lime : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <T style={[body(12, 700), { color: C.bg }]}>✓</T> : null}
                </View>
              </Row>
              <T style={[mono(9), { color: r.color, letterSpacing: em(9, 0.08) }]}>{wide ? 'ZONA 2 AL FINAL DE LA SESIÓN' : r.label}</T>
              {!wide && <T style={[mono(10, 500), { color: C.dim }]}>{st.sets}/{st.target} series · rec {st.rec}%</T>}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** Groups that combine well with the current selection. */
function RelatedCard() {
  const focus = useStore((s) => s.settings.focus);
  const update = useStore((s) => s.updateSettings);
  const { states } = useDerived();
  if (!focus.length) {
    return <T style={[body(12, 400, 1.4), { color: C.muted, paddingHorizontal: 2 }]}>Sin grupos elegidos: plan equilibrado 80/20 que reparte el volumen según lo que lleves esta semana.</T>;
  }
  const related = relatedGroups(focus, states);
  const recommended = recommendedGroups(states);
  if (!related.length) return null;
  return (
    <Card gap={0}>
      <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted, paddingBottom: 4 }]}>COMBINA BIEN CON</T>
      {related.map((r, i) => (
        <Pressable key={r.group} onPress={() => update({ focus: [...focus, r.group], swaps: {} })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
            <T style={[body(16, 600), { color: C.lime }]}>+</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={[cond(18), { textTransform: 'uppercase' }]}>{GROUP_LABEL[r.group]}</T>
            <T style={[body(12, 400), { color: C.muted }]}>{r.reason}</T>
          </View>
          {recommended.includes(r.group) ? <T style={[mono(9), { color: C.lime }]}>RECOMENDADO</T> : null}
        </Pressable>
      ))}
    </Card>
  );
}

function BlockCard({ block, session, plan }: { block: PlannedBlock; session?: Session; plan?: PlannedBlock[] }) {
  const { ex, all, weight, today } = useDerived();
  const live = useLive().live;
  const exercises = useStore((s) => s.exercises);
  const swaps = useStore((s) => s.settings.swaps);
  const update = useStore((s) => s.updateSettings);
  const [open, setOpen] = useState<string | null>(null);
  const inPlan = new Set((plan ?? []).flatMap((b) => b.items.map((i) => i.exerciseId)));
  const swapTo = (current: string, to: string) => {
    const original = Object.keys(swaps).find((k) => swaps[k] === current) ?? current;
    const next = { ...swaps };
    if (to === original) delete next[original]; else next[original] = to;
    update({ swaps: next });
    setOpen(null);
  };
  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
            <T style={[cond(20, 900), { color: C.bg }]}>{block.key}</T>
          </View>
          <T style={[cond(19), { textTransform: 'uppercase', flexShrink: 1 }]} lines={1}>{block.title}</T>
        </View>
        <T style={[mono(10, 500), { color: C.muted }]}>{BLOCK_REST_LABEL(block)}</T>
      </Row>
      {block.items.map((it) => {
        const e = ex[it.exerciseId];
        if (!e) return null;
        return (
          <View key={it.exerciseId} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
            <Row style={{ alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T style={body(16, 600)}>{e.name}</T>
                <T style={[mono(12, 500), { color: C.soft }]}>{prescription(e, it.sets, it.load, it.reps)}</T>
              </View>
              {plan && block.kind !== 'cardio' ? (
                <Pressable onPress={() => setOpen(open === e.id ? null : e.id)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: open === e.id ? C.lime : C.border }}>
                  <T style={[mono(10), { color: open === e.id ? C.lime : C.soft }]}>{open === e.id ? 'CERRAR' : 'CAMBIAR'}</T>
                </Pressable>
              ) : (
                <View style={{ paddingVertical: 5, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1, borderColor: TAG_COLORS[e.discipline] }}>
                  <T style={[mono(10), { color: TAG_COLORS[e.discipline] }]}>{e.discipline.toUpperCase()}</T>
                </View>
              )}
            </Row>
            {plan && open === e.id && (() => {
              const original = Object.keys(swaps).find((k) => swaps[k] === e.id);
              const alts = alternativesFor(e, exercises, inPlan);
              return (
                <View style={{ gap: 6 }}>
                  <T style={[mono(10), { color: C.muted, letterSpacing: em(10, 0.08) }]}>RELACIONADOS · MISMO MÚSCULO PRIMERO</T>
                  {original && ex[original] ? (
                    <Pressable onPress={() => swapTo(e.id, original)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
                      <T style={[body(14, 600), { color: C.soft }]}>↺ Volver a {ex[original].name}</T>
                    </Pressable>
                  ) : null}
                  {alts.map((a) => (
                    <Pressable key={a.id} onPress={() => swapTo(e.id, a.id)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: pressed ? C.border : C.chip })}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T style={body(14, 600)}>{a.name}</T>
                        <T style={[mono(10, 500), { color: C.muted }]}>{a.discipline.toUpperCase()}{a.levers ? ` · ${a.levers.length} NIVELES` : ''}{a.advanced ? ' · AVANZADO' : ''}</T>
                      </View>
                      <T style={[mono(10), { color: C.lime }]}>USAR</T>
                    </Pressable>
                  ))}
                  {!alts.length && <T style={[body(12), { color: C.muted }]}>No hay otros ejercicios de este músculo en tu biblioteca.</T>}
                </View>
              );
            })()}
            {session && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: it.sets }, (_, i) => {
                  const idx = session.queue.findIndex((q) => q.block === block.key && q.exerciseId === it.exerciseId && q.set === i + 1);
                  const lg = session.sets.find((l) => l.qi === idx);
                  let label = `S${i + 1}`, bg: string = C.chip, color: string = C.muted, border: string = C.chip;
                  if (lg) {
                    label = `${e.step || e.loadMode === 'palanca' ? loadText(e, lg.load) + '×' + lg.reps : lg.reps + unitSuffix(e.unit)} · ${lg.rpe}`;
                    bg = C.lime; color = C.bg; border = C.lime;
                  } else if (idx === live.qi && live.mode !== 'done') {
                    label = `S${i + 1} · AHORA`;
                    bg = 'transparent'; color = C.lime; border = C.lime;
                  }
                  return (
                    <View key={i} style={{ paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
                      <T style={[mono(11), { color }]}>{label}</T>
                    </View>
                  );
                })}
              </View>
            )}
            <T style={[mono(11, 500, 1.3), { color: C.muted }]}>{progressNote(all, e, weight, today)}</T>
          </View>
        );
      })}
    </Card>
  );
}

function History() {
  const sessions = useStore((s) => s.sessions);
  const { ex, weight } = useDerived();
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6);
  if (!recent.length) return null;
  return (
    <Card gap={0}>
      <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted, paddingBottom: 4 }]}>HISTORIAL</T>
      {recent.map((s, i) => {
        const m = sessionMetrics(s, ex, weight);
        return (
          <Row key={s.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <View style={{ gap: 3 }}>
              <T style={[cond(18), { textTransform: 'uppercase' }]}>{shortDay(s.date)} · {s.plannedMinutes} min{s.deload ? ' · desc.' : ''}</T>
              <T style={[mono(11, 500), { color: C.muted }]}>{s.sets.length} series · {mmss(m.totalSec)}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <T style={cond(20)}>{fmt(m.tonnage)} KG</T>
              <T style={[mono(11, 500), { color: C.lime }]}>{fmt(m.density, 1)} kg/min</T>
            </View>
          </Row>
        );
      })}
    </Card>
  );
}

export function EntrenoScreen() {
  const nav = useNav();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const active = useStore((s) => s.activeSession);
  const start = useStore((s) => s.startSession);
  const finish = useStore((s) => s.finishSession);
  const discard = useStore((s) => s.discardSession);
  const { live } = useLive();
  const { plan, ex, weight, deload } = useDerived();
  const focus = settings.focus;

  const blocks = active?.blocks ?? plan;
  const queue = active?.queue ?? buildQueue(plan);
  const lowerShare = queue.length ? Math.round(queueBalance(queue, ex).lowerShare * 100) : 0;
  const liveRest = live.mode === 'rest' || live.mode === 'alert' ? live.restT : 0;
  const m = active ? sessionMetrics(active, ex, weight, liveRest) : undefined;

  const confirmEnd = () => {
    if (!active) return;
    if (live.mode === 'done' || !active.sets.length) { finish(); return; }
    Alert.alert('Terminar sesión', `Quedan ${active.queue.length - active.sets.length} series. ¿Guardar lo registrado?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: discard },
      { text: 'Guardar', onPress: finish },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={active ? 'SESIÓN EN CURSO' : 'ENTRENO · HOY'} title={active ? 'Hecha a tu tiempo' : '¿Qué entrenas?'} />
      {!active && <FocusPicker />}
      {!active && <RelatedCard />}
      {!active && (
        <Segmented
          options={SESSION_MINUTES}
          value={settings.plannedMinutes}
          onChange={(d) => update({ plannedMinutes: d })}
          height={52}
          radius={12}
          outerRadius={16}
          render={(d, on) => (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <T style={[cond(30), { color: on ? C.bg : C.soft }]}>{d}</T>
              <T style={[mono(10), { color: on ? C.bg : C.soft }]}>MIN</T>
            </View>
          )}
        />
      )}
      <T style={[body(12, 400, 1.4), { color: C.muted, paddingHorizontal: 2 }]}>
        {active || !focus.length ? 'Superseries antagonistas sin tiempos muertos' : `Tu selección: ${focus.map((g) => GROUP_LABEL[g].toLowerCase()).join(', ')}`} · ~{estimateMinutes(blocks, ex)} min estimados. Tren inferior: <T style={{ color: C.text }}>{lowerShare}% de las series</T>.
        {deload ? <T style={{ color: C.amber }}> Semana de descarga: volumen y cargas reducidos.</T> : null}
      </T>

      {active ? (
        <>
          <LiveCard />
          <PhoneLogger />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile label="DENSIDAD" value={m?.hasLogs && m.restSec > 0 ? fmt(m.density, 1) : '—'} sub="kg/min efectivos" />
            <StatTile label="ACTIVO : DESCANSO" value={m?.hasLogs && m.restSec > 0 ? '1:' + fmt(m.restRatio, 1) : '—'} sub="timestamps del reloj" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile label="TONELAJE" value={m?.hasLogs ? fmt(m.tonnage) : '—'} sub={`kg · ${mmss(m?.totalSec ?? 0)}`} />
            <StatTile label="HRR-60 MEDIO" value={m?.hasLogs ? fmt(m.hrrAvg) : '—'} sub="lpm de caída" />
          </View>
        </>
      ) : (
        <PrimaryButton label={`Empezar sesión · ${queue.length} series`} onPress={() => start(plan, settings.plannedMinutes, deload)} disabled={!plan.length} />
      )}

      {!active && blocks.length > 0 && (
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted, paddingTop: 6, paddingHorizontal: 2 }]}>EJERCICIOS RECOMENDADOS · TOCA “CAMBIAR” PARA VER RELACIONADOS</T>
      )}
      {blocks.map((b) => <BlockCard key={b.key} block={b} session={active} plan={active ? undefined : plan} />)}

      {active ? (
        <GhostButton label={live.mode === 'done' ? 'GUARDAR SESIÓN' : 'TERMINAR SESIÓN'} onPress={confirmEnd} color={live.mode === 'done' ? C.lime : C.soft} />
      ) : (
        <History />
      )}
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <LinkButton label="BIBLIOTECA DE EJERCICIOS →" onPress={() => nav.navigate('ExerciseLibrary')} />
      </View>
    </Screen>
  );
}
