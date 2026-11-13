import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { today } from '../domain/dates';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { C, body } from '../theme';
import { Card, Field, PrimaryButton, SheetHeader, T, num } from '../ui';

/** Manual daily wearable data until Apple Health / Health Connect sync (Fase 4). */
export function ActivityEntryScreen() {
  const nav = useNav();
  const day = today();
  const existing = useStore((s) => s.activity.find((a) => a.date === day));
  const setActivity = useStore((s) => s.setActivity);
  const str = (v?: number) => (v === undefined ? '' : String(v));
  const [steps, setSteps] = useState(str(existing?.steps));
  const [active, setActive] = useState(str(existing?.activeKcal));
  const [deep, setDeep] = useState(str(existing?.deepSleepMin));
  const [sleep, setSleep] = useState(str(existing?.sleepMin));
  const [hrv, setHrv] = useState(str(existing?.hrvMs));
  const [rhr, setRhr] = useState(str(existing?.restingHr));

  const save = () => {
    setActivity({ date: day, steps: num(steps), activeKcal: num(active), deepSleepMin: num(deep), sleepMin: num(sleep), hrvMs: num(hrv), restingHr: num(rhr) });
    nav.goBack();
  };

  return (
    <Screen sheet>
      <SheetHeader eyebrow="RELOJ · DATOS DE HOY" title="Recuperación" onClose={() => nav.goBack()} />
      <T style={[body(13, 400, 1.4), { color: C.muted }]}>Introduce lo que marca la app Zepp. Con Apple Health / Health Connect se rellenará solo.</T>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="HRV NOCTURNO" value={hrv} onChange={setHrv} keyboard="number-pad" suffix="MS" />
          <Field flex label="FC REPOSO" value={rhr} onChange={setRhr} keyboard="number-pad" suffix="LPM" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="SUEÑO PROFUNDO" value={deep} onChange={setDeep} keyboard="number-pad" suffix="MIN" />
          <Field flex label="SUEÑO TOTAL" value={sleep} onChange={setSleep} keyboard="number-pad" suffix="MIN" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="PASOS" value={steps} onChange={setSteps} keyboard="number-pad" />
          <Field flex label="KCAL ACTIVAS" value={active} onChange={setActive} keyboard="number-pad" suffix="KCAL" />
        </View>
      </Card>
      <PrimaryButton label="Guardar" onPress={save} />
    </Screen>
  );
}
