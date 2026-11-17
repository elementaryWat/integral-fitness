import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, loadText, loadUnit, mmss, unitLabel } from '../data';
import { sessionMetrics } from '../engines/efficiency';
import { useLive } from '../session';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, em, mono } from '../theme';
import { Row, T } from '../ui';
import { Ring } from './charts';

/**
 * Amazfit Bip 6 mini-app (Zepp OS), simulated in-app until the real watch app ships (Fase 3).
 * It drives the same live session as the phone and writes real set logs.
 */

export function StepperRow({ value, unit, onMinus, onPlus, disabled, onValuePress }: { value: string | number; unit: string; onMinus: () => void; onPlus: () => void; disabled?: boolean; onValuePress?: () => void }) {
  const btn = (label: string, onPress: () => void, a11y: string) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={a11y} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, backgroundColor: pressed ? '#2c2e2c' : '#1f211f', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 })}>
      <T style={body(24, 500)}>{label}</T>
    </Pressable>
  );
  return (
    <Row style={{ backgroundColor: C.card, borderRadius: 16, padding: 4 }}>
      {btn('−', onMinus, 'Bajar ' + unit)}
      <Pressable onPress={onValuePress} disabled={!onValuePress || disabled} accessibilityRole={onValuePress ? 'button' : undefined} accessibilityHint={onValuePress ? 'Escribir el valor exacto' : undefined} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexShrink: 1, borderBottomWidth: onValuePress && !disabled ? 1 : 0, borderBottomColor: C.border, borderStyle: 'dashed' }}>
        <T style={cond(onValuePress ? 28 : 32, 700)} lines={1}>{value}</T>
        <T style={[mono(11), { color: C.muted }]}>{unit}</T>
      </Pressable>
      {btn('+', onPlus, 'Subir ' + unit)}
    </Row>
  );
}

export function RpeChips() {
  const { live, setRpe } = useLive();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[7, 8, 9, 10].map((v) => {
        const on = live.cur.rpe === v;
        return (
          <Pressable key={v} onPress={() => setRpe(v)} accessibilityState={{ selected: on }} style={{ flex: 1, height: 30, borderRadius: 9, backgroundColor: on ? C.text : C.chip, alignItems: 'center', justifyContent: 'center' }}>
            <T style={[mono(11), { color: on ? C.bg : C.muted }]}>RPE{v}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function SetScreen() {
  const { live, current, exercise, adjust, register } = useLive();
  if (!current || !exercise) return null;
  return (
    <View style={{ flex: 1, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18, gap: 8 }}>
      <Row>
        <T style={[mono(12), { color: C.lime }]}>{`${current.block}${current.pos} · ${current.set}/${current.sets}`}</T>
        <T style={[mono(12), { color: C.coral }]}>{Math.round(live.hr)} lpm</T>
      </Row>
      <T style={[cond(24), { textTransform: 'uppercase' }]} lines={1}>{exercise.name}</T>
      <StepperRow value={loadText(exercise, live.cur.load)} unit={loadUnit(exercise)} disabled={!exercise.step} onMinus={() => adjust('load', -1)} onPlus={() => adjust('load', 1)} />
      <StepperRow value={live.cur.reps} unit={unitLabel(exercise.unit)} onMinus={() => adjust('reps', -1)} onPlus={() => adjust('reps', 1)} />
      <RpeChips />
      <Pressable onPress={register} style={{ marginTop: 'auto', height: 46, borderRadius: 23, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
        <T style={[cond(18), { color: C.bg, textTransform: 'uppercase', letterSpacing: em(18, 0.02) }]}>Registrar · RIR {10 - live.cur.rpe}</T>
      </Pressable>
    </View>
  );
}

function RestScreen() {
  const { live, advance, extend, nextText } = useLive();
  const thr = useStore((s) => s.settings.hrThreshold);
  const remain = Math.max(0, live.restTarget - live.restT);
  return (
    <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center', gap: 9 }}>
      <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.muted }]}>{live.hrRule ? 'DESCANSO' : 'TRANSICIÓN'}</T>
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Ring progress={live.restT / live.restTarget} color={live.hrRule ? C.lime : C.cyan} />
        <T style={cond(50)}>{mmss(remain)}</T>
        <T style={[mono(10, 500), { color: C.muted }]}>DE {mmss(live.restTarget)}</T>
      </View>
      <Row style={{ alignSelf: 'stretch' }}>
        <T style={[mono(13), { color: C.coral }]}>{Math.round(live.hr)} lpm</T>
        <T style={[mono(13), { color: C.muted }]}>{live.hrRule ? 'UMBRAL ' + thr : 'SUPERSERIE'}</T>
      </Row>
      <T style={[body(12, 500, 1.25), { color: C.muted, textAlign: 'center', maxWidth: 220 }]} lines={2}>
        Sig. <T style={{ color: C.text }}>{nextText}</T>
      </T>
      <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={extend} style={{ height: 30, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: '#2c2e2c', justifyContent: 'center' }}>
          <T style={mono(11)}>+30 S</T>
        </Pressable>
        <Pressable onPress={advance} style={{ height: 30, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: '#2c2e2c', justifyContent: 'center' }}>
          <T style={mono(11)}>EMPEZAR</T>
        </Pressable>
      </View>
    </View>
  );
}

function AlertScreen() {
  const { live, advance, nextText } = useLive();
  return (
    <Pressable onPress={advance} accessibilityLabel="Empezar la siguiente serie" style={{ flex: 1, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22 }}>
      <T style={[mono(10), { letterSpacing: em(10, 0.14), color: C.bg }]}>LISTO · LA SERIE EMPIEZA AL TOCAR</T>
      <T style={[cond(60, 900, 0.9), { color: C.bg, textTransform: 'uppercase', textAlign: 'center' }]}>{'A por\nla serie'}</T>
      <T style={[mono(12), { color: C.bg }]}>{live.alertReason}</T>
      <T style={[body(13, 600, 1.25), { color: '#22300a', textAlign: 'center' }]} lines={2}>{nextText}</T>
      <View style={{ marginTop: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.bg }}>
        <T style={[mono(11), { color: C.lime }]}>TOCA PARA EMPEZAR</T>
      </View>
    </Pressable>
  );
}

function DoneScreen() {
  const { session } = useLive();
  const finish = useStore((s) => s.finishSession);
  const { ex, weight } = useDerived();
  const m = session ? sessionMetrics(session, ex, weight) : undefined;
  const line = (k: string, v: string) => (
    <Row style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
      <T style={[mono(13), { color: C.muted }]}>{k}</T>
      <T style={mono(13)}>{v}</T>
    </Row>
  );
  return (
    <View style={{ flex: 1, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 20, gap: 8 }}>
      <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.lime }]}>SESIÓN COMPLETADA</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T style={cond(58, 900)}>{m?.hasLogs ? fmt(m.tonnage) : '—'}</T>
        <T style={[mono(12), { color: C.muted }]}>KG</T>
      </View>
      {line('Densidad', (m?.hasLogs && m.totalSec > 0 ? fmt(m.density, 1) : '—') + ' kg/min')}
      {line('Duración', mmss(m?.totalSec ?? 0))}
      <Pressable onPress={finish} style={{ marginTop: 'auto', height: 44, borderRadius: 22, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' }}>
        <T style={[cond(16, 800), { color: C.bg, textTransform: 'uppercase' }]}>Guardar sesión</T>
      </Pressable>
    </View>
  );
}

function IdleScreen() {
  const { plan } = useDerived();
  const minutes = useStore((s) => s.settings.plannedMinutes);
  return (
    <View style={{ flex: 1, paddingTop: 34, paddingHorizontal: 24, paddingBottom: 24, gap: 10, alignItems: 'center', justifyContent: 'center' }}>
      <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.muted }]}>WREP</T>
      <T style={[cond(34, 800, 1), { textTransform: 'uppercase', textAlign: 'center' }]}>{'Sin sesión\nactiva'}</T>
      <T style={[body(12, 500, 1.3), { color: C.muted, textAlign: 'center' }]}>
        {plan.length ? `Hoy: ${minutes} min · ${plan.length} bloques. Empieza desde Entreno en el móvil.` : 'Configura tus ejercicios en el móvil.'}
      </T>
    </View>
  );
}

/** The watch hardware: strap, case, side buttons and screen. */
export function WatchDevice() {
  const { live } = useLive();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (live.alertCount === 0 || live.mode !== 'alert') return;
    Vibration.vibrate([0, 180, 120, 180, 120, 180]);
    shake.setValue(0);
    Animated.loop(Animated.timing(shake, { toValue: 1, duration: 450, useNativeDriver: true }), { iterations: 3 }).start();
  }, [live.alertCount, live.mode, shake]);

  const translateX = shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -6, 6, -4, 4, 0] });
  const rotate = shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 1], outputRange: ['0deg', '-1.2deg', '1.2deg', '0deg', '0deg'] });
  const strap = { width: 186, height: 72, backgroundColor: '#111211', borderColor: '#1d1f1d', borderWidth: 1 };

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ translateX }, { rotate }] }}>
      <View style={[strap, { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 0 }]} />
      <View style={{ width: 300, height: 350, borderRadius: 68, backgroundColor: '#1e201e', padding: 16, borderWidth: 1, borderColor: '#383b38', shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 35, shadowOffset: { width: 0, height: 30 } }}>
        <View style={{ position: 'absolute', right: -5, top: 96, width: 6, height: 46, borderRadius: 3, backgroundColor: '#2e302e' }} />
        <View style={{ position: 'absolute', right: -5, top: 160, width: 6, height: 46, borderRadius: 3, backgroundColor: '#2e302e' }} />
        <View style={{ flex: 1, borderRadius: 54, backgroundColor: '#000', overflow: 'hidden' }}>
          {live.mode === 'idle' && <IdleScreen />}
          {live.mode === 'set' && <SetScreen />}
          {live.mode === 'rest' && <RestScreen />}
          {live.mode === 'alert' && <AlertScreen />}
          {live.mode === 'done' && <DoneScreen />}
        </View>
      </View>
      <View style={[strap, { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderTopWidth: 0 }]} />
    </Animated.View>
  );
}

function SettingStepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const b = (t: string, f: () => void) => (
    <Pressable onPress={f} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
      <T style={body(20)}>{t}</T>
    </Pressable>
  );
  return (
    <Row style={{ gap: 10 }}>
      <T style={[mono(11, 500), { color: C.muted, flex: 1 }]}>{label}</T>
      {b('−', onMinus)}
      <T style={[mono(13), { width: 64, textAlign: 'center' }]}>{value}</T>
      {b('+', onPlus)}
    </Row>
  );
}

/** Full-screen modal hosting the simulated watch and its simulation settings. */
export function WatchSimulator({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={{ gap: 4 }}>
            <T style={[mono(11), { letterSpacing: em(11, 0.16), color: C.lime }]}>RELOJ · SIMULADOR</T>
            <T style={[cond(28), { textTransform: 'uppercase' }]}>Bip 6 en vivo</T>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Cerrar simulador" style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' }}>
            <T style={mono(11)}>CERRAR</T>
          </Pressable>
        </Row>
        <ScrollView contentContainerStyle={{ alignItems: 'center', gap: 22, paddingTop: 12, paddingBottom: insets.bottom + 28, paddingHorizontal: 16 }}>
          <WatchDevice />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T style={[mono(11), { letterSpacing: em(11, 0.14), color: C.muted }]}>AMAZFIT BIP 6 · MINI-APP ZEPP OS</T>
            <T style={[mono(12, 500), { color: C.dim }]}>Simulación ×{settings.simSpeed} · umbral FC {settings.hrThreshold} lpm</T>
          </View>
          <View style={{ alignSelf: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, gap: 12 }}>
            <T style={[mono(10), { letterSpacing: em(10, 0.12), color: C.muted }]}>SIMULACIÓN</T>
            <Row style={{ gap: 10 }}>
              <T style={[mono(11, 500), { color: C.muted, flex: 1 }]}>Velocidad</T>
              {[1, 3, 6].map((v) => (
                <Pressable key={v} onPress={() => update({ simSpeed: v })} style={{ width: 52, height: 34, borderRadius: 10, backgroundColor: settings.simSpeed === v ? C.lime : C.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={[mono(12), { color: settings.simSpeed === v ? C.bg : C.soft }]}>×{v}</T>
                </Pressable>
              ))}
            </Row>
            <SettingStepper label="Umbral FC" value={`${settings.hrThreshold} lpm`} onMinus={() => update({ hrThreshold: clamp(settings.hrThreshold - 1, 95, 130) })} onPlus={() => update({ hrThreshold: clamp(settings.hrThreshold + 1, 95, 130) })} />
            <SettingStepper label="Descanso máx." value={`${settings.restSec} s`} onMinus={() => update({ restSec: clamp(settings.restSec - 15, 45, 180) })} onPlus={() => update({ restSec: clamp(settings.restSec + 15, 45, 180) })} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
