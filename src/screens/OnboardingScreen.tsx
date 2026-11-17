import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, fmtSigned } from '../data';
import { addDays, shortDay, today } from '../domain/dates';
import type { ActivityLevel, Experience, Goal, Pace, Profile, Sex } from '../domain/types';
import { dayEnergy, PLANNED_TRAIN_KCAL } from '../engines/energy';
import { SESSION_MINUTES, type Minutes } from '../engines/generator';
import { ACTIVITY_INFO, deficitFor, EXPERIENCE_INFO, GOAL_INFO, PACE_LABEL, targetRate, weeksToTarget } from '../engines/goals';
import { macroTargets } from '../engines/macros';
import { useNav } from '../navigation';
import { useStore } from '../store';
import { buildDemoData } from '../store/demo';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, ChipSelect, Eyebrow, Field, GhostButton, PrimaryButton, Row, Segmented, T, num } from '../ui';

const DAYS = [
  { value: 1, label: 'L' }, { value: 2, label: 'M' }, { value: 3, label: 'X' }, { value: 4, label: 'J' },
  { value: 5, label: 'V' }, { value: 6, label: 'S' }, { value: 7, label: 'D' },
];
const GOALS: Goal[] = ['recomp', 'definir', 'volumen', 'mantener'];
const PACES: Pace[] = ['suave', 'moderado', 'rapido'];
const LEVELS: ActivityLevel[] = ['sedentario', 'ligero', 'activo', 'muy-activo'];
const EXPERIENCES: Experience[] = ['principiante', 'intermedio', 'avanzado'];

type StepKey = 'intro' | 'tu' | 'medidas' | 'objetivo' | 'entreno' | 'actividad' | 'resumen';

interface Draft {
  name: string;
  sex?: Sex;
  age: string;
  height: string;
  weight: string;
  fat: string;
  /** Skeletal muscle mass (kg), optional */
  smm?: string;
  goal?: Goal;
  pace: Pace;
  target: string;
  experience?: Experience;
  days: number[];
  minutes: Minutes;
  activity?: ActivityLevel;
}

const inRange = (s: string, lo: number, hi: number) => {
  const v = num(s);
  return v !== undefined && v >= lo && v <= hi;
};
const optionalInRange = (s: string, lo: number, hi: number) => !s.trim() || inRange(s, lo, hi);
const decimal = (v: number | undefined) => (v === undefined ? '' : String(+v.toFixed(1)).replace('.', ','));

function stepValid(k: StepKey, d: Draft) {
  switch (k) {
    case 'tu': return !!d.sex && inRange(d.age, 14, 90) && inRange(d.height, 120, 230);
    case 'medidas': return inRange(d.weight, 35, 250) && optionalInRange(d.fat, 3, 60) && optionalInRange(d.smm ?? '', 10, 80);
    case 'objetivo': return !!d.goal && (d.goal === 'mantener' || optionalInRange(d.target, 35, 250));
    case 'entreno': return !!d.experience && d.days.length > 0;
    case 'actividad': return !!d.activity;
    default: return true;
  }
}

/** Profile from a complete draft; `base` keeps creation date and starting weight when editing. */
function buildProfile(d: Draft, base?: Profile): Profile {
  const weight = num(d.weight)!;
  const goal = d.goal ?? 'recomp';
  const rate = targetRate(goal, d.pace, weight);
  return {
    name: d.name.trim(),
    sex: d.sex ?? 'h',
    age: Math.round(num(d.age)!),
    heightCm: Math.round(num(d.height)!),
    startWeightKg: base?.startWeightKg ?? weight,
    createdAt: base?.createdAt ?? today(),
    goal,
    pace: d.pace,
    targetWeightKg: goal === 'mantener' ? undefined : num(d.target),
    targetRateKgWk: rate,
    deficitKcal: deficitFor(rate),
    proteinGPerKg: GOAL_INFO[goal].protein,
    trainingDays: [...d.days].sort(),
    activityLevel: d.activity ?? 'ligero',
    experience: d.experience ?? 'intermedio',
  };
}

// ---------- building blocks ----------

function Option({ title, sub, meta, on, onPress, compact }: { title: string; sub?: string; meta?: string; on: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => ({
        flex: compact ? 1 : undefined, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
        backgroundColor: on ? '#12160a' : C.card, borderWidth: 1, borderColor: on ? C.lime : C.line, opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ gap: 8 }}>
          <T style={[cond(22), { textTransform: 'uppercase', color: on ? C.text : C.soft }]}>{title}</T>
          {meta ? <T style={[mono(10), { color: on ? C.lime : C.muted }]}>{meta}</T> : null}
        </Row>
        {sub ? <T style={[body(13, 400, 1.35), { color: C.muted }]}>{sub}</T> : null}
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 0 : 1.5, borderColor: '#4c504a', backgroundColor: on ? C.lime : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <T style={[body(13, 700), { color: C.bg }]}>✓</T> : null}
      </View>
    </Pressable>
  );
}

function Hint({ children, color = C.dim }: { children: ReactNode; color?: string }) {
  return <T style={[mono(10, 500, 1.45), { color }]}>{children}</T>;
}

function StepTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: 6, paddingBottom: 4 }}>
      <T style={[mono(11), { letterSpacing: em(11, 0.16), color: C.lime }]}>{eyebrow}</T>
      <T style={[cond(40, 800), { textTransform: 'uppercase' }]}>{title}</T>
      {sub ? <T style={[body(14, 400, 1.45), { color: C.muted }]}>{sub}</T> : null}
    </View>
  );
}

// ---------- steps ----------

function IntroStep({ d, set, onDemo }: { d: Draft; set: (p: Partial<Draft>) => void; onDemo?: (name: string) => void }) {
  const items = [
    ['01', 'Gasto basal y TDEE dinámico'],
    ['02', 'Calorías y macros por tipo de día'],
    ['03', 'Volumen semanal por músculo y reparto 80/20'],
  ];
  return (
    <>
      <StepTitle eyebrow="WREP · BIENVENIDA" title="Empecemos" sub="Seis pasos rápidos para ajustar el plan a tu cuerpo, tu objetivo y tu semana." />
      <Card>
        <Field label="¿CÓMO TE LLAMAS? (OPC.)" value={d.name} onChange={(name) => set({ name })} keyboard="default" placeholder="Tu nombre" />
      </Card>
      <Card gap={0}>
        <Eyebrow style={{ paddingBottom: 4 }}>LO QUE VAMOS A CALCULAR</Eyebrow>
        {items.map(([n, t], i) => (
          <View key={n} style={{ flexDirection: 'row', gap: 12, alignItems: 'baseline', paddingVertical: 10, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
            <T style={[mono(11), { color: C.lime }]}>{n}</T>
            <T style={body(14, 500)}>{t}</T>
          </View>
        ))}
      </Card>
      {onDemo ? (
        <View style={{ gap: 8, paddingTop: 8 }}>
          <GhostButton label="O CARGA 4 SEMANAS DE EJEMPLO" onPress={() => onDemo(d.name.trim())} />
          <T style={[mono(10, 500, 1.4), { color: C.dim, textAlign: 'center' }]}>LOS DATOS DE EJEMPLO SE GENERAN CON LOS MISMOS MOTORES DE LA APP. PUEDES BORRARLOS DESDE COACH.</T>
        </View>
      ) : null}
    </>
  );
}

function YouStep({ d, set, showName }: { d: Draft; set: (p: Partial<Draft>) => void; showName?: boolean }) {
  const bad = (d.age && !inRange(d.age, 14, 90)) || (d.height && !inRange(d.height, 120, 230));
  return (
    <>
      <StepTitle eyebrow="SOBRE TI" title="Tu cuerpo" sub="El sexo biológico, la edad y la altura ajustan la fórmula del gasto basal." />
      {showName ? (
        <Card>
          <Field label="NOMBRE" value={d.name} onChange={(name) => set({ name })} keyboard="default" placeholder="Tu nombre" />
        </Card>
      ) : null}
      <Eyebrow spacing={0.08}>SEXO</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Option compact title="Hombre" on={d.sex === 'h'} onPress={() => set({ sex: 'h' })} />
        <Option compact title="Mujer" on={d.sex === 'm'} onPress={() => set({ sex: 'm' })} />
      </View>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="EDAD" value={d.age} onChange={(age) => set({ age })} keyboard="number-pad" suffix="AÑOS" />
          <Field flex label="ALTURA" value={d.height} onChange={(height) => set({ height })} keyboard="number-pad" suffix="CM" />
        </View>
        {bad ? <Hint color={C.coral}>REVISA LOS VALORES: EDAD 14–90 AÑOS, ALTURA 120–230 CM.</Hint> : null}
      </Card>
    </>
  );
}

function MeasuresStep({ d, set, avgWeight }: { d: Draft; set: (p: Partial<Draft>) => void; avgWeight?: number }) {
  const badW = d.weight && !inRange(d.weight, 35, 250);
  const badF = !optionalInRange(d.fat, 3, 60) || !optionalInRange(d.smm ?? '', 10, 80);
  return (
    <>
      <StepTitle eyebrow="PUNTO DE PARTIDA" title="Peso y grasa" sub={avgWeight !== undefined ? 'Tu última pesada. Si la cambias se guarda como la pesada de hoy.' : 'Mejor en ayunas, después del baño. A partir de mañana la app usa la media de 7 días.'} />
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field flex label="PESO ACTUAL" value={d.weight} onChange={(weight) => set({ weight })} suffix="KG" placeholder="78,5" />
          <Field flex label="GRASA (OPC.)" value={d.fat} onChange={(fat) => set({ fat })} suffix="%" placeholder="18" />
        </View>
        <Field label="MASA MUSCULAR ESQUELÉTICA (OPC.)" value={d.smm ?? ''} onChange={(smm) => set({ smm })} suffix="KG" placeholder="36,5" />
        {badW || badF ? <Hint color={C.coral}>REVISA LOS VALORES: PESO 35–250 KG, GRASA 3–60 %, MASA MUSCULAR 10–80 KG.</Hint> : null}
        {avgWeight !== undefined ? <Hint color={C.lime}>{`LOS CÁLCULOS USAN LA MEDIA DE 7 DÍAS: ${decimal(avgWeight)} KG. POR ESO ESE NÚMERO SE MUEVE MÁS DESPACIO QUE LA BÁSCULA.`}</Hint> : null}
        <Hint>CON % DE GRASA USAMOS KATCH-MCARDLE (MÁS PRECISA). SIN ÉL, MIFFLIN-ST JEOR. PUEDES AÑADIRLO DESPUÉS EN CUERPO.</Hint>
      </Card>
    </>
  );
}

function GoalStep({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const weight = num(d.weight) ?? 75;
  const goal = d.goal;
  const rate = goal ? targetRate(goal, d.pace, weight) : 0;
  const def = deficitFor(rate);
  const target = num(d.target);
  const weeks = weeksToTarget(weight, target, rate);
  const rateText = (r: number) => (r === 0 ? 'ESTABLE' : `${fmtSigned(r, 2)} KG/SEM`);
  return (
    <>
      <StepTitle eyebrow="OBJETIVO" title="¿Qué buscas?" sub="Define el déficit o superávit, la proteína y cómo el coach juzga tu progreso." />
      {GOALS.map((g) => (
        <Option key={g} title={GOAL_INFO[g].label} sub={GOAL_INFO[g].sub} meta={rateText(targetRate(g, d.pace, weight))} on={goal === g} onPress={() => set({ goal: g })} />
      ))}
      {goal && GOAL_INFO[goal].pace ? (
        <View style={{ gap: 8, paddingTop: 4 }}>
          <Eyebrow spacing={0.08}>RITMO</Eyebrow>
          <Segmented
            options={PACES}
            value={d.pace}
            onChange={(pace) => set({ pace })}
            height={40}
            radius={10}
            outerRadius={14}
            render={(v, on) => <T style={[cond(16, 700), { color: on ? C.bg : C.soft, textTransform: 'uppercase' }]}>{PACE_LABEL[v]}</T>}
          />
        </View>
      ) : null}
      {goal ? (
        <Card>
          <Row>
            <T style={body(14, 600)}>Ritmo previsto</T>
            <T style={cond(22)}>{rateText(rate)}</T>
          </Row>
          <Row>
            <T style={body(14, 600)}>{def >= 0 ? 'Déficit diario' : 'Superávit diario'}</T>
            <T style={cond(22)}>{def ? `${fmt(Math.abs(def))} KCAL` : '—'}</T>
          </Row>
          <Row>
            <T style={body(14, 600)}>Proteína</T>
            <T style={cond(22)}>{fmt(GOAL_INFO[goal].protein, 1)} G/KG</T>
          </Row>
          {goal !== 'mantener' ? (
            <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
              <Field label="PESO OBJETIVO (OPC.)" value={d.target} onChange={(t) => set({ target: t })} suffix="KG" />
              {target !== undefined && optionalInRange(d.target, 35, 250) ? (
                weeks ? (
                  <Hint color={C.lime}>≈ {weeks} SEMANAS · HACIA EL {shortDay(addDays(today(), weeks * 7))}</Hint>
                ) : (
                  <Hint color={C.amber}>ESE PESO NO VA EN LA DIRECCIÓN DEL OBJETIVO ELEGIDO. EN RECOMPOSICIÓN, MIRA LA CINTURA Y LA FUERZA MÁS QUE LA BÁSCULA.</Hint>
                )
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function TrainingStep({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <>
      <StepTitle eyebrow="ENTRENAMIENTO" title="Tu semana" sub="El generador arma superseries antagonistas que caben en el tiempo que tengas." />
      <Eyebrow spacing={0.08}>EXPERIENCIA</Eyebrow>
      {EXPERIENCES.map((x) => (
        <Option key={x} title={EXPERIENCE_INFO[x].label} sub={EXPERIENCE_INFO[x].sub} meta={EXPERIENCE_INFO[x].volume ? `${fmtSigned(EXPERIENCE_INFO[x].volume)} SERIES/MÚSC.` : undefined} on={d.experience === x} onPress={() => set({ experience: x })} />
      ))}
      <Card>
        <ChipSelect label="DÍAS DE ENTRENO" options={DAYS} selected={d.days} onToggle={(v) => set({ days: d.days.includes(v) ? d.days.filter((x) => x !== v) : [...d.days, v] })} />
        <View style={{ gap: 8 }}>
          <Eyebrow spacing={0.08}>DURACIÓN HABITUAL</Eyebrow>
          <Segmented
            options={SESSION_MINUTES}
            value={d.minutes}
            onChange={(minutes) => set({ minutes })}
            height={40}
            radius={10}
            outerRadius={14}
            render={(v, on) => <T style={[cond(18, 700), { color: on ? C.bg : C.soft }]}>{v} MIN</T>}
          />
        </View>
        <Hint>{d.days.length} DÍAS × {d.minutes} MIN · LOS DÍAS SIN ENTRENO SON DÍAS DE DESCANSO (MÁS GRASA, MENOS CARBOHIDRATO).</Hint>
      </Card>
    </>
  );
}

function ActivityStep({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <>
      <StepTitle eyebrow="ACTIVIDAD DIARIA" title="Fuera del gym" sub="Sin contar el entrenamiento. Es la base del NEAT hasta que conectes el reloj o Salud." />
      {LEVELS.map((l) => (
        <Option key={l} title={ACTIVITY_INFO[l].label} sub={ACTIVITY_INFO[l].sub} on={d.activity === l} onPress={() => set({ activity: l })} />
      ))}
    </>
  );
}

function SummaryStep({ d }: { d: Draft }) {
  const profile = buildProfile(d);
  const weight = num(d.weight)!;
  const fat = num(d.fat);
  const coach = { kcalOffset: 0, restDayKcal: 0, volumeDelta: {}, mesoStart: today() };
  const trainType = d.minutes >= 45 ? 'Pesado' : 'Moderado';
  const train = dayEnergy({ profile, weightKg: weight, fatPct: fat, trainKcal: PLANNED_TRAIN_KCAL[trainType], coach, dayType: trainType });
  const rest = dayEnergy({ profile, weightKg: weight, fatPct: fat, trainKcal: 0, coach, dayType: 'Descanso' });
  const mt = macroTargets(train.target, weight, profile, trainType);
  const mr = macroTargets(rest.target, weight, profile, 'Descanso');
  const n = profile.trainingDays.length;
  const avg = Math.round((train.target * n + rest.target * (7 - n)) / 7);
  const weeks = weeksToTarget(weight, profile.targetWeightKg, profile.targetRateKgWk ?? 0);
  const goal = profile.goal!;
  const rows: [string, string][] = [
    ['Objetivo', `${GOAL_INFO[goal].label}${GOAL_INFO[goal].pace ? ` · ${PACE_LABEL[profile.pace!].toLowerCase()}` : ''}`],
    ['Ritmo', profile.targetRateKgWk ? `${fmtSigned(profile.targetRateKgWk, 2)} kg/sem` : 'peso estable'],
    ...(profile.targetWeightKg !== undefined ? [['Meta', `${fmt(profile.targetWeightKg, 1)} kg${weeks ? ` · ~${weeks} sem` : ''}`] as [string, string]] : []),
    ['Entreno', `${n} días × ${d.minutes} min · ${EXPERIENCE_INFO[profile.experience!].label.toLowerCase()}`],
    ['Actividad', ACTIVITY_INFO[profile.activityLevel!].label],
  ];
  const macroCols: [string, number, number, string][] = [['PROTEÍNA', mt.p, mr.p, C.lime], ['CARBOS', mt.c, mr.c, C.cyan], ['GRASA', mt.f, mr.f, C.amber]];
  return (
    <>
      <StepTitle eyebrow="TU PLAN" title={profile.name ? `Listo, ${profile.name}` : 'Todo listo'} sub="Punto de partida. Cada semana se recalibra con tu peso real y lo que comes." />
      <Card>
        <Eyebrow>OBJETIVO MEDIO DIARIO</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T style={cond(64, 900)}>{fmt(avg)}</T>
          <T style={[mono(12), { color: C.muted }]}>KCAL</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['Día de entreno', train.target, C.lime], ['Día de descanso', rest.target, C.text]] as const).map(([k, v, c]) => (
            <View key={k} style={{ flex: 1, gap: 3, backgroundColor: C.chip, borderRadius: 12, padding: 12 }}>
              <T style={[body(12), { color: C.muted }]}>{k}</T>
              <T style={[cond(26), { color: c }]}>{fmt(v)}</T>
            </View>
          ))}
        </View>
        <Hint>
          BASAL {fmt(train.bmr)} · ACTIVIDAD {fmt(train.neat)} · ENTRENO {fmt(train.train)} · {profile.deficitKcal >= 0 ? 'DÉFICIT' : 'SUPERÁVIT'} {fmt(Math.abs(profile.deficitKcal))}
        </Hint>
      </Card>
      <Card>
        <Eyebrow>MACROS · ENTRENO / DESCANSO</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {macroCols.map(([k, a, b, c]) => (
            <View key={k} style={{ flex: 1, gap: 3 }}>
              <T style={[mono(10), { color: C.muted }]}>{k}</T>
              <T style={[cond(24), { color: c }]}>{a}<T style={[cond(16), { color: C.muted }]}> / {b}</T></T>
              <T style={[mono(10), { color: C.dim }]}>G</T>
            </View>
          ))}
        </View>
      </Card>
      <Card gap={0}>
        {rows.map(([k, v], i) => (
          <Row key={k} style={{ paddingVertical: 10, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: C.line, gap: 12 }}>
            <T style={[body(14), { color: C.muted }]}>{k}</T>
            <T style={[body(14, 600), { flexShrink: 1, textAlign: 'right' }]}>{v}</T>
          </Row>
        ))}
      </Card>
    </>
  );
}

// ---------- wizard ----------

function ProfileWizard({ initial, base, onDone, onCancel, onDemo, sheet, avgWeight }: {
  initial: Draft;
  /** 7-day average shown under the weight when editing (the field holds the last weigh-in). */
  avgWeight?: number;
  base?: Profile;
  onDone: (p: Profile, d: Draft) => void;
  onCancel?: () => void;
  onDemo?: (name: string) => void;
  sheet?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const steps: StepKey[] = base ? ['tu', 'medidas', 'objetivo', 'entreno', 'actividad', 'resumen'] : ['intro', 'tu', 'medidas', 'objetivo', 'entreno', 'actividad', 'resumen'];
  const [i, setI] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKb(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const key = steps[i];
  const ok = stepValid(key, d);
  const last = i === steps.length - 1;
  const counted: StepKey[] = steps.filter((s) => s !== 'intro');
  const pos = counted.indexOf(key);

  const next = () => {
    if (!ok) return;
    Keyboard.dismiss();
    if (last) onDone(buildProfile(d, base), d);
    else setI(i + 1);
  };
  const back = () => { Keyboard.dismiss(); if (i > 0) setI(i - 1); else onCancel?.(); };

  const content = {
    intro: <IntroStep d={d} set={set} onDemo={onDemo} />,
    tu: <YouStep d={d} set={set} showName={!!base} />,
    medidas: <MeasuresStep d={d} set={set} avgWeight={avgWeight} />,
    objetivo: <GoalStep d={d} set={set} />,
    entreno: <TrainingStep d={d} set={set} />,
    actividad: <ActivityStep d={d} set={set} />,
    resumen: <SummaryStep d={d} />,
  }[key];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingTop: sheet ? 16 : insets.top + 6, paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        <Row style={{ height: 36 }}>
          {i > 0 || onCancel ? (
            <Pressable onPress={back} accessibilityRole="button" hitSlop={8} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' }}>
              <T style={mono(11)}>{i > 0 ? '← ATRÁS' : 'CERRAR'}</T>
            </Pressable>
          ) : <View />}
          {pos >= 0 ? <T style={[mono(11), { color: C.muted }]}>{String(pos + 1).padStart(2, '0')} / {String(counted.length).padStart(2, '0')}</T> : null}
        </Row>
        {pos >= 0 ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {counted.map((s, j) => <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: j <= pos ? C.lime : C.border }} />)}
          </View>
        ) : null}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={key} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
          <View style={{ gap: 12 }}>{content}</View>
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: kb ? 12 : Math.max(insets.bottom, 12) + 4, borderTopWidth: 1, borderTopColor: C.chip }}>
          <PrimaryButton label={key === 'intro' ? 'Empezar' : last ? (base ? 'Guardar cambios' : 'Crear perfil') : 'Siguiente'} onPress={next} disabled={!ok} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const EMPTY: Draft = { name: '', age: '', height: '', weight: '', fat: '', pace: 'moderado', target: '', days: [1, 2, 4, 5, 6], minutes: 45 };

export function OnboardingScreen() {
  const setProfile = useStore((s) => s.setProfile);
  const addBodyComp = useStore((s) => s.addBodyComp);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceAll = useStore((s) => s.replaceAll);
  return (
    <ProfileWizard
      initial={EMPTY}
      onDemo={(name) => replaceAll(buildDemoData(name ? { name } : {}))}
      onDone={(p, d) => {
        const fat = num(d.fat);
        const smm = num(d.smm ?? '');
        if (fat || smm) addBodyComp({ date: p.createdAt, fatPct: fat, smmKg: smm });
        updateSettings({ plannedMinutes: d.minutes });
        setProfile(p);
      }}
    />
  );
}

/** Same flow as onboarding, prefilled, to change goal, schedule or measurements later. */
export function ProfileEditScreen() {
  const nav = useNav();
  const s = useStore();
  const { profile, weight, fatPct, today: day } = useDerived();
  // The field shows the last weigh-in (what you typed), not the 7-day average the app calculates with.
  const lastWeighIn = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? weight;
  const initial: Draft = {
    name: profile.name,
    sex: profile.sex,
    age: String(profile.age),
    height: String(profile.heightCm),
    weight: decimal(lastWeighIn),
    fat: decimal(fatPct),
    smm: decimal([...s.bodyComps].filter((b) => b.smmKg !== undefined).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.smmKg),
    goal: profile.goal ?? 'recomp',
    pace: profile.pace ?? 'moderado',
    target: decimal(profile.targetWeightKg),
    experience: profile.experience ?? 'intermedio',
    days: profile.trainingDays,
    minutes: s.settings.plannedMinutes,
    activity: profile.activityLevel ?? 'ligero',
  };
  return (
    <ProfileWizard
      sheet
      avgWeight={weight}
      initial={initial}
      base={profile}
      onCancel={() => nav.goBack()}
      onDone={(p, d) => {
        if (d.weight !== initial.weight) s.addWeighIn({ date: day, kg: num(d.weight)! });
        const fat = num(d.fat);
        const smm = num(d.smm ?? '');
        const fatChanged = !!fat && d.fat !== initial.fat;
        const smmChanged = !!smm && d.smm !== initial.smm;
        if (fatChanged || smmChanged) {
          const prev = s.bodyComps.find((b) => b.date === day);
          s.addBodyComp({ ...prev, date: day, ...(fatChanged ? { fatPct: fat } : {}), ...(smmChanged ? { smmKg: smm } : {}) });
        }
        s.updateSettings({ plannedMinutes: d.minutes });
        // A weigh-in on the start date may have just updated the starting weight: keep it.
        s.setProfile({ ...p, startWeightKg: useStore.getState().profile?.startWeightKg ?? p.startWeightKg });
        nav.goBack();
      }}
    />
  );
}
