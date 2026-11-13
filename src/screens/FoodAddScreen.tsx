import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { macrosFor } from '../ai/logic';
import { Screen } from '../components/Screen';
import { fmt } from '../data';
import { today } from '../domain/dates';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, mono } from '../theme';
import { Card, Empty, Eyebrow, Field, PrimaryButton, Row, SheetHeader, T, num } from '../ui';

function PantrySection() {
  const nav = useNav();
  const pantry = useStore((s) => s.pantry);
  const addFood = useStore((s) => s.addFood);
  const removePantry = useStore((s) => s.removePantry);
  const [openId, setOpenId] = useState<string | null>(null);
  const [grams, setGrams] = useState('');

  const open = (id: string) => {
    setOpenId(openId === id ? null : id);
    setGrams('');
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
                <Field label="GRAMOS" value={grams} onChange={setGrams} suffix="G" />
                {m ? <T style={[mono(11, 500), { color: C.soft }]}>{fmt(m.kcal)} kcal · P{fmt(m.p, 1)} C{fmt(m.c, 1)} G{fmt(m.f, 1)}</T> : null}
                <PrimaryButton label="Añadir" disabled={!m} onPress={() => {
                  if (!m) return;
                  addFood({ date: today(), name: item.name, grams: g, ...m });
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

export function FoodAddScreen() {
  const nav = useNav();
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
    addFood({ date: today(), name: name.trim(), grams: num(grams) ?? 0, p: num(p) ?? 0, c: num(c) ?? 0, f: num(f) ?? 0, kcal });
    nav.goBack();
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow="NUTRICIÓN · REGISTRO" title="Añadir alimento" onClose={() => nav.goBack()} />
      <PantrySection />
      {recent.length > 0 && (
        <Card gap={0}>
          <Eyebrow style={{ paddingBottom: 4 }}>RECIENTES · TOCA PARA AÑADIR</Eyebrow>
          {recent.map((x, i) => (
            <Pressable
              key={x.id}
              onPress={() => { addFood({ date: today(), name: x.name, grams: x.grams, p: x.p, c: x.c, f: x.f, kcal: x.kcal }); nav.goBack(); }}
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
      <PrimaryButton label="Añadir a hoy" onPress={save} disabled={!valid} />
    </Screen>
  );
}
