import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { addDays, shortDay, today } from '../domain/dates';
import type { ISODate } from '../domain/types';
import { useNav, type RootStackParamList } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, mono } from '../theme';
import { Card, Eyebrow, Field, GhostButton, PrimaryButton, Row, SheetHeader, T, num } from '../ui';

const str = (v?: number) => (v === undefined ? '' : String(v).replace('.', ','));

/** Weigh-in, body composition and perimeters for one day (today by default; ‹ › to fix earlier days). */
export function BodyEntryScreen() {
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'BodyEntry'>>();
  const now = today();
  const [day, setDay] = useState<ISODate>(params?.date ?? now);
  // Remount the form when the day changes so it prefills that day's values.
  return <BodyForm key={day} day={day} isToday={day === now} onDay={(d) => setDay(d > now ? now : d)} onClose={() => nav.goBack()} />;
}

function BodyForm({ day, isToday, onDay, onClose }: { day: ISODate; isToday: boolean; onDay: (d: ISODate) => void; onClose: () => void }) {
  const s = useStore();
  const w0 = s.weighIns.find((w) => w.date === day);
  const b0 = s.bodyComps.find((b) => b.date === day);
  const p0 = s.perimeters.find((p) => p.date === day);
  const [kg, setKg] = useState(str(w0?.kg));
  const [fat, setFat] = useState(str(b0?.fatPct));
  const [smm, setSmm] = useState(str(b0?.smmKg));
  const [waist, setWaist] = useState(str(p0?.waist));
  const [chest, setChest] = useState(str(p0?.chest));
  const [arm, setArm] = useState(str(p0?.arm));
  const [thigh, setThigh] = useState(str(p0?.thigh));

  const save = () => {
    if (num(kg)) s.addWeighIn({ date: day, kg: num(kg)! });
    if (num(fat) || num(smm)) s.addBodyComp({ date: day, fatPct: num(fat), smmKg: num(smm) });
    if ([waist, chest, arm, thigh].some((v) => num(v))) s.addPerimeters({ date: day, waist: num(waist), chest: num(chest), arm: num(arm), thigh: num(thigh) });
    onClose();
  };
  const initial = s.profile?.createdAt === day;
  const removeWeight = () =>
    Alert.alert('Borrar pesaje', `Se borra el pesaje de ${shortDay(day)} (${str(w0?.kg)} kg).`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => { s.removeWeighIn(day); onClose(); } },
    ]);
  const arrow = (label: string, d: ISODate, disabled: boolean, a11y: string) => (
    <Pressable onPress={() => onDay(d)} disabled={disabled} accessibilityLabel={a11y} hitSlop={6} style={{ width: 44, height: 40, borderRadius: 12, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <T style={body(20, 600)}>{label}</T>
    </Pressable>
  );

  return (
    <Screen sheet>
      <SheetHeader eyebrow={`CUERPO · ${isToday ? 'HOY' : 'CORREGIR DÍA'}`} title="Medidas" onClose={onClose} />
      <Row style={{ gap: 8 }}>
        {arrow('‹', addDays(day, -1), false, 'Día anterior')}
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <T style={[cond(20), { textTransform: 'uppercase' }]}>{isToday ? 'Hoy' : shortDay(day)}</T>
          <T style={[mono(10, 500), { color: w0 || b0 || p0 ? C.lime : C.dim }]}>{w0 || b0 || p0 ? 'HAY DATOS · EDITANDO' : 'SIN DATOS ESTE DÍA'}</T>
        </View>
        {arrow('›', addDays(day, 1), isToday, 'Día siguiente')}
      </Row>
      <Card>
        <Eyebrow>BÁSCULA · EN AYUNAS</Eyebrow>
        <Field label={initial ? 'PESO · INICIAL' : 'PESO'} value={kg} onChange={setKg} suffix="KG" />
        {initial ? <T style={[mono(10, 500, 1.4), { color: C.lime }]}>ES TU PESO DE PARTIDA: AL CAMBIARLO SE ACTUALIZA TAMBIÉN EN EL PERFIL.</T> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="GRASA CORPORAL" value={fat} onChange={setFat} suffix="%" />
          <Field flex label="MASA MUSC. ESQ." value={smm} onChange={setSmm} suffix="KG" />
        </View>
        <T style={[body(12, 400, 1.4), { color: C.muted }]}>Grasa y masa muscular de tu báscula de bioimpedancia; mejor siempre a la misma hora.</T>
      </Card>
      <Card>
        <Eyebrow>PERÍMETROS · CM</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="CINTURA" value={waist} onChange={setWaist} />
          <Field flex label="PECHO" value={chest} onChange={setChest} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="BRAZO" value={arm} onChange={setArm} />
          <Field flex label="MUSLO" value={thigh} onChange={setThigh} />
        </View>
      </Card>
      <PrimaryButton label="Guardar" onPress={save} />
      {w0 ? <GhostButton label="BORRAR PESAJE DE ESTE DÍA" onPress={removeWeight} color={C.coral} /> : null}
    </Screen>
  );
}
