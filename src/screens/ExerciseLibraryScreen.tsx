import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { TAG_COLORS } from '../data';
import { DISCIPLINES, groupOf, LOAD_MODE_LABEL, MUSCLE_GROUPS, PATTERN_LABEL, type MuscleGroup } from '../domain/catalog';
import { muscleName, type MuscleKey } from '../domain/muscles';
import { matchesExercise } from '../domain/search';
import type { Discipline, Exercise } from '../domain/types';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, em, mono } from '../theme';
import { ChipSelect, GhostButton, PrimaryButton, Row, SheetHeader, T } from '../ui';

type DisciplineFilter = Discipline | 'Todas';
type GroupFilter = MuscleGroup | 'todos';

function ExerciseRow({ e, first, onPress }: { e: Exercise; first: boolean; onPress: () => void }) {
  const color = TAG_COLORS[e.discipline];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}>
      <Row style={{ alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T style={body(15, 600)}>{e.name}</T>
          <T style={[mono(10, 500), { color: C.muted }]}>
            {PATTERN_LABEL[e.pattern].toUpperCase()}{e.plane ? ` ${e.plane.toUpperCase()}` : ''} · {LOAD_MODE_LABEL[e.loadMode].toUpperCase()}
            {e.levers ? ` · ${e.levers.length} NIVELES` : ''}{e.advanced ? ' · AVANZADO' : ''}
          </T>
          {e.secondary.length > 0 && <T style={[body(12, 400), { color: C.dim }]}>También: {e.secondary.map(muscleName).join(', ').toLowerCase()}</T>}
        </View>
        <View style={{ paddingVertical: 5, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1, borderColor: color }}>
          <T style={[mono(10), { color }]}>{e.discipline.toUpperCase()}</T>
        </View>
      </Row>
    </Pressable>
  );
}

export function ExerciseLibraryScreen() {
  const nav = useNav();
  const exercises = useStore((s) => s.exercises);
  const [group, setGroup] = useState<GroupFilter>('todos');
  const [discipline, setDiscipline] = useState<DisciplineFilter>('Todas');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(
    () => exercises.filter((e) => !!e.archived === showArchived && (discipline === 'Todas' || e.discipline === discipline) && matchesExercise(e, query)),
    [exercises, showArchived, discipline, query],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of visible) c[groupOf(e)] = (c[groupOf(e)] ?? 0) + 1;
    return c;
  }, [visible]);
  const sections = MUSCLE_GROUPS.filter((g) => (group === 'todos' || g.key === group) && counts[g.key]);

  return (
    <Screen sheet>
      <SheetHeader eyebrow={`ENTRENO · ${exercises.filter((e) => !e.archived).length} EJERCICIOS`} title="Biblioteca" onClose={() => nav.goBack()} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.chip, borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
        <T style={[mono(13), { color: C.dim }]}>⌕</T>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar ejercicio o músculo"
          placeholderTextColor={C.dim}
          autoCorrect={false}
          returnKeyType="search"
          allowFontScaling={false}
          style={[body(15, 500), { flex: 1, color: C.text, padding: 0 }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
            <T style={[mono(11), { color: C.muted }]}>BORRAR</T>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {([{ key: 'todos', label: 'Todos' }, ...MUSCLE_GROUPS] as { key: GroupFilter; label: string }[]).map((g) => {
          const on = group === g.key;
          const n = g.key === 'todos' ? visible.length : counts[g.key] ?? 0;
          return (
            <Pressable
              key={g.key}
              onPress={() => setGroup(g.key)}
              accessibilityState={{ selected: on }}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: on ? C.lime : C.border, backgroundColor: on ? C.lime : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <T style={[cond(16, 700), { color: on ? C.bg : C.soft, textTransform: 'uppercase' }]}>{g.label}</T>
              <T style={[mono(10), { color: on ? C.bg : C.dim }]}>{n}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ChipSelect
        options={[{ value: 'Todas' as DisciplineFilter, label: 'Todas' }, ...DISCIPLINES.map((d) => ({ value: d as DisciplineFilter, label: d }))]}
        selected={[discipline]}
        onToggle={setDiscipline}
      />

      <PrimaryButton label="Nuevo ejercicio" onPress={() => nav.navigate('ExerciseEdit', {})} height={46} />

      {sections.length === 0 && (
        <T style={[body(13, 400, 1.4), { color: C.muted, paddingVertical: 8 }]}>
          {query ? `Nada coincide con “${query}”.` : 'Sin ejercicios en esta vista.'}
        </T>
      )}

      {sections.map((g) => {
        const inGroup = visible.filter((e) => groupOf(e) === g.key);
        // Sub-sections by primary muscle, in anatomical order; cardio has none.
        const subs: [MuscleKey | null, Exercise[]][] = g.muscles.length
          ? (g.muscles as readonly MuscleKey[]).map((m): [MuscleKey, Exercise[]] => [m, inGroup.filter((e) => e.primary[0] === m)]).filter(([, xs]) => xs.length)
          : [[null, inGroup]];
        return (
          <View key={g.key} style={{ gap: 8, paddingTop: 6 }}>
            <Row style={{ alignItems: 'baseline' }}>
              <T style={[cond(28), { textTransform: 'uppercase' }]}>{g.label}</T>
              <T style={[mono(11), { color: C.muted }]}>{inGroup.length} EJERCICIOS</T>
            </Row>
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
              {subs.map(([m, xs], si) => (
                <View key={m ?? 'all'} style={{ paddingTop: si ? 10 : 6, borderTopWidth: si ? 1 : 0, borderTopColor: C.border }}>
                  {m && subs.length > 0 && g.muscles.length > 1 ? (
                    <T style={[mono(10), { color: C.lime, letterSpacing: em(10, 0.12), paddingBottom: 2 }]}>{muscleName(m).toUpperCase()} · {xs.length}</T>
                  ) : null}
                  {xs.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((e, i) => (
                    <ExerciseRow key={e.id} e={e} first={i === 0} onPress={() => nav.navigate('ExerciseDetail', { id: e.id })} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <GhostButton label={showArchived ? 'VER ACTIVOS' : 'VER ARCHIVADOS'} onPress={() => setShowArchived((v) => !v)} />
      <T style={[mono(10, 500, 1.4), { color: C.dim, textAlign: 'center' }]}>
        CADA EJERCICIO APARECE EN EL GRUPO DE SU MÚSCULO PRINCIPAL. EL GENERADOR ELIGE ENTRE LOS ACTIVOS SEGÚN PATRÓN Y DÉFICIT DE VOLUMEN.
      </T>
    </Screen>
  );
}
