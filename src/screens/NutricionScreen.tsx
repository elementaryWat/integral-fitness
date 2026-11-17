import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Hatch } from '../components/charts';
import { Screen } from '../components/Screen';
import { fmt, fmtSigned } from '../data';
import { addDays, dayLetter, dayName, parseISO, shortDay, startOfWeek } from '../domain/dates';
import { groupByMeal, MEALS, mealLabel } from '../domain/meals';
import type { DayType, ISODate } from '../domain/types';
import { aiReady, type ScanKind } from '../ai/api';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, LinkButton, Row, ScreenHeader, SectionTitle, Segmented, T, actions } from '../ui';

const DAY_TYPES: DayType[] = ['Pesado', 'Moderado', 'Descanso'];

function TdeeCard({ day }: { day: ISODate }) {
  const { today, energyOn, profile } = useDerived();
  const coach = useStore((s) => s.coach);
  const e = energyOn(day);
  const r = coach.lastRecalibration;
  const offset = e.target - (e.tdee - profile.deficitKcal);
  return (
    <Card>
      <Eyebrow>TDEE DINÁMICO · {dayName(day, today)}</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T style={cond(64, 900)}>{fmt(e.tdee)}</T>
        <T style={[mono(12), { color: C.muted }]}>KCAL</T>
      </View>
      <View style={{ flexDirection: 'row', height: 12, gap: 3 }}>
        <View style={{ width: `${(e.bmr / e.tdee) * 100}%`, backgroundColor: '#3a3d39', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
        <View style={{ width: `${(e.neat / e.tdee) * 100}%`, backgroundColor: C.cyan }} />
        <View style={{ flex: 1, backgroundColor: C.lime, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['Basal', fmt(e.bmr), C.text], ['NEAT (reloj)', fmt(e.neat), C.cyan], ['Entreno', fmt(e.train), C.lime]] as const).map(([k, v, c]) => (
          <View key={k} style={{ flex: 1, gap: 3 }}>
            <T style={[body(11), { color: C.muted }]}>{k}</T>
            <T style={[cond(18, 700), { color: c }]}>{v}</T>
          </View>
        ))}
      </View>
      <Row style={{ alignItems: 'baseline', paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
        <T style={body(14, 600)}>Objetivo de ingesta</T>
        <T style={cond(26)}>
          {fmt(e.target)} <T style={[mono(11), { color: C.muted }]}>{profile.deficitKcal ? fmtSigned(-profile.deficitKcal) : ''}{offset ? ` ${offset > 0 ? '+' : '−'}${Math.abs(offset)}` : ''}</T>
        </T>
      </Row>
      <T style={[body(12, 400, 1.4), { color: C.muted }]}>
        El TDEE es lo que gastas ese día. El objetivo es lo que te toca comer: el TDEE menos el déficit de tu objetivo{offset ? ', con el ajuste del coach' : ''}.
      </T>
      <T style={[mono(11, 500, 1.4), { color: C.muted }]}>
        {r
          ? `Recalibrado ${shortDay(r.date).toLowerCase()}: ${fmtSigned(r.delta)} kcal. Peso ${fmt(r.observedKgWk, 2)} kg/sem frente a ${fmt(r.expectedKgWk, 2)} previsto.`
          : 'La recalibración semanal necesita 8 pesajes y 7 días de comidas registradas en 2 semanas.'}
      </T>
    </Card>
  );
}

function MacrosCard({ day }: { day: ISODate }) {
  const nav = useNav();
  const { today, energyOn, macrosOn } = useDerived();
  const foods = useStore((s) => s.foods);
  const removeFood = useStore((s) => s.removeFood);
  const updateFood = useStore((s) => s.updateFood);
  const addFood = useStore((s) => s.addFood);
  const todays = foods.filter((f) => f.date === day);
  const when = dayName(day, today);
  const cons = todays.reduce((a, f) => ({ p: a.p + f.p, c: a.c + f.c, f: a.f + f.f, kcal: a.kcal + f.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  const tgt = macrosOn(day);
  const left = energyOn(day).target - cons.kcal;
  return (
    <Card gap={14}>
      <Row>
        <Eyebrow>MACROS · {when}</Eyebrow>
        <T style={[mono(11), { color: left >= 0 ? C.lime : C.coral }]}>{fmt(Math.abs(left))} KCAL {left >= 0 ? 'RESTANTES' : 'DE MÁS'}</T>
      </Row>
      {([['Proteína', 'p', C.lime], ['Carbohidratos', 'c', C.cyan], ['Grasas', 'f', C.amber]] as const).map(([n, k, color]) => (
        <View key={k} style={{ gap: 6 }}>
          <Row style={{ alignItems: 'baseline' }}>
            <T style={[cond(18), { textTransform: 'uppercase' }]}>{n}</T>
            <T style={[mono(12), { color: C.soft }]}>{Math.round(cons[k])} / {tgt[k]} g</T>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${Math.min(100, (cons[k] / tgt[k]) * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
          </View>
        </View>
      ))}
      <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 4, gap: 4 }}>
        {groupByMeal(todays).map((g) => (
          <View key={g.label} style={{ paddingTop: 10 }}>
            <Row style={{ paddingBottom: 4 }}>
              <T style={[cond(18), { textTransform: 'uppercase', color: g.items.length ? C.text : C.dim }]}>{g.label}</T>
              <Row style={{ gap: 14 }}>
                {g.items.length ? <T style={[mono(11), { color: C.soft }]}>{fmt(g.kcal)} KCAL</T> : null}
                {g.meal ? <LinkButton label="+ AÑADIR" onPress={() => nav.navigate('FoodAdd', { meal: g.meal, date: day })} /> : null}
              </Row>
            </Row>
            {g.items.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => actions(f.name, [
                  ...(day !== today ? [{ label: 'Copiar a hoy', onPress: () => addFood({ date: today, meal: f.meal, name: f.name, grams: f.grams, p: f.p, c: f.c, f: f.f, kcal: f.kcal }) }] : []),
                  ...MEALS.filter((m) => m.key !== f.meal).map((m) => ({ label: `Mover a ${m.label.toLowerCase()}`, onPress: () => updateFood(f.id, { meal: m.key }) })),
                  { label: 'Eliminar', destructive: true, onPress: () => removeFood(f.id) },
                ])}
                accessibilityHint={`En ${mealLabel(f.meal).toLowerCase()}. Toca para moverlo o eliminarlo`}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Row style={{ gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={body(14, 600)} lines={1}>{f.name}</T>
                    <T style={[mono(11, 500), { color: C.muted }]}>{fmt(f.grams)} g · P{f.p} C{f.c} G{f.f}</T>
                  </View>
                  <T style={cond(18)}>{fmt(f.kcal)}</T>
                  <T style={[mono(14), { color: C.dim }]}>⋯</T>
                </Row>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
}

function CarbCyclingCard({ day, onPick }: { day: ISODate; onPick: (d: ISODate) => void }) {
  const { dayTypeOn, macrosOn } = useDerived();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
  const carbs = week.map((d) => macrosOn(d).c);
  const max = Math.max(...carbs, 1);
  return (
    <Card gap={14}>
      <Row>
        <Eyebrow>CICLADO DE CARBOHIDRATOS</Eyebrow>
        <Eyebrow spacing={0}>G/DÍA</Eyebrow>
      </Row>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 120 }}>
        {week.map((d, i) => {
          const isToday = d === day;
          const t = dayTypeOn(d);
          const vc = isToday ? C.lime : C.muted;
          const bg = isToday ? C.lime : t === 'Pesado' ? '#4c504a' : t === 'Moderado' ? '#2f322e' : C.line;
          return (
            <Pressable key={d} onPress={() => onPick(d)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <T style={[mono(10), { color: vc }]}>{carbs[i]}</T>
              <View style={{ width: '100%', height: Math.round((carbs[i] / max) * 80), backgroundColor: bg, borderRadius: 6 }} />
              <T style={[cond(13, 700), { color: vc }]}>{dayLetter(d)}</T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const SCAN_KINDS: ScanKind[] = ['plato', 'etiqueta', 'ticket'];

function ScanCard({ day }: { day: ISODate }) {
  const nav = useNav();
  const link = useStore((s) => s.settings.watch);
  const open = (kind: ScanKind) => {
    if (!aiReady(link)) {
      Alert.alert('IA', 'Configura el servidor en Hoy → Bip 6 → Reloj para usar la IA.');
      return;
    }
    nav.navigate('FoodScan', { kind, date: day });
  };
  return (
    <Card>
      <SectionTitle eyebrow="REGISTRO RÁPIDO · VISIÓN" title="Foto → alimentos y macros" />
      <View style={{ height: 150, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#262826', alignItems: 'center', justifyContent: 'center' }}>
        <Hatch />
        <View style={{ position: 'absolute', left: 14, top: 14, width: 22, height: 22, borderLeftWidth: 2, borderTopWidth: 2, borderColor: C.lime }} />
        <View style={{ position: 'absolute', right: 14, bottom: 14, width: 22, height: 22, borderRightWidth: 2, borderBottomWidth: 2, borderColor: C.lime }} />
        <T style={[mono(11, 500), { color: C.muted, position: 'absolute' }]}>PLATO · ETIQUETA · TICKET</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SCAN_KINDS.map((kind) => (
          <Pressable
            key={kind}
            onPress={() => open(kind)}
            accessibilityRole="button"
            accessibilityLabel={`Escanear ${kind}`}
            style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <T style={[cond(16, 800), { color: C.bg, textTransform: 'uppercase' }]}>{kind}</T>
          </Pressable>
        ))}
      </View>
      <T style={[mono(10, 500, 1.4), { color: C.dim }]}>LA FOTO SE ENVÍA A LA IA Y NO SE GUARDA.</T>
    </Card>
  );
}

/** Week of the chosen day: tap a day to see or log its food; arrows move a week. */
function DayStrip({ day, onPick }: { day: ISODate; onPick: (d: ISODate) => void }) {
  const { today, energyOn } = useDerived();
  const foods = useStore((s) => s.foods);
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));
  const kcalOn = (d: ISODate) => foods.reduce((a, f) => (f.date === d ? a + f.kcal : a), 0);
  const arrow = (label: string, n: number, hint: string) => (
    <Pressable onPress={() => onPick(addDays(day, n))} accessibilityLabel={hint} hitSlop={8} style={({ pressed }) => ({ width: 28, alignItems: 'center', opacity: pressed ? 0.5 : 1 })}>
      <T style={[cond(26, 700), { color: C.soft }]}>{label}</T>
    </Pressable>
  );
  return (
    <Card gap={10} padding={12}>
      <Row>
        <Eyebrow>{dayName(day, today)}{day === today ? ` · ${shortDay(day)}` : ''}</Eyebrow>
        {day !== today ? <LinkButton label="VOLVER A HOY" onPress={() => onPick(today)} /> : <T style={[mono(10, 500), { color: C.dim }]}>TOCA UN DÍA PARA VERLO</T>}
      </Row>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {arrow('‹', -7, 'Semana anterior')}
        {week.map((d) => {
          const on = d === day;
          const kcal = kcalOn(d);
          const pct = kcal ? Math.min(1, kcal / Math.max(1, energyOn(d).target)) : 0;
          const future = d > today;
          return (
            <Pressable
              key={d}
              onPress={() => onPick(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${dayName(d, today)}${kcal ? `, ${kcal} kcal` : ', sin comidas'}`}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 12, backgroundColor: on ? C.lime : 'transparent', borderWidth: d === today && !on ? 1 : 0, borderColor: C.lime, opacity: pressed ? 0.7 : 1 })}
            >
              <T style={[mono(10, 600), { color: on ? C.bg : future ? C.dim : C.muted }]}>{dayLetter(d)}</T>
              <T style={[cond(20, 800), { color: on ? C.bg : future ? C.dim : C.text }]}>{parseISO(d).getDate()}</T>
              <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: on ? 'rgba(0,0,0,0.2)' : C.line, overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: on ? C.bg : C.lime }} />
              </View>
              <T style={[mono(9, 500), { color: on ? C.bg : C.dim }]}>{kcal ? fmt(kcal) : '—'}</T>
            </Pressable>
          );
        })}
        {arrow('›', 7, 'Semana siguiente')}
      </View>
    </Card>
  );
}

export function NutricionScreen() {
  const { today, dayTypeOn } = useDerived();
  const [picked, setPicked] = useState<ISODate | null>(null);
  const day = picked ?? today;
  const pick = (d: ISODate) => setPicked(d === today ? null : d);
  const override = useStore((s) => s.dayTypeOverride[day]);
  const setDayType = useStore((s) => s.setDayType);
  const type = dayTypeOn(day);
  return (
    <Screen>
      <ScreenHeader eyebrow={day === today ? 'NUTRICIÓN ADAPTATIVA' : `NUTRICIÓN · ${shortDay(day)}`} title={`Día ${type.toLowerCase()}`} />
      <DayStrip day={day} onPick={pick} />
      <Segmented
        options={DAY_TYPES}
        value={type}
        onChange={(d) => setDayType(day, d)}
        height={38}
        radius={10}
        outerRadius={14}
        render={(d, on) => <T style={[cond(15, 700), { color: on ? C.bg : C.soft, textTransform: 'uppercase', letterSpacing: em(15, 0.02) }]}>{d}</T>}
      />
      <Row style={{ paddingHorizontal: 2 }}>
        <T style={[mono(10, 500), { color: C.dim }]}>{override ? 'TIPO DE DÍA ELEGIDO A MANO' : 'TIPO DE DÍA SEGÚN TU SESIÓN'}</T>
        {override ? <LinkButton label="AUTOMÁTICO" onPress={() => setDayType(day, undefined)} /> : null}
      </Row>
      <MacrosCard day={day} />
      <TdeeCard day={day} />
      <CarbCyclingCard day={day} onPick={pick} />
      <ScanCard day={day} />
    </Screen>
  );
}
