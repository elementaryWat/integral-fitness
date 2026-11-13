import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { DISCIPLINES, LOAD_MODE_LABEL, PATTERN_LABEL } from '../domain/catalog';
import { uid } from '../domain/dates';
import { MUSCLE_KEYS, muscleName, type MuscleKey } from '../domain/muscles';
import type { Discipline, Exercise, LoadMode, Pattern, Plane, Region, Unit } from '../domain/types';
import type { RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { C, body, mono } from '../theme';
import { Card, ChipSelect, Field, GhostButton, PrimaryButton, SheetHeader, T, num } from '../ui';

const PATTERNS = Object.keys(PATTERN_LABEL) as Pattern[];
const LOAD_MODES = Object.keys(LOAD_MODE_LABEL) as LoadMode[];
const UNITS: { value: Unit; label: string }[] = [{ value: 'reps', label: 'Reps' }, { value: 's', label: 'Segundos' }, { value: 'min', label: 'Minutos' }];
const MUSCLES = MUSCLE_KEYS.map((k) => ({ value: k, label: muscleName(k) }));

const regionFor = (p: Pattern): Region => (p === 'pierna' || p === 'bisagra' || p === 'aerobico' ? 'inferior' : p === 'core' ? 'core' : 'superior');

export function ExerciseEditScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ExerciseEdit'>) {
  const existing = useStore((s) => s.exercises.find((e) => e.id === route.params?.id));
  const upsert = useStore((s) => s.upsertExercise);
  const setArchived = useStore((s) => s.setArchived);

  const [name, setName] = useState(existing?.name ?? '');
  const [discipline, setDiscipline] = useState<Discipline>(existing?.discipline ?? 'Pesas');
  const [loadMode, setLoadMode] = useState<LoadMode>(existing?.loadMode ?? 'peso');
  const [pattern, setPattern] = useState<Pattern>(existing?.pattern ?? 'empuje');
  const [plane, setPlane] = useState<Plane | undefined>(existing?.plane ?? 'horizontal');
  const [unit, setUnit] = useState<Unit>(existing?.unit ?? 'reps');
  const [primary, setPrimary] = useState<MuscleKey[]>(existing?.primary ?? []);
  const [secondary, setSecondary] = useState<MuscleKey[]>(existing?.secondary ?? []);
  const [step, setStep] = useState(String(existing?.step ?? 2.5));
  const [load, setLoad] = useState(String(existing?.defaultLoad ?? 20));
  const [reps, setReps] = useState(String(existing?.defaultReps ?? 10));
  const [lo, setLo] = useState(String(existing?.repRange[0] ?? 8));
  const [hi, setHi] = useState(String(existing?.repRange[1] ?? 12));
  const [levers, setLevers] = useState(existing?.levers?.join(', ') ?? '');

  const usesPlane = pattern === 'empuje' || pattern === 'traccion';
  const loadable = loadMode === 'peso' || loadMode === 'lastre';
  const toggle = (list: MuscleKey[], set: (v: MuscleKey[]) => void, k: MuscleKey) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const valid = name.trim().length > 1 && (pattern === 'aerobico' || primary.length > 0) && !!num(reps) && !!num(lo) && !!num(hi);

  const save = () => {
    if (!valid) return;
    const leverList = levers.split(',').map((x) => x.trim()).filter(Boolean);
    const e: Exercise = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      discipline, loadMode, pattern, unit,
      plane: usesPlane ? plane ?? 'horizontal' : undefined,
      region: regionFor(pattern),
      primary, secondary: secondary.filter((m) => !primary.includes(m)),
      step: loadMode === 'palanca' ? 1 : loadable ? num(step) ?? 0 : 0,
      defaultLoad: loadMode === 'palanca' ? 0 : loadable ? num(load) ?? 0 : 0,
      defaultReps: num(reps)!,
      repRange: [num(lo)!, num(hi)!],
      levers: loadMode === 'palanca' ? (leverList.length ? leverList : ['Nivel 1', 'Nivel 2', 'Nivel 3']) : undefined,
      legImpact: discipline === 'Cardio' ? 'bajo' : undefined,
      archived: existing?.archived,
      custom: existing ? existing.custom : true,
    };
    upsert(e);
    navigation.goBack();
  };

  const archive = () => {
    if (!existing) return;
    Alert.alert(existing.archived ? 'Restaurar ejercicio' : 'Archivar ejercicio', existing.archived ? 'Volverá a estar disponible para el generador.' : 'No se usará en nuevas sesiones; el historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: existing.archived ? 'Restaurar' : 'Archivar', onPress: () => { setArchived(existing.id, !existing.archived); navigation.goBack(); } },
    ]);
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow={existing ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'} title={name.trim() || 'Ejercicio'} onClose={() => navigation.goBack()} />
      <Card>
        <Field label="NOMBRE" value={name} onChange={setName} keyboard="default" placeholder="Remo con mancuerna" />
        <ChipSelect label="DISCIPLINA" options={DISCIPLINES.map((d) => ({ value: d, label: d }))} selected={[discipline]} onToggle={setDiscipline} />
        <ChipSelect label="PATRÓN" options={PATTERNS.map((p) => ({ value: p, label: PATTERN_LABEL[p] }))} selected={[pattern]} onToggle={setPattern} />
        {usesPlane && <ChipSelect label="PLANO (PARA SUPERSERIES ANTAGONISTAS)" options={[{ value: 'horizontal' as Plane, label: 'Horizontal' }, { value: 'vertical' as Plane, label: 'Vertical' }]} selected={plane ? [plane] : []} onToggle={setPlane} />}
      </Card>

      <Card>
        <ChipSelect label="MODO DE CARGA" options={LOAD_MODES.map((m) => ({ value: m, label: LOAD_MODE_LABEL[m] }))} selected={[loadMode]} onToggle={setLoadMode} />
        <ChipSelect label="UNIDAD" options={UNITS} selected={[unit]} onToggle={setUnit} />
        {loadable && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field flex label={loadMode === 'lastre' ? 'LASTRE INICIAL' : 'CARGA INICIAL'} value={load} onChange={setLoad} suffix="KG" />
            <Field flex label="INCREMENTO" value={step} onChange={setStep} suffix="KG" />
          </View>
        )}
        {loadMode === 'palanca' && <Field label="PROGRESIONES (DE FÁCIL A DIFÍCIL, SEPARADAS POR COMAS)" value={levers} onChange={setLevers} keyboard="default" placeholder="Tuck, Una pierna, Completo" />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="OBJETIVO" value={reps} onChange={setReps} keyboard="number-pad" suffix={unit.toUpperCase()} />
          <Field flex label="RANGO MÍN." value={lo} onChange={setLo} keyboard="number-pad" />
          <Field flex label="RANGO MÁX." value={hi} onChange={setHi} keyboard="number-pad" />
        </View>
      </Card>

      {pattern !== 'aerobico' && (
        <Card>
          <ChipSelect label="MÚSCULOS PRINCIPALES (1 SERIE)" options={MUSCLES} selected={primary} onToggle={(k) => toggle(primary, setPrimary, k)} />
          <ChipSelect label="SECUNDARIOS (0,5 SERIES)" options={MUSCLES.filter((m) => !primary.includes(m.value))} selected={secondary} onToggle={(k) => toggle(secondary, setSecondary, k)} color={C.cyan} />
        </Card>
      )}

      <T style={[mono(10, 500, 1.4), { color: C.dim }]}>ASISTENTE IA PARA CLASIFICAR EJERCICIOS · PRÓXIMAMENTE (FASE 2)</T>
      <PrimaryButton label="Guardar" onPress={save} disabled={!valid} />
      {existing && <GhostButton label={existing.archived ? 'RESTAURAR' : 'ARCHIVAR'} onPress={archive} color={existing.archived ? C.lime : C.coral} />}
      {!valid && <T style={[body(12, 400), { color: C.muted, textAlign: 'center' }]}>Necesita nombre, al menos un músculo principal y rango de repeticiones.</T>}
    </Screen>
  );
}
