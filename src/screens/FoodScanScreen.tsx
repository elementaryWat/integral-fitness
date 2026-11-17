import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AiRequestError, foodFromText, scanFood, type Macros100, type ScanItem, type ScanKind } from '../ai/api';
import { macrosFor } from '../ai/logic';
import { MacroSummary, MealPicker, PortionPicker } from '../components/Food';
import { Screen } from '../components/Screen';
import { fmt } from '../data';
import { dayName, today } from '../domain/dates';
import { addLabel, DayNotice } from './FoodAddScreen';
import { mealForHour, type Meal } from '../domain/meals';
import type { RootStackParamList } from '../navigation';
import { pickImageForAi } from '../photos';
import { useStore } from '../store';
import { C, body, cond, mono } from '../theme';
import { Card, Eyebrow, Field, GhostButton, LinkButton, PrimaryButton, Row, SheetHeader, T, num } from '../ui';

const KIND_TITLE: Record<ScanKind, string> = {
  plato: 'Escanear plato',
  etiqueta: 'Escanear etiqueta',
  ticket: 'Escanear ticket',
};

interface DraftItem {
  name: string;
  grams: string;
  kcal: string;
  p: string;
  c: string;
  f: string;
  per100: Macros100 | null;
  confidence: ScanItem['confidence'];
  /** Portion the scan detected, for the ½ · 1 · 1½ · 2 presets. */
  base: number;
  editing: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const toDraft = (it: ScanItem): DraftItem => {
  const d: DraftItem = {
    name: it.name,
    grams: String(it.grams),
    kcal: String(it.kcal),
    p: String(it.p),
    c: String(it.c),
    f: String(it.f),
    per100: it.per100,
    confidence: it.confidence,
    base: it.grams,
    editing: false,
  };
  // Without per-100 g values the portion could not be rescaled; derive them from what was detected.
  return { ...d, per100: per100FromPortion(d) };
};

/** Per-100 g values from the portion the user is looking at, when the scan had none. */
function per100FromPortion(it: DraftItem): Macros100 | null {
  if (it.per100) return it.per100;
  const g = num(it.grams) ?? 0;
  if (g <= 0) return null;
  const k = 100 / g;
  return { kcal: Math.round((num(it.kcal) ?? 0) * k), p: r1((num(it.p) ?? 0) * k), c: r1((num(it.c) ?? 0) * k), f: r1((num(it.f) ?? 0) * k) };
}

const CONFIDENCE = { alta: C.lime, media: C.amber, baja: C.coral } as const;

export function FoodScanScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'FoodScan'>) {
  const kind = route.params.kind;
  const written = route.params.text?.trim();
  const date = route.params.date ?? today();
  const when = dayName(date, today());
  const addFood = useStore((s) => s.addFood);
  const addPantry = useStore((s) => s.addPantry);
  const [uri, setUri] = useState<string>();
  const [dataUrl, setDataUrl] = useState<string>();
  const [phase, setPhase] = useState<'picking' | 'scanning' | 'ready' | 'error'>(written ? 'scanning' : 'picking');
  const [error, setError] = useState('');
  const [title, setTitle] = useState(written ? 'Comida escrita' : KIND_TITLE[kind]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [meal, setMeal] = useState<Meal>(() => route.params.meal ?? mealForHour(new Date().getHours()));
  const started = useRef(false);
  const savingRef = useRef(false);

  /** Image scan, or a written description when `text` is given (same editable result). */
  const runScan = useCallback(async (image: string) => {
    setPhase('scanning');
    setError('');
    try {
      const link = useStore.getState().settings.watch;
      const scan = written ? await foodFromText(link, written) : await scanFood(link, image, kind);
      setItems(scan.items.map(toDraft));
      setChecked(scan.items.map(() => true));
      setTitle(scan.title.trim() || KIND_TITLE[kind]);
      setNotes(scan.notes.trim());
      setPhase('ready');
    } catch (e) {
      setError(e instanceof AiRequestError ? e.message : written ? 'No se pudo completar con IA.' : 'No se pudo analizar la imagen.');
      setPhase('error');
    }
  }, [kind, written]);

  const runScanRef = useRef(runScan);
  runScanRef.current = runScan;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let live = true;
    if (written) {
      runScanRef.current('');
      return;
    }
    (async () => {
      const img = await pickImageForAi(KIND_TITLE[kind]);
      if (!live) return;
      if (!img) {
        navigation.goBack();
        return;
      }
      setUri(img.uri);
      setDataUrl(img.dataUrl);
      await runScanRef.current(img.dataUrl);
    })();
    return () => { live = false; };
  }, [kind, navigation, written]);

  const changeGrams = (i: number, text: string) => {
    setItems((list) => list.map((it, j) => {
      if (j !== i) return it;
      if (!it.per100) return { ...it, grams: text };
      const m = macrosFor(it.per100, num(text) ?? 0);
      return { ...it, grams: text, kcal: String(m.kcal), p: String(m.p), c: String(m.c), f: String(m.f) };
    }));
  };

  const changeField = (i: number, key: 'name' | 'kcal' | 'p' | 'c' | 'f', text: string) => {
    setItems((list) => list.map((it, j) => {
      if (j !== i) return it;
      const next = { ...it, [key]: text };
      if (key === 'name') return next;
      const g = num(next.grams) ?? 0;
      return g > 0 ? { ...next, per100: per100FromPortion({ ...next, per100: null }) } : { ...next, per100: null };
    }));
  };

  const foods = items
    .map((it) => ({ name: it.name.trim(), grams: num(it.grams) ?? 0, p: num(it.p) ?? 0, c: num(it.c) ?? 0, f: num(it.f) ?? 0, kcal: num(it.kcal) ?? 0 }))
    .filter((it) => it.name && it.kcal > 0);

  const pantryOf = (list: DraftItem[]) => list.flatMap((it) => {
    const per100g = per100FromPortion(it);
    const name = it.name.trim();
    return name && per100g ? [{ name, per100: per100g }] : [];
  });

  const selected = kind === 'ticket' ? items.filter((_, i) => checked[i]) : items;
  const pantry = pantryOf(selected);

  const addToday = () => {
    if (!foods.length || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    for (const f of foods) addFood({ date, meal, ...f });
    navigation.goBack();
  };

  const savePantry = () => {
    if (!pantry.length || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    addPantry(pantry);
    navigation.goBack();
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow={`NUTRICIÓN · ${written ? 'TEXTO CON IA' : kind.toUpperCase()}`} title={title} onClose={() => navigation.goBack()} />
      {uri ? (
        <Image source={{ uri }} style={{ height: 180, borderRadius: 14, backgroundColor: C.chip }} resizeMode="cover" accessibilityLabel="Foto escaneada" />
      ) : null}
      {written ? <T style={[body(13, 400, 1.4), { color: C.muted, marginTop: -6 }]}>«{written}»</T> : null}
      {phase === 'picking' || phase === 'scanning' ? (
        <Card>
          <T style={[cond(22), { textTransform: 'uppercase' }]}>{phase === 'picking' ? 'Elige una foto' : 'Analizando…'}</T>
          <T style={[body(13, 400, 1.4), { color: C.muted }]}>
            {phase === 'picking' ? 'Cámara o carrete. Puedes cancelar y volver.' : written ? 'Calculando alimentos y macros de lo que escribiste.' : 'Leyendo alimentos y macros. Puede tardar un momento.'}
          </T>
        </Card>
      ) : null}
      {phase === 'error' ? (
        <Card>
          <T style={[body(14, 500, 1.4), { color: C.coral }]}>{error}</T>
          <PrimaryButton label="Reintentar" onPress={() => (written ? runScan('') : dataUrl && runScan(dataUrl))} disabled={!written && !dataUrl} />
        </Card>
      ) : null}
      {phase === 'ready' && (
        <>
          {kind === 'ticket' ? <T style={[mono(10, 500, 1.4), { color: C.dim }]}>MARCA LOS PRODUCTOS QUE QUIERES GUARDAR EN LA DESPENSA.</T> : null}
          {notes ? <T style={[body(13, 400, 1.4), { color: C.soft }]}>{notes}</T> : null}
          {items.length === 0 ? <Card><T style={[body(14, 400, 1.4), { color: C.muted }]}>No se reconocieron alimentos. Prueba con otra foto.</T></Card> : null}
          {items.map((it, i) => (
            <Card key={`${i}-${it.confidence}`}>
              {kind === 'ticket' ? (
                <Pressable
                  onPress={() => setChecked((xs) => xs.map((on, j) => (j === i ? !on : on)))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!checked[i] }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: checked[i] ? C.lime : 'transparent', borderWidth: checked[i] ? 0 : 1.5, borderColor: '#4c504a', alignItems: 'center', justifyContent: 'center' }}>
                    {checked[i] ? <T style={[body(14, 700), { color: C.bg }]}>✓</T> : null}
                  </View>
                  <T style={[mono(11), { color: C.soft }]}>{checked[i] ? 'SE GUARDA' : 'NO SE GUARDA'}</T>
                </Pressable>
              ) : null}
              <Field label="ALIMENTO" value={it.name} onChange={(v) => changeField(i, 'name', v)} keyboard="default" />
              <PortionPicker grams={it.grams} base={it.base} onChange={(v) => changeGrams(i, v)} />
              <MacroSummary kcal={num(it.kcal) ?? 0} p={num(it.p) ?? 0} c={num(it.c) ?? 0} f={num(it.f) ?? 0} />
              {it.editing ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Field flex label="PROT." value={it.p} onChange={(v) => changeField(i, 'p', v)} suffix="G" />
                    <Field flex label="CARB." value={it.c} onChange={(v) => changeField(i, 'c', v)} suffix="G" />
                    <Field flex label="GRASA" value={it.f} onChange={(v) => changeField(i, 'f', v)} suffix="G" />
                  </View>
                  <Field label="KCAL" value={it.kcal} onChange={(v) => changeField(i, 'kcal', v)} />
                </>
              ) : null}
              <Row>
                <Eyebrow color={CONFIDENCE[it.confidence]}>CONFIANZA {it.confidence.toUpperCase()}</Eyebrow>
                <LinkButton label={it.editing ? 'LISTO' : 'CORREGIR MACROS'} color={C.soft} onPress={() => setItems((list) => list.map((x, j) => (j === i ? { ...x, editing: !x.editing } : x)))} />
              </Row>
              {it.per100 ? <T style={[mono(10, 500), { color: C.dim }]}>POR 100 G: {fmt(it.per100.kcal)} KCAL · P{fmt(it.per100.p, 1)} C{fmt(it.per100.c, 1)} G{fmt(it.per100.f, 1)}</T> : null}
            </Card>
          ))}
          {kind !== 'ticket' && foods.length > 0 ? <MealPicker value={meal} onChange={setMeal} /> : null}
          {kind !== 'ticket' && when !== 'HOY' ? <DayNotice when={when} /> : null}
          {kind !== 'ticket' ? <PrimaryButton label={addLabel(when)} onPress={addToday} disabled={!foods.length || saving} /> : null}
          {kind === 'etiqueta' ? <GhostButton label="GUARDAR EN DESPENSA" onPress={savePantry} /> : null}
          {kind === 'ticket' ? <PrimaryButton label="Guardar en despensa" onPress={savePantry} disabled={!pantry.length || saving} /> : null}
        </>
      )}
    </Screen>
  );
}
