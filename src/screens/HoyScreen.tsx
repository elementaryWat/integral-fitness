import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BodyMap } from '../components/charts';
import { Screen } from '../components/Screen';
import { STATUS_COLOR, STATUS_LABEL, fmt, fmtSigned } from '../data';
import { longDay } from '../domain/dates';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import { BALANCE_LABEL } from '../engines/balance';
import { dayAdvice, STEP_GOAL } from '../engines/recovery';
import { buildQueue } from '../engines/generator';
import { useNav, useUi } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, LinkButton, Row, T } from '../ui';

const stressLabel = (v: number) => (v < 40 ? 'relajado' : v < 60 ? 'normal' : v < 80 ? 'medio' : 'alto');
const hm = (min: number) => `${Math.floor(min / 60)} H ${String(Math.round(min % 60)).padStart(2, '0')}`;

/** Today's readiness: score, the four signals that feed it and what to do with your training. */
function RecoveryCard() {
  const nav = useNav();
  const { recovery: r, states } = useDerived();
  const watchOn = useStore((s) => s.settings.watch.enabled);
  const healthStatus = useUi((s) => s.healthStatus);
  const advice = dayAdvice(r.score, states);
  const vs = (n: number | null | undefined, unit = '') => (n == null ? null : `${fmtSigned(Math.round(n))}${unit} vs 7 d`);
  const signal: [string, string, string] = r.hrv
    ? ['HRV nocturno', `${r.hrv.value} MS`, r.hrv.vsBaselinePct != null ? `${fmtSigned(Math.round(r.hrv.vsBaselinePct))}% vs 7 d` : 'sin base']
    : r.stress
      ? [r.stress.night ? 'Estrés nocturno' : 'Estrés del día', String(r.stress.value), vs(r.stress.vsBaseline) ?? stressLabel(r.stress.value)]
      : ['Estrés nocturno', '—', watchOn ? 'abre Wrep en el reloj' : healthStatus ?? 'sin dato'];
  const stats: [string, string, string][] = [
    signal,
    ['Sueño', r.sleep ? hm(r.sleep.min) : r.deepSleepMin ? hm(r.deepSleepMin) : '—', r.sleep?.deepMin ? `profundo ${hm(r.sleep.deepMin).toLowerCase()} · ${r.sleep.deepPct} %` : 'sin dato'],
    ['FC reposo', r.restingHr ? `${r.restingHr.value} LPM` : '—', vs(r.restingHr?.vsBaseline) ?? (r.restingHr ? 'sin base' : 'sin dato')],
    ['Pasos', r.steps ? fmt(r.steps) : '—', `de ${fmt(STEP_GOAL)}${r.pai ? ` · PAI ${r.pai}` : ''}`],
  ];
  const hint = r.score === null ? (watchOn ? 'ABRE WREP EN EL RELOJ' : 'TOCA PARA VER') : r.provisional ? `PROVISIONAL · BASE ${Math.min(r.baseDays, 3)}/3` : 'VS TUS ÚLTIMOS 7 DÍAS';
  return (
    <Pressable onPress={() => nav.navigate('RecoveryDetail')} accessibilityLabel="Ver detalle de recuperación" style={{ backgroundColor: C.lime, borderRadius: 20, padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-end' }}>
        <View style={{ gap: 2, maxWidth: 104 }}>
          <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.bg }]}>RECUPERACIÓN</T>
          <T style={[cond(r.score !== null ? 88 : 40, 900), { color: C.bg, letterSpacing: em(88, -0.03), marginBottom: r.score !== null ? -10 : 0 }]}>{r.score ?? '—'}</T>
          <T style={[mono(9, 600, 1.3), { color: C.bg, paddingTop: r.score !== null ? 8 : 0 }]}>{hint}</T>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 10 }}>
          {stats.map(([k, v, d], i) => (
            <View key={k} style={{ width: '45%', flexGrow: 1, gap: 2 }}>
              <T style={[body(11, 600), { color: C.bg }]}>{k}</T>
              <T style={[cond(24), { color: C.bg }]}>{v}</T>
              {i === 3 ? (
                <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', overflow: 'hidden', marginVertical: 2 }}>
                  <View style={{ width: `${Math.min(100, ((r.steps ?? 0) / STEP_GOAL) * 100)}%`, height: 4, backgroundColor: C.bg }} />
                </View>
              ) : null}
              <T style={[mono(10), { color: C.bg }]} lines={2}>{d}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.18)', paddingTop: 12, gap: 3 }}>
        <T style={[cond(20), { color: C.bg, textTransform: 'uppercase' }]}>{advice.title}</T>
        <T style={[body(13, 500, 1.35), { color: C.bg }]}>{advice.detail}</T>
      </View>
    </Pressable>
  );
}

function MuscleMapCard() {
  const { states } = useDerived();
  const [view, setView] = useState<'front' | 'back'>('back');
  const [sel, setSel] = useState<MuscleKey>('dors');
  const m = states[sel];
  const selColor = m.status === 'b' ? C.cyan : STATUS_COLOR[m.status];
  const toggle = (v: 'front' | 'back', label: string) => {
    const on = view === v;
    return (
      <Pressable onPress={() => { setView(v); setSel(v === 'front' ? 'pecho' : 'dors'); }} accessibilityState={{ selected: on }} style={{ paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: on ? C.text : 'transparent' }}>
        <T style={[mono(10), { color: on ? C.bg : C.muted }]}>{label}</T>
      </Pressable>
    );
  };
  return (
    <Card gap={14}>
      <Row>
        <View style={{ gap: 4 }}>
          <Eyebrow>MAPA MUSCULAR · 7 DÍAS</Eyebrow>
          <T style={[cond(24), { textTransform: 'uppercase' }]}>Estímulo por grupo</T>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: C.chip, borderRadius: 10, padding: 3, gap: 2 }}>
          {toggle('front', 'FRENTE')}
          {toggle('back', 'ESPALDA')}
        </View>
      </Row>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <BodyMap view={view} selected={sel} onSelect={setSel} status={(k) => states[k].status} width={150} />
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: C.chip }}>
            <T style={[mono(10), { letterSpacing: em(10, 0.08), color: selColor }]}>{STATUS_LABEL[m.status]}</T>
            <T style={[cond(20), { textTransform: 'uppercase' }]}>{MUSCLE_INFO[sel].name}</T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T style={cond(36)}>{fmt(m.sets, m.sets % 1 ? 1 : 0)}</T>
              <T style={[body(11), { color: C.muted }]}>/ {m.target} series/sem</T>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${m.rec}%`, backgroundColor: selColor }} />
            </View>
            <T style={[mono(10, 500), { color: C.muted }]}>RECUPERACIÓN {m.rec}%</T>
            <T style={[body(12, 400, 1.35), { color: C.soft }]}>{m.note}</T>
          </View>
          <View style={{ gap: 7 }}>
            {([[C.low, 'Sub-entrenado'], [C.lime, 'Zona óptima'], [C.coral, 'Fatiga / recuperación']] as const).map(([c, l]) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} />
                <T style={[body(12), { color: C.soft }]}>{l}</T>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

/** The 80/20 check lives in Coach; Hoy only warns when the last 7 days are out of range. */
function BalanceAlert() {
  const nav = useNav();
  const { balance: b } = useDerived();
  if (!b.total || (b.status === 'en-objetivo' && b.pushPullOk)) return null;
  const lowerPct = Math.round(b.lowerShare * 100);
  const msg = b.status === 'pierna-baja' ? `Pierna al ${lowerPct} % de tus series (objetivo ~20 %).`
    : b.status === 'pierna-alta' ? `Pierna al ${lowerPct} % de tus series: más de lo previsto para la recomposición.`
    : `Empuje y tracción desequilibrados (${b.push}:${b.pull} series).`;
  return (
    <Pressable onPress={() => nav.navigate('Coach')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.coral, borderRadius: 14, padding: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Eyebrow color={C.coral}>{`MOTOR 80/20 · ${b.status === 'en-objetivo' ? 'EMPUJE:TRACCIÓN' : BALANCE_LABEL[b.status]}`}</Eyebrow>
        <T style={[body(13, 500, 1.35), { color: C.soft }]}>{msg}</T>
      </View>
      <T style={[mono(11), { color: C.coral }]}>COACH →</T>
    </Pressable>
  );
}

export function HoyScreen() {
  const nav = useNav();
  const watchOn = useStore((s) => s.settings.watch.enabled);
  const watchStatus = useUi((s) => s.watchStatus);
  const profile = useStore((s) => s.profile);
  const minutes = useStore((s) => s.settings.plannedMinutes);
  const active = useStore((s) => s.activeSession);
  const { today, plan, deload } = useDerived();
  const setCount = active ? active.queue.length : buildQueue(plan).length;
  const titles = [...new Set((active?.blocks ?? plan).filter((b) => b.kind === 'superserie').map((b) => b.title.toLowerCase()))];
  return (
    <Screen>
      <Row style={{ alignItems: 'flex-end', paddingTop: 6, paddingHorizontal: 2, paddingBottom: 2 }}>
        <View style={{ gap: 4, flex: 1 }}>
          <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.muted }]}>{longDay(today)}</T>
          <T style={[cond(40), { textTransform: 'uppercase' }]} lines={1}>{profile?.name ? `Hola, ${profile.name}` : 'Hola'}</T>
        </View>
        <Pressable onPress={() => nav.navigate('WatchPair')} accessibilityLabel="Configurar el reloj" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#262826' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: watchOn ? (watchStatus === 'error' ? C.coral : C.lime) : active ? C.lime : C.dim }} />
          <T style={[mono(11, 500), { color: C.soft }]}>{watchOn ? (watchStatus === 'error' ? 'Bip 6 · sin servidor' : active ? 'Bip 6 · en sesión' : 'Bip 6 · conectado') : 'Bip 6 · simulador'}</T>
        </Pressable>
      </Row>

      <RecoveryCard />
      <MuscleMapCard />
      <BalanceAlert />

      <Pressable onPress={() => nav.navigate('Entreno')} style={{ backgroundColor: C.text, borderRadius: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.bg }]}>
            {active ? 'EN CURSO' : 'HOY'} · {active?.plannedMinutes ?? minutes} MIN · {setCount} SERIES{deload ? ' · DESCARGA' : ''}
          </T>
          <T style={[cond(26, 800, 1.02), { color: C.bg, textTransform: 'uppercase' }]}>
            {titles.length ? `Superseries ${titles.slice(0, 2).join(' + ')}` : 'Configura tus ejercicios'}
          </T>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <T style={[body(20, 600), { color: C.lime }]}>→</T>
        </View>
      </Pressable>
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <LinkButton label="REGISTRAR SUEÑO, HRV Y PASOS →" color={C.muted} onPress={() => nav.navigate('ActivityEntry')} />
      </View>
    </Screen>
  );
}
