import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen } from '../components/Screen';
import { today, uid } from '../domain/dates';
import { fromRoutine, routineMuscles, toRoutine, type Routine } from '../engines/planEdit';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, em, mono } from '../theme';
import { Card, Empty, Eyebrow, Field, PrimaryButton, Row, SheetHeader, T } from '../ui';
import { usePlanEditor } from './planEditor';

/** Save today's session as a routine, or load a saved one as today's session. */
export function RoutinesScreen() {
  const nav = useNav();
  const routines = useStore((s) => s.routines);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const setPlanDraft = useStore((s) => s.setPlanDraft);
  const active = useStore((s) => !!s.activeSession);
  const { blocks, ctx, planName } = usePlanEditor();
  const [name, setName] = useState(planName && planName !== 'Sesión editada' ? planName : '');

  const exerciseCount = blocks.reduce((t, b) => t + b.items.length, 0);
  const save = () => {
    const n = name.trim();
    if (!n || !blocks.length) return;
    const existing = routines.find((r) => r.name.toLowerCase() === n.toLowerCase());
    const doSave = () => {
      const r = toRoutine(n, blocks, existing?.id ?? uid(), today());
      saveRoutine(r);
      setPlanDraft({ date: today(), blocks, name: r.name, routineId: r.id });
      nav.goBack();
    };
    if (existing) Alert.alert('Reemplazar rutina', `Ya tienes “${existing.name}”. ¿La sustituyes por la sesión actual?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Reemplazar', onPress: doSave }]);
    else doSave();
  };

  const load = (r: Routine) => {
    const go = () => {
      setPlanDraft({ date: today(), blocks: fromRoutine(r, ctx), name: r.name, routineId: r.id });
      nav.goBack();
    };
    if (active) Alert.alert('Hay una sesión en curso', 'Termínala antes de cargar otra rutina.');
    else go();
  };

  const remove = (r: Routine) =>
    Alert.alert('Borrar rutina', `“${r.name}” se eliminará. La sesión de hoy no cambia.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteRoutine(r.id) },
    ]);

  return (
    <Screen sheet>
      <SheetHeader eyebrow="ENTRENO · PLANTILLAS" title="Mis rutinas" onClose={() => nav.goBack()} />

      <Card>
        <Eyebrow>GUARDAR LA SESIÓN DE HOY</Eyebrow>
        <T style={[body(13, 400, 1.4), { color: C.muted }]}>
          {blocks.length ? `${blocks.length} bloques · ${exerciseCount} ejercicios. Las cargas se recalculan con tu historial cada vez que la cargas.` : 'No hay ejercicios en la sesión de hoy.'}
        </T>
        <Field label="NOMBRE" value={name} onChange={setName} keyboard="default" placeholder="Torso A, Pierna, Full body…" />
        <PrimaryButton label="Guardar rutina" onPress={save} disabled={!name.trim() || !blocks.length} height={46} />
      </Card>

      <Card gap={0}>
        <Eyebrow style={{ paddingBottom: 4 }}>GUARDADAS · TOCA PARA USAR HOY</Eyebrow>
        {routines.length === 0 && <Empty text="Aún no tienes rutinas. Ajusta la sesión en Entreno y guárdala aquí para repetirla otro día." />}
        {routines.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => load(r)}
            onLongPress={() => remove(r)}
            accessibilityRole="button"
            accessibilityHint="Mantén pulsado para borrar"
            style={({ pressed }) => ({ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, opacity: pressed ? 0.6 : 1 })}
          >
            <Row style={{ gap: 10, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <T style={[cond(20), { textTransform: 'uppercase' }]}>{r.name}</T>
                <T style={[mono(10, 500), { color: C.muted }]}>
                  {r.blocks.length} BLOQUES · {r.blocks.reduce((t, b) => t + b.exerciseIds.length, 0)} EJERCICIOS
                </T>
                <T style={[body(12, 400), { color: C.dim }]} lines={1}>{routineMuscles(r, ctx.ex)}</T>
              </View>
              <T style={[mono(10), { color: C.lime, letterSpacing: em(10, 0.06) }]}>USAR</T>
            </Row>
          </Pressable>
        ))}
        {routines.length > 0 && <T style={[mono(9, 500), { color: C.dim, paddingTop: 8 }]}>MANTÉN PULSADA UNA RUTINA PARA BORRARLA</T>}
      </Card>
    </Screen>
  );
}
