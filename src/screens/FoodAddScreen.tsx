import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '../components/Screen';
import { fmt } from '../data';
import { today } from '../domain/dates';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, mono } from '../theme';
import { Card, Eyebrow, Field, PrimaryButton, Row, SheetHeader, T, num } from '../ui';

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
