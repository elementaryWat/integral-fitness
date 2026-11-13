import { Pressable, View } from 'react-native';
import { Hatch } from '../components/charts';
import { Screen } from '../components/Screen';
import { fmt, fmtSigned } from '../data';
import { addDays, dayLetter, shortDay, startOfWeek } from '../domain/dates';
import type { DayType } from '../domain/types';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, LinkButton, Row, ScreenHeader, SectionTitle, Segmented, T } from '../ui';

const DAY_TYPES: DayType[] = ['Pesado', 'Moderado', 'Descanso'];

function TdeeCard() {
  const { today, energyOn, profile } = useDerived();
  const coach = useStore((s) => s.coach);
  const e = energyOn(today);
  const r = coach.lastRecalibration;
  const offset = e.target - (e.tdee - profile.deficitKcal);
  return (
    <Card>
      <Eyebrow>TDEE DINÁMICO · HOY</Eyebrow>
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
      <T style={[mono(11, 500, 1.4), { color: C.muted }]}>
        {r
          ? `Recalibrado ${shortDay(r.date).toLowerCase()}: ${fmtSigned(r.delta)} kcal. Peso ${fmt(r.observedKgWk, 2)} kg/sem frente a ${fmt(r.expectedKgWk, 2)} previsto.`
          : 'La recalibración semanal necesita 8 pesajes y 7 días de comidas registradas en 2 semanas.'}
      </T>
    </Card>
  );
}

function MacrosCard() {
  const nav = useNav();
  const { today, energyOn, macrosOn } = useDerived();
  const foods = useStore((s) => s.foods);
  const removeFood = useStore((s) => s.removeFood);
  const todays = foods.filter((f) => f.date === today);
  const cons = todays.reduce((a, f) => ({ p: a.p + f.p, c: a.c + f.c, f: a.f + f.f, kcal: a.kcal + f.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  const tgt = macrosOn(today);
  const left = energyOn(today).target - cons.kcal;
  return (
    <Card gap={14}>
      <Row>
        <Eyebrow>MACROS DE HOY</Eyebrow>
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
      <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 4 }}>
        {todays.map((f) => (
          <Row key={f.id} style={{ gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ flex: 1, gap: 3 }}>
              <T style={body(14, 600)} lines={1}>{f.name}</T>
              <T style={[mono(11, 500), { color: C.muted }]}>{fmt(f.grams)} g · P{f.p} C{f.c} G{f.f}</T>
            </View>
            <T style={cond(18)}>{fmt(f.kcal)}</T>
            <Pressable onPress={() => removeFood(f.id)} hitSlop={8} accessibilityLabel={`Eliminar ${f.name}`}>
              <T style={[mono(14), { color: C.dim }]}>×</T>
            </Pressable>
          </Row>
        ))}
        <View style={{ paddingTop: 12 }}>
          <LinkButton label="+ AÑADIR ALIMENTO" onPress={() => nav.navigate('FoodAdd')} />
        </View>
      </View>
    </Card>
  );
}

function CarbCyclingCard() {
  const { today, dayTypeOn, macrosOn } = useDerived();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i));
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
          const isToday = d === today;
          const t = dayTypeOn(d);
          const vc = isToday ? C.lime : C.muted;
          const bg = isToday ? C.lime : t === 'Pesado' ? '#4c504a' : t === 'Moderado' ? '#2f322e' : C.line;
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <T style={[mono(10), { color: vc }]}>{carbs[i]}</T>
              <View style={{ width: '100%', height: Math.round((carbs[i] / max) * 80), backgroundColor: bg, borderRadius: 6 }} />
              <T style={[cond(13, 700), { color: vc }]}>{dayLetter(d)}</T>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ScanCard() {
  return (
    <Card>
      <SectionTitle eyebrow="REGISTRO RÁPIDO · VISIÓN" title="Foto → alimentos y macros" />
      <View style={{ height: 150, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#262826', alignItems: 'center', justifyContent: 'center' }}>
        <Hatch />
        <View style={{ position: 'absolute', left: 14, top: 14, width: 22, height: 22, borderLeftWidth: 2, borderTopWidth: 2, borderColor: C.lime }} />
        <View style={{ position: 'absolute', right: 14, bottom: 14, width: 22, height: 22, borderRightWidth: 2, borderBottomWidth: 2, borderColor: C.lime }} />
        <T style={[mono(11, 500), { color: C.muted, position: 'absolute' }]}>PLATO · ETIQUETA · TICKET</T>
      </View>
      <View style={{ height: 48, borderRadius: 24, backgroundColor: '#2f322e', alignItems: 'center', justifyContent: 'center' }}>
        <T style={[cond(18), { color: C.muted, textTransform: 'uppercase' }]}>Próximamente · Fase 2</T>
      </View>
      <T style={[mono(10, 500, 1.4), { color: C.dim }]}>EL ESCANEO CON VISIÓN + LLM SE CONECTA CON EL BACKEND DE IA.</T>
    </Card>
  );
}

export function NutricionScreen() {
  const { today, dayTypeOn } = useDerived();
  const override = useStore((s) => s.dayTypeOverride[today]);
  const setDayType = useStore((s) => s.setDayType);
  const type = dayTypeOn(today);
  return (
    <Screen>
      <ScreenHeader eyebrow="NUTRICIÓN ADAPTATIVA" title={`Día ${type.toLowerCase()}`} />
      <Segmented
        options={DAY_TYPES}
        value={type}
        onChange={(d) => setDayType(today, d)}
        height={38}
        radius={10}
        outerRadius={14}
        render={(d, on) => <T style={[cond(15, 700), { color: on ? C.bg : C.soft, textTransform: 'uppercase', letterSpacing: em(15, 0.02) }]}>{d}</T>}
      />
      <Row style={{ paddingHorizontal: 2 }}>
        <T style={[mono(10, 500), { color: C.dim }]}>{override ? 'TIPO DE DÍA ELEGIDO A MANO' : 'TIPO DE DÍA SEGÚN TU SESIÓN'}</T>
        {override ? <LinkButton label="AUTOMÁTICO" onPress={() => setDayType(today, undefined)} /> : null}
      </Row>
      <TdeeCard />
      <MacrosCard />
      <CarbCyclingCard />
      <ScanCard />
    </Screen>
  );
}
