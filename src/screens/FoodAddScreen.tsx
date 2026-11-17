import { useMemo, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { aiReady } from '../ai/api';
import { macrosFor } from '../ai/logic';
import { MacroSummary, MealPicker, PortionPicker } from '../components/Food';
import { Screen } from '../components/Screen';
import { fmt } from '../data';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { dayName, today } from '../domain/dates';
import type { ISODate } from '../domain/types';
import { mealForHour, type Meal } from '../domain/meals';
import { useNav, type RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, mono } from '../theme';
import { Card, Empty, Eyebrow, Field, PrimaryButton, Row, SheetHeader, T, num } from '../ui';

/** Write what you ate and let the AI turn it into editable foods (same review as the photo scan). */
function AiTextCard({ meal, date }: { meal: Meal; date: ISODate }) {
  const nav = useNav();
  const link = useStore((s) => s.settings.watch);
  const [text, setText] = useState('');
  const ok = text.trim().length >= 3;
  const go = () => {
    if (!ok) return;
    if (!aiReady(link)) {
      Alert.alert('IA no disponible', 'Configura el servidor en Hoy → Bip 6 → Reloj.');
      return;
    }
    nav.replace('FoodScan', { kind: 'plato', text: text.trim(), meal, date });
  };
  return (
    <Card gap={10}>
      <Eyebrow>ESCRIBE LO QUE COMISTE · LA IA LO COMPLETA</Eyebrow>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="200 g de pollo a la plancha con arroz y una cucharada de aceite"
        placeholderTextColor={C.dim}
        multiline
        maxLength={500}
        allowFontScaling={false}
        style={[body(15, 500, 1.35), { color: C.text, backgroundColor: C.chip, borderRadius: 12, padding: 12, minHeight: 72, textAlignVertical: 'top' }]}
      />
      <PrimaryButton label="✦ Completar con IA" onPress={go} disabled={!ok} height={44} />
    </Card>
  );
}

function PantrySection({ meal, date }: { meal: Meal; date: ISODate }) {
  const nav = useNav();
  const pantry = useStore((s) => s.pantry);
  const addFood = useStore((s) => s.addFood);
  const removePantry = useStore((s) => s.removePantry);
  const [openId, setOpenId] = useState<string | null>(null);
  const [grams, setGrams] = useState('');

  const open = (id: string) => {
    setOpenId(openId === id ? null : id);
    setGrams('100');
  };

  return (
    <Card gap={0}>
      <Eyebrow style={{ paddingBottom: 4 }}>DESPENSA</Eyebrow>
      {pantry.length === 0 ? <Empty text="Escanea una etiqueta o un ticket en Nutrición para guardar productos por 100 g." /> : null}
      {pantry.map((item) => {
        const on = openId === item.id;
        const g = num(grams) ?? 0;
        const m = on && g > 0 ? macrosFor(item.per100, g) : null;
        return (
          <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 10, gap: 10 }}>
            <Pressable
              onPress={() => open(item.id)}
              onLongPress={() => Alert.alert('Quitar de la despensa', item.name, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Quitar', style: 'destructive', onPress: () => removePantry(item.id) },
              ])}
              accessibilityHint="Mantén pulsado para quitarlo"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={body(14, 600)} lines={1}>{item.name}</T>
                  <T style={[mono(11, 500), { color: C.muted }]}>100 g · {fmt(item.per100.kcal)} kcal · P{fmt(item.per100.p, 1)} C{fmt(item.per100.c, 1)} G{fmt(item.per100.f, 1)}</T>
                </View>
                <T style={[mono(11), { color: C.lime }]}>{on ? 'CERRAR' : 'USAR'}</T>
              </Row>
            </Pressable>
            {on ? (
              <View style={{ gap: 10 }}>
                <PortionPicker grams={grams} base={100} onChange={setGrams} />
                <MacroSummary kcal={m?.kcal ?? 0} p={m?.p ?? 0} c={m?.c ?? 0} f={m?.f ?? 0} />
                <PrimaryButton label="Añadir" disabled={!m} onPress={() => {
                  if (!m) return;
                  addFood({ date, meal, name: item.name, grams: g, ...m });
                  nav.goBack();
                }} />
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

/** "Añadir a hoy", "Añadir a ayer"… or "Añadir al jue 12 nov". */
export const addLabel = (when: string) => `Añadir ${['HOY', 'AYER', 'MAÑANA'].includes(when) ? 'a' : 'al'} ${when.toLowerCase()}`;

/** Makes it obvious the food goes to another day, not today. */
export function DayNotice({ when }: { when: string }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.amber, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
      <T style={[mono(11, 600), { color: C.amber }]}>SE AÑADE A {when}, NO A HOY</T>
    </View>
  );
}

export function FoodAddScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'FoodAdd'>>();
  const [meal, setMeal] = useState<Meal>(() => params?.meal ?? mealForHour(new Date().getHours()));
  const date = params?.date ?? today();
  const when = dayName(date, today());
  const foods = useStore((s) => s.foods);
  const addFood = useStore((s) => s.addFood);
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');

  // Recent distinct foods, most recent first, for one-tap re-logging.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return [...foods].reverse().filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true))).slice(0, 8);
  }, [foods]);

  const kcal = Math.round((num(p) ?? 0) * 4 + (num(c) ?? 0) * 4 + (num(f) ?? 0) * 9);
  const valid = name.trim().length > 0 && kcal > 0;

  const save = () => {
    if (!valid) return;
    addFood({ date, meal, name: name.trim(), grams: num(grams) ?? 0, p: num(p) ?? 0, c: num(c) ?? 0, f: num(f) ?? 0, kcal });
    nav.goBack();
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow={`NUTRICIÓN · ${when}`} title="Añadir alimento" onClose={() => nav.goBack()} />
      <MealPicker value={meal} onChange={setMeal} />
      {when !== 'HOY' ? <DayNotice when={when} /> : null}
      <AiTextCard meal={meal} date={date} />
      <PantrySection meal={meal} date={date} />
      {recent.length > 0 && (
        <Card gap={0}>
          <Eyebrow style={{ paddingBottom: 4 }}>RECIENTES · TOCA PARA AÑADIR</Eyebrow>
          {recent.map((x, i) => (
            <Pressable
              key={x.id}
              onPress={() => { addFood({ date, meal, name: x.name, grams: x.grams, p: x.p, c: x.c, f: x.f, kcal: x.kcal }); nav.goBack(); }}
              style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, opacity: pressed ? 0.7 : 1 })}
            >
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={body(14, 600)} lines={1}>{x.name}</T>
                  <T style={[mono(11, 500), { color: C.muted }]}>{fmt(x.grams)} g · P{x.p} C{x.c} G{x.f}</T>
                </View>
                <T style={cond(18)}>{fmt(x.kcal)}</T>
              </Row>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <Field label="ALIMENTO" value={name} onChange={setName} keyboard="default" placeholder="Pechuga de pollo con arroz" />
        <Field label="CANTIDAD" value={grams} onChange={setGrams} suffix="G" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="PROTEÍNA" value={p} onChange={setP} suffix="G" />
          <Field flex label="CARBOS" value={c} onChange={setC} suffix="G" />
          <Field flex label="GRASA" value={f} onChange={setF} suffix="G" />
        </View>
        <Row style={{ alignItems: 'baseline', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
          <T style={[mono(11), { color: C.muted }]}>TOTAL</T>
          <T style={cond(26)}>{fmt(kcal)} KCAL</T>
        </Row>
      </Card>
      <PrimaryButton label={addLabel(when)} onPress={save} disabled={!valid} />
    </Screen>
  );
}
