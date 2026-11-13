import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BodyMap } from '../components/charts';
import { Screen } from '../components/Screen';
import { STATUS_COLOR, STATUS_LABEL, fmt, fmtSigned } from '../data';
import { addDays, longDay } from '../domain/dates';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import { BALANCE_LABEL } from '../engines/balance';
import { buildQueue } from '../engines/generator';
import { useNav, useUi } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, LinkButton, Row, T } from '../ui';

function RecoveryCard() {
  const nav = useNav();
  const { recovery: r, today } = useDerived();
  const activity = useStore((s) => s.activity);
  const watchOn = useStore((s) => s.settings.watch.enabled);
  const healthStatus = useUi((s) => s.healthStatus);
  const baseDays = activity.filter((a) => a.date < today && a.date >= addDays(today, -7) && (a.hrvMs || a.restingHr)).length;
  const scoreHint = r.score !== null ? null
    : !r.hrv && !r.restingHr ? (watchOn ? 'ABRE RECOMP EN EL RELOJ' : 'TOCA PARA REGISTRAR')
    : `BASE ${Math.min(baseDays, 3)}/3 DÍAS`;
  const stats: [string, string, string][] = [
    ['HRV nocturno', r.hrv ? `${r.hrv.value} MS` : '—', r.hrv?.vsBaselinePct != null ? `${fmtSigned(r.hrv.vsBaselinePct)}% vs 7 d` : r.hrv ? 'sin base' : healthStatus ?? 'manual'],
    ['Sueño profundo', r.deepSleepMin ? `${Math.floor(r.deepSleepMin / 60)} H ${String(r.deepSleepMin % 60).padStart(2, '0')}` : '—', r.deepSleepMin ? 'última noche' : 'sin dato'],
    ['FC reposo', r.restingHr ? `${r.restingHr.value} LPM` : '—', r.restingHr?.vsBaseline != null ? `${fmtSigned(Math.round(r.restingHr.vsBaseline))} vs 7 d` : r.restingHr ? 'sin base' : 'sin dato'],
    ['Pasos', r.steps ? fmt(r.steps) : '—', r.steps ? 'hoy' : 'sin dato'],
  ];
  return (
    <Pressable onPress={() => nav.navigate('ActivityEntry')} accessibilityLabel="Registrar datos de recuperación" style={{ backgroundColor: C.lime, borderRadius: 20, padding: 18, flexDirection: 'row', gap: 18, alignItems: 'flex-end' }}>
      <View style={{ gap: 2 }}>
        <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.bg }]}>RECUPERACIÓN</T>
        {r.score !== null ? (
          <T style={[cond(96, 900), { color: C.bg, letterSpacing: em(96, -0.03), marginBottom: -12 }]}>{r.score}</T>
        ) : (
          <View style={{ gap: 4, maxWidth: 96 }}>
            <T style={[cond(40, 900), { color: C.bg }]}>—</T>
            <T style={[mono(9, 600, 1.3), { color: C.bg }]}>{scoreHint}</T>
          </View>
        )}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 10 }}>
        {stats.map(([k, v, d]) => (
          <View key={k} style={{ width: '45%', flexGrow: 1, gap: 2 }}>
            <T style={[body(11, 600), { color: C.bg }]}>{k}</T>
            <T style={[cond(24), { color: C.bg }]}>{v}</T>
            <T style={[mono(10), { color: C.bg }]}>{d}</T>
          </View>
        ))}
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

function Engine8020Card() {
  const { balance: b } = useDerived();
  const upper = b.total ? Math.round((1 - b.lowerShare) * 100) : 80;
  const lower = b.total ? 100 - upper : 20;
  const statusColor = b.status === 'en-objetivo' ? C.lime : b.status === 'sin-datos' ? C.muted : C.coral;
  return (
    <Card>
      <Row>
        <Eyebrow>MOTOR 80/20 · 7 DÍAS</Eyebrow>
        <Eyebrow color={statusColor} spacing={0}>{BALANCE_LABEL[b.status]}</Eyebrow>
      </Row>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ gap: 2 }}>
          <T style={[cond(64, 900), { color: b.total ? C.lime : C.dim }]}>{upper}%</T>
          <T style={[body(12), { color: C.muted }]}>Superior + core</T>
        </View>
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <T style={[cond(64, 900), { color: b.total ? C.cyan : C.dim }]}>{lower}%</T>
          <T style={[body(12), { color: C.muted }]}>Inferior</T>
        </View>
      </Row>
      <View style={{ height: 12, flexDirection: 'row', gap: 3 }}>
        <View style={{ width: `${upper}%`, backgroundColor: b.total ? C.lime : C.border, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
        <View style={{ flex: 1, backgroundColor: b.total ? C.cyan : C.chip, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
        <View style={{ position: 'absolute', left: '80%', top: -4, width: 2, height: 20, backgroundColor: C.text }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
        {[
          ['Empuje', `${b.push} SER.`, C.text],
          ['Tracción', `${b.pull} SER.`, C.text],
          ['Ratio E:T', b.pull ? fmt(b.pushPull, 2) : '—', b.total && !b.pushPullOk ? C.coral : C.text],
        ].map(([k, v, c]) => (
          <View key={k} style={{ flex: 1, gap: 3 }}>
            <T style={[body(11), { color: C.muted }]}>{k}</T>
            <T style={[cond(24), { color: c }]}>{v}</T>
          </View>
        ))}
      </View>
    </Card>
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
      <Engine8020Card />

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
