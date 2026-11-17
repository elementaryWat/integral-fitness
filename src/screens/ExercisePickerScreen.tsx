import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { TAG_COLORS } from '../data';
import { groupOf, MUSCLE_GROUPS } from '../domain/catalog';
import { muscleName } from '../domain/muscles';
import { matchesExercise } from '../domain/search';
import type { Exercise } from '../domain/types';
import { alternativesFor, isAntagonist } from '../engines/focus';
import { deficit } from '../engines/generator';
import { addBlock, addToBlock, replaceExercise } from '../engines/planEdit';
import { useNav, type RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, SheetHeader, T } from '../ui';
import { usePlanEditor } from './planEditor';

function Row({ e, onPress, tag }: { e: Exercise; onPress: () => void; tag?: string }) {
  const nav = useNav();
  const color = TAG_COLORS[e.discipline];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1, gap: 3 }}>
        <T style={body(15, 600)}>{e.name}</T>
        <T style={[mono(10, 500), { color: C.muted }]} lines={1}>
          {e.primary.map(muscleName).join(', ').toUpperCase() || e.discipline.toUpperCase()}{e.advanced ? ' · AVANZADO' : ''}
        </T>
      </View>
      {tag ? <T style={[mono(9), { color: C.lime }]}>{tag}</T> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <Pressable onPress={() => nav.navigate('ExerciseDetail', { id: e.id })} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Ver detalle de ${e.name}`} style={{ paddingLeft: 6 }}>
        <T style={[mono(15), { color: C.muted }]}>ⓘ</T>
      </Pressable>
    </Pressable>
  );
}

/** Pick an exercise to replace one in the plan, add it to a superset or start a new block. */
export function ExercisePickerScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ExercisePicker'>>();
  const exercises = useStore((s) => s.exercises);
  const experience = useStore((s) => s.profile?.experience);
  const { states } = useDerived();
  const { blocks, ctx, apply } = usePlanEditor();
  const [query, setQuery] = useState('');

  const bi = params.block ?? 0;
  const current = params.mode === 'replace' ? ctx.ex[blocks[bi]?.items[params.index ?? 0]?.exerciseId] : undefined;
  const anchor = params.mode === 'add' ? ctx.ex[blocks[bi]?.items[0]?.exerciseId] : undefined;
  const inPlan = useMemo(() => new Set(blocks.flatMap((b) => b.items.map((i) => i.exerciseId))), [blocks]);
  const pool = useMemo(() => exercises.filter((e) => !e.archived && !inPlan.has(e.id)), [exercises, inPlan]);

  const suggested = useMemo(() => {
    if (current) return alternativesFor(current, exercises, inPlan, 6);
    const ok = pool.filter((e) => !e.advanced || experience === 'avanzado');
    const byNeed = (xs: Exercise[]) => [...xs].sort((a, b) => deficit(states, b) - deficit(states, a));
    if (anchor) return byNeed(ok.filter((e) => isAntagonist(anchor, e))).slice(0, 6);
    return byNeed(ok.filter((e) => e.discipline !== 'Cardio')).slice(0, 6);
  }, [current, anchor, pool, exercises, inPlan, states, experience]);

  const pick = (e: Exercise) => {
    if (params.mode === 'replace') apply((b) => replaceExercise(b, bi, params.index ?? 0, e, ctx));
    else if (params.mode === 'add') apply((b) => addToBlock(b, bi, e, ctx));
    else apply((b) => addBlock(b, e, ctx));
    nav.goBack();
  };

  const results = pool.filter((e) => matchesExercise(e, query));
  const title = params.mode === 'replace' ? 'Cambiar ejercicio' : params.mode === 'add' ? 'Añadir a la superserie' : 'Nuevo bloque';
  const sub = current ? `EN LUGAR DE ${current.name.toUpperCase()}` : anchor ? `JUNTO A ${anchor.name.toUpperCase()}` : 'SE AÑADE AL FINAL DE LA SESIÓN';
  const why = current ? 'MISMO MÚSCULO Y MOVIMIENTO PRIMERO' : anchor ? 'ANTAGONISTAS: SE ALTERNAN SIN COMPETIR' : 'MÚSCULOS QUE MÁS SERIES NECESITAN ESTA SEMANA';

  return (
    <Screen sheet>
      <SheetHeader eyebrow={sub} title={title} onClose={() => nav.goBack()} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.chip, borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
        <T style={[mono(13), { color: C.dim }]}>⌕</T>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar ejercicio o músculo"
          placeholderTextColor={C.dim}
          autoCorrect={false}
          allowFontScaling={false}
          style={[body(15, 500), { flex: 1, color: C.text, padding: 0 }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <T style={[mono(11), { color: C.muted }]}>BORRAR</T>
          </Pressable>
        ) : null}
      </View>

      {!query && suggested.length > 0 && (
        <Card gap={0}>
          <Eyebrow color={C.lime}>RECOMENDADOS</Eyebrow>
          <T style={[mono(9, 500), { color: C.dim, letterSpacing: em(9, 0.06), paddingTop: 4, paddingBottom: 6 }]}>{why}</T>
          {suggested.map((e) => <Row key={e.id} e={e} onPress={() => pick(e)} tag="USAR" />)}
        </Card>
      )}

      {MUSCLE_GROUPS.map((g) => {
        const xs = results.filter((e) => groupOf(e) === g.key).sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (!xs.length) return null;
        return (
          <Card key={g.key} gap={0}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4 }}>
              <T style={[cond(20), { textTransform: 'uppercase' }]}>{g.label}</T>
              <T style={[mono(10), { color: C.muted }]}>{xs.length}</T>
            </View>
            {xs.map((e) => <Row key={e.id} e={e} onPress={() => pick(e)} />)}
          </Card>
        );
      })}
      {results.length === 0 && <T style={[body(13), { color: C.muted }]}>Nada coincide con “{query}”.</T>}
    </Screen>
  );
}
