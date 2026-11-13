import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { today } from '../domain/dates';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body } from '../theme';
import { Card, Eyebrow, Field, PrimaryButton, SheetHeader, T, num } from '../ui';

export function BodyEntryScreen() {
  const nav = useNav();
  const day = today();
  const s = useStore();
  const w0 = s.weighIns.find((w) => w.date === day);
  const b0 = s.bodyComps.find((b) => b.date === day);
  const p0 = s.perimeters.find((p) => p.date === day);
  const str = (v?: number) => (v === undefined ? '' : String(v).replace('.', ','));
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
    nav.goBack();
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow="CUERPO · HOY" title="Medidas" onClose={() => nav.goBack()} />
      <Card>
        <Eyebrow>BÁSCULA · EN AYUNAS</Eyebrow>
        <Field label="PESO" value={kg} onChange={setKg} suffix="KG" />
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
    </Screen>
  );
}
