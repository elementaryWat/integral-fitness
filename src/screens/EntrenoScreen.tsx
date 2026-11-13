import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { BodyMap } from '../components/charts';
import { Screen } from '../components/Screen';
import { RpeChips, StepperRow } from '../components/Watch';
import { BLOCK_REST_LABEL, TAG_COLORS, fmt, loadText, loadUnit, mmss, prescription, unitLabel, unitSuffix } from '../data';
import { groupOf, MUSCLE_GROUPS, type MuscleGroup } from '../domain/catalog';
import { AiRequestError, aiReady, buildRoutine } from '../ai/api';
import { shortDay } from '../domain/dates';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import type { PlannedBlock, Session } from '../domain/types';
import { queueBalance } from '../engines/balance';
import { sessionMetrics } from '../engines/efficiency';
import { SHORT, groupStatus, recommendedGroups, relatedGroups, type GroupReadiness } from '../engines/focus';
import { buildQueue, estimateMinutes, SESSION_MINUTES } from '../engines/generator';
import { blocksFromAi, musclesWorked, type MuscleWork, MAX_BLOCKS, MAX_PER_BLOCK, MAX_ROUNDS, mergeWithNext, moveBlock, removeExercise, setRounds, splitOut } from '../engines/planEdit';
import { progressNote } from '../engines/progression';
import { useNav, useUi } from '../navigation';
import { useLive } from '../session';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { usePlanEditor } from './planEditor';
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
  const draft = useStore((s) => s.planDraft);
  const setPlanDraft = useStore((s) => s.setPlanDraft);
  const setFocus = (f: MuscleGroup[]) => {
    const go = () => { setPlanDraft(undefined); update({ focus: f, swaps: {} }); };
    if (draft) Alert.alert('Cambiar grupos', 'Se descartan los cambios que hiciste a la sesión de hoy.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Cambiar', onPress: go }]);
    else go();
  };
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
        <Pressable key={r.group} onPress={() => { useStore.getState().setPlanDraft(undefined); update({ focus: [...focus, r.group], swaps: {} }); }} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}>
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

/** iOS action sheet (Alert on other platforms) with a destructive last option when given. */
function actions(title: string, options: { label: string; onPress: () => void; destructive?: boolean }[]) {
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Cancelar'];
    const destructiveButtonIndex = options.findIndex((o) => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined, userInterfaceStyle: 'dark' },
      (i) => options[i]?.onPress(),
    );
  } else {
    Alert.alert(title, undefined, [...options.map((o) => ({ text: o.label, onPress: o.onPress, style: o.destructive ? ('destructive' as const) : ('default' as const) })), { text: 'Cancelar', style: 'cancel' }]);
  }
}

function IconButton({ label, onPress, disabled, a11y }: { label: string; onPress: () => void; disabled?: boolean; a11y: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => ({ minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.6 : 1 })}>
      <T style={[mono(13), { color: C.soft }]}>{label}</T>
    </Pressable>
  );
}

function BlockCard({ block, bi, session, editable }: { block: PlannedBlock; bi: number; session?: Session; editable?: boolean }) {
  const nav = useNav();
  const { ex, all, weight, today } = useDerived();
  const live = useLive().live;
  const { blocks, apply } = usePlanEditor();
  const total = blocks.length;
  const rounds = Math.max(1, ...block.items.map((i) => i.sets));
  const cardio = block.kind === 'cardio';
  const canMerge = bi < total - 1 && block.items.length + blocks[bi + 1].items.length <= MAX_PER_BLOCK && !cardio && blocks[bi + 1].kind !== 'cardio';

  const blockMenu = () =>
    actions(`Bloque ${block.key} · ${block.title}`, [
      ...(canMerge ? [{ label: `Unir con el bloque ${blocks[bi + 1].key} (superserie)`, onPress: () => apply((b) => mergeWithNext(b, bi, ex)) }] : []),
      ...(!cardio && block.items.length < MAX_PER_BLOCK ? [{ label: 'Añadir ejercicio a la superserie', onPress: () => nav.navigate('ExercisePicker', { mode: 'add', block: bi }) }] : []),
      { label: 'Quitar bloque', destructive: true, onPress: () => apply((b) => b.filter((_, i) => i !== bi)) },
    ]);

  const exerciseMenu = (ii: number, name: string) =>
    actions(name, [
      { label: 'Cambiar por otro ejercicio', onPress: () => nav.navigate('ExercisePicker', { mode: 'replace', block: bi, index: ii }) },
      ...(block.items.length > 1 && total < MAX_BLOCKS ? [{ label: 'Separar en su propio bloque', onPress: () => apply((b) => splitOut(b, bi, ii, ex)) }] : []),
      { label: 'Quitar de la sesión', destructive: true, onPress: () => apply((b) => removeExercise(b, bi, ii, ex)) },
    ]);

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
            <T style={[cond(20, 900), { color: C.bg }]}>{block.key}</T>
          </View>
          <T style={[cond(19), { textTransform: 'uppercase', flexShrink: 1 }]} lines={1}>{block.title}</T>
        </View>
        {editable ? <IconButton label="⋯" onPress={blockMenu} a11y={`Opciones del bloque ${block.key}`} /> : <T style={[mono(10, 500), { color: C.muted }]}>{BLOCK_REST_LABEL(block)}</T>}
      </Row>
      {editable && (
        <Row style={{ gap: 8 }}>
          {!cardio ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconButton label="−" onPress={() => apply((b) => setRounds(b, bi, rounds - 1, ex))} disabled={rounds <= 1} a11y="Quitar una ronda" />
              <T style={[mono(11), { color: C.text }]}>{rounds} {rounds === 1 ? 'RONDA' : 'RONDAS'}</T>
              <IconButton label="+" onPress={() => apply((b) => setRounds(b, bi, rounds + 1, ex))} disabled={rounds >= MAX_ROUNDS} a11y="Añadir una ronda" />
            </View>
          ) : <T style={[mono(10, 500), { color: C.muted }]}>{BLOCK_REST_LABEL(block)}</T>}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton label="↑" onPress={() => apply((b) => moveBlock(b, bi, -1, ex))} disabled={bi === 0} a11y="Subir bloque" />
            <IconButton label="↓" onPress={() => apply((b) => moveBlock(b, bi, 1, ex))} disabled={bi === total - 1} a11y="Bajar bloque" />
          </View>
        </Row>
      )}
      {block.items.map((it, ii) => {
        const e = ex[it.exerciseId];
        if (!e) return null;
        return (
          <View key={`${it.exerciseId}-${ii}`} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
            <Row style={{ alignItems: 'flex-start', gap: 8 }}>
              <Pressable style={{ flex: 1, gap: 4 }} disabled={!editable} onPress={() => nav.navigate('ExercisePicker', { mode: 'replace', block: bi, index: ii })} accessibilityHint={editable ? 'Cambiar ejercicio' : undefined}>
                <T style={body(16, 600)}>{e.name}</T>
                <T style={[mono(12, 500), { color: C.soft }]}>{prescription(e, it.sets, it.load, it.reps)}</T>
              </Pressable>
              {editable ? (
                <IconButton label="⋯" onPress={() => exerciseMenu(ii, e.name)} a11y={`Opciones de ${e.name}`} />
              ) : (
                <View style={{ paddingVertical: 5, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1, borderColor: TAG_COLORS[e.discipline] }}>
                  <T style={[mono(10), { color: TAG_COLORS[e.discipline] }]}>{e.discipline.toUpperCase()}</T>
                </View>
              )}
            </Row>
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
      {editable && !cardio && block.items.length < MAX_PER_BLOCK && (
        <Pressable onPress={() => nav.navigate('ExercisePicker', { mode: 'add', block: bi })} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }} accessibilityRole="button">
          <T style={[mono(11), { color: C.lime, letterSpacing: em(11, 0.06) }]}>+ AÑADIR A LA SUPERSERIE</T>
        </Pressable>
      )}
    </Card>
  );
}

/** Asks the server's AI for a routine for the chosen muscle groups, using only the user's library. */
function AiBuildButton() {
  const { states, deload, today } = useDerived();
  const { ctx } = usePlanEditor();
  const link = useStore((s) => s.settings.watch);
  const focus = useStore((s) => s.settings.focus);
  const minutes = useStore((s) => s.settings.plannedMinutes);
  const profile = useStore((s) => s.profile);
  const exercises = useStore((s) => s.exercises);
  const setPlanDraft = useStore((s) => s.setPlanDraft);
  const [busy, setBusy] = useState(false);

  const groups: MuscleGroup[] = focus.length ? focus : MUSCLE_GROUPS.map((g) => g.key).filter((g) => g !== 'cardio');
  const build = async () => {
    if (busy) return;
    if (!aiReady(link)) {
      Alert.alert('IA no disponible', 'Configura el servidor en Hoy → Bip 6 → Reloj.');
      return;
    }
    const muscles = groups.flatMap((g) => [...(MUSCLE_GROUPS.find((x) => x.key === g)?.muscles ?? [])]);
    const catalog = exercises
      .filter((e) => !e.archived && groups.includes(groupOf(e)))
      .map((e) => ({ id: e.id, name: e.name, primary: e.primary, secondary: e.secondary, pattern: e.pattern, plane: e.plane, discipline: e.discipline, advanced: e.advanced }));
    setBusy(true);
    try {
      const res = await buildRoutine(link, {
        groups,
        minutes,
        experience: profile?.experience,
        goal: profile?.goal,
        deload,
        muscles: Object.fromEntries(muscles.map((m) => [m, { sets: Math.round(states[m].sets), target: states[m].target, rec: Math.round(states[m].rec), status: states[m].status }])),
        catalog,
      });
      const blocks = blocksFromAi(res, ctx, minutes);
      if (!blocks.length) throw new AiRequestError('La IA no devolvió ejercicios válidos. Vuelve a intentarlo.', 'empty');
      setPlanDraft({ date: today, blocks, name: `IA · ${res.name}`, note: res.rationale });
    } catch (e) {
      Alert.alert('No se pudo armar la rutina', e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setBusy(false);
    }
  };
  
  return (
    <Pressable onPress={build} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ height: 48, borderRadius: 24, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.7 : pressed ? 0.85 : 1 })}>
      {busy ? <ActivityIndicator color={C.bg} /> : null}
      <T style={[cond(18), { color: C.bg, textTransform: 'uppercase' }]}>
        {busy ? 'Armando rutina…' : `✦ Armar con IA · ${focus.length ? groups.map((g) => MUSCLE_GROUPS.find((x) => x.key === g)?.label).join(', ') : 'cuerpo completo'}`}
      </T>
    </Pressable>
  );
}

const WORK_PRIMARY = C.lime;
const WORK_SECONDARY = '#5f7a1c';
const WORK_NONE = '#232523';

/** Collapsible body sketch of the muscles today's session works (primary vs secondary). */
function SessionMusclesCard({ blocks }: { blocks: PlannedBlock[] }) {
  const { ex } = useDerived();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<MuscleKey | undefined>();
  const work = musclesWorked(blocks, ex);
  const ranked = (Object.entries(work) as [MuscleKey, MuscleWork][]).sort((a, b) => Number(b[1].primary) - Number(a[1].primary) || b[1].sets - a[1].sets);
  const main = ranked.filter(([, w]) => w.primary);
  if (!ranked.length) return null;
  const color = (k: MuscleKey) => (work[k]?.primary ? WORK_PRIMARY : work[k] ? WORK_SECONDARY : WORK_NONE);
  const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  const picked = sel ? work[sel] : undefined;
  const summary = main.slice(0, 3).map(([m]) => SHORT[m]).join(', ') + (main.length > 3 ? ` +${main.length - 3}` : '');

  return (
    <Card gap={open ? 12 : 0} padding={14}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Músculos de esta sesión">
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted }]}>MÚSCULOS DE ESTA SESIÓN</T>
            <T style={[cond(18), { textTransform: 'uppercase' }]} lines={1}>{summary}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: open ? C.lime : C.border }}>
            <T style={[mono(10), { color: open ? C.lime : C.soft }]}>{open ? 'OCULTAR' : 'VER CROQUIS'}</T>
            <T style={[mono(10), { color: open ? C.lime : C.soft }]}>{open ? '▴' : '▾'}</T>
          </View>
        </Row>
      </Pressable>
      {open && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {(['front', 'back'] as const).map((v) => (
              <View key={v} style={{ alignItems: 'center', gap: 4 }}>
                <BodyMap view={v} selected={sel} onSelect={(k) => setSel(sel === k ? undefined : k)} fill={color} width={118} />
                <T style={[mono(9), { color: C.dim }]}>{v === 'front' ? 'FRENTE' : 'ESPALDA'}</T>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>
            {([[WORK_PRIMARY, 'Principal'], [WORK_SECONDARY, 'Secundario'], [WORK_NONE, 'No trabaja']] as const).map(([c, l]) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c, borderWidth: 1, borderColor: C.border }} />
                <T style={[body(12), { color: C.soft }]}>{l}</T>
              </View>
            ))}
          </View>
          {sel ? (
            <View style={{ backgroundColor: C.chip, borderRadius: 12, padding: 12, gap: 4 }}>
              <Row>
                <T style={[cond(18), { textTransform: 'uppercase' }]}>{MUSCLE_INFO[sel].name}</T>
                <T style={[mono(11), { color: picked?.primary ? C.lime : picked ? C.soft : C.dim }]}>{picked ? `${fmtSets(picked.sets)} SERIES` : 'NO SE TRABAJA'}</T>
              </Row>
              <T style={[body(12, 400, 1.4), { color: C.muted }]}>{picked ? picked.exercises.join(' · ') : 'Ningún ejercicio de esta sesión lo trabaja.'}</T>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ranked.map(([m, w]) => (
                <Pressable key={m} onPress={() => setSel(m)} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: w.primary ? C.lime : C.border }}>
                  <T style={[mono(10), { color: w.primary ? C.lime : C.soft }]}>{SHORT[m].toUpperCase()}</T>
                  <T style={[mono(10), { color: C.dim }]}>{fmtSets(w.sets)}</T>
                </Pressable>
              ))}
            </View>
          )}
          <T style={[mono(9, 500, 1.4), { color: C.dim }]}>SERIES DE LA SESIÓN: PRINCIPAL CUENTA 1, SECUNDARIO 0,5. TOCA UN MÚSCULO PARA VER SUS EJERCICIOS.</T>
        </>
      )}
    </Card>
  );
}

/** Plan name, routines and reset controls above the editable blocks. */
function PlanBar() {
  const nav = useNav();
  const { planName, edited, reset, blocks } = usePlanEditor();
  const note = useStore((s) => s.planDraft?.note);
  const routines = useStore((s) => s.routines.length);
  return (
    <View style={{ gap: 8, paddingTop: 6 }}>
      <AiBuildButton />
      <Row style={{ alignItems: 'baseline', paddingHorizontal: 2 }}>
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: edited ? C.lime : C.muted, flexShrink: 1 }]} lines={1}>
          {edited ? (planName ?? 'SESIÓN EDITADA').toUpperCase() : 'SESIÓN GENERADA · EDÍTALA ABAJO'}
        </T>
        {edited ? (
          <LinkButton label="RESTABLECER" color={C.muted} onPress={() => Alert.alert('Restablecer sesión', 'Se descartan los cambios de hoy y vuelve la sesión generada.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Restablecer', style: 'destructive', onPress: reset }])} />
        ) : null}
      </Row>
      {edited && note ? <T style={[body(13, 400, 1.4), { color: C.soft, paddingHorizontal: 2 }]}>{note}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <GhostButton label={routines ? `MIS RUTINAS · ${routines}` : 'MIS RUTINAS'} onPress={() => nav.navigate('Routines')} height={40} />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label="GUARDAR COMO RUTINA" onPress={() => nav.navigate('Routines')} height={40} color={blocks.length ? C.lime : C.dim} />
        </View>
      </View>
    </View>
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

      {!active && <PlanBar />}
      {blocks.length > 0 && <SessionMusclesCard blocks={blocks} />}
      {blocks.map((b, i) => <BlockCard key={b.key} bi={i} block={b} session={active} editable={!active} />)}
      {!active && blocks.length < MAX_BLOCKS && (
        <Pressable onPress={() => nav.navigate('ExercisePicker', { mode: 'addBlock' })} accessibilityRole="button" style={({ pressed }) => ({ height: 52, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <T style={[mono(11), { color: C.soft, letterSpacing: em(11, 0.08) }]}>+ AÑADIR BLOQUE</T>
        </Pressable>
      )}

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
