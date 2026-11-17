import { useEffect, useState } from 'react';
import { Alert, NativeModules, Pressable, Switch, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { useNav, useUi } from '../navigation';
import { useStore } from '../store';
import { C, body, cond, em, mono } from '../theme';
import { Card, Eyebrow, GhostButton, PrimaryButton, Row, SheetHeader, T } from '../ui';
import { cleanUrl, health, newPairCode } from '../watch/relay';

/** In development the relay runs on the same Mac as Metro: suggest that host on port 8787. */
function suggestedUrl() {
  const script: string | undefined = NativeModules.SourceCode?.scriptURL;
  const host = script?.match(/^https?:\/\/([^/:]+)/)?.[1];
  return host && host !== 'localhost' ? `http://${host}:8787` : '';
}

const STEPS = [
  'En el Mac: `npm start` dentro de server/ (el servidor puente).',
  'Instala Wrep en el Bip 6 desde la app Zepp (modo desarrollador).',
  'App Zepp → Perfil → Wrep → Ajustes: pega la URL y el código de abajo.',
  'Empieza una sesión en Entreno: aparecerá en el reloj.',
];

export function WatchPairScreen() {
  const nav = useNav();
  const link = useStore((s) => s.settings.watch);
  const update = useStore((s) => s.updateSettings);
  const status = useUi((s) => s.watchStatus);
  const live = useUi((s) => s.watchLive);
  const syncError = useUi((s) => s.watchError);
  const active = useStore((s) => !!s.activeSession);
  const [url, setUrl] = useState(link.serverUrl || suggestedUrl());
  const [test, setTest] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  // Persist the generated code the first time the screen opens so it never changes under the user.
  useEffect(() => {
    update({ watch: { ...link, code: link.code || newPairCode() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (patch: Partial<typeof link>) => update({ watch: { ...link, serverUrl: cleanUrl(url), ...patch } });
  const check = async () => {
    setTest('checking');
    save({});
    try {
      const r = await health({ ...link, serverUrl: cleanUrl(url) });
      setTest(r.ok ? 'ok' : 'fail');
    } catch {
      setTest('fail');
    }
  };

  const statusText = !link.enabled ? 'DESACTIVADO · SE USA EL SIMULADOR' : status === 'ok' ? (live?.hr ? `CONECTADO · ♥ ${live.hr} LPM` : 'CONECTADO AL SERVIDOR') : status === 'error' ? 'SIN RESPUESTA DEL SERVIDOR' : 'ESPERANDO SESIÓN';
  const statusColor = !link.enabled ? C.muted : status === 'ok' ? C.lime : status === 'error' ? C.coral : C.soft;

  return (
    <Screen sheet>
      <SheetHeader eyebrow="AMAZFIT BIP 6 · ZEPP OS" title="Reloj" onClose={() => nav.goBack()} />

      <Card gap={10}>
        <Row>
          <View style={{ flex: 1, gap: 4 }}>
            <T style={body(15, 600)}>Usar el reloj real</T>
            <T style={[mono(10), { color: statusColor, letterSpacing: em(10, 0.08) }]}>{statusText}</T>
            {link.enabled && syncError ? <T style={[mono(10, 500, 1.4), { color: C.coral }]}>{syncError.toUpperCase()}</T> : null}
            {link.enabled ? <T style={[mono(10, 500, 1.4), { color: C.dim }]}>{active ? 'SESIÓN ACTIVA · SE ENVÍA AL RELOJ' : 'SIN SESIÓN ACTIVA EN ENTRENO'}</T> : null}
            {link.enabled ? <T style={[mono(10, 500, 1.4), { color: C.dim }]} lines={1}>{link.serverUrl || 'SIN URL'}</T> : null}
          </View>
          <Switch value={link.enabled} onValueChange={(v) => save({ enabled: v })} trackColor={{ true: C.lime, false: C.border }} thumbColor={C.text} />
        </Row>
      </Card>

      <Card gap={12}>
        <Eyebrow>CÓDIGO DE EMPAREJAMIENTO</Eyebrow>
        <T style={[cond(56, 900), { letterSpacing: em(56, 0.12) }]}>{link.code}</T>
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert('¿Generar otro código?', 'El reloj dejará de recibir sesiones hasta que lo reinstales con el código nuevo.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Generar', style: 'destructive', onPress: () => update({ watch: { ...link, code: newPairCode() } }) },
            ])
          }
        >
          <T style={[mono(10), { color: C.muted }]}>GENERAR OTRO CÓDIGO</T>
        </Pressable>
        <View style={{ gap: 6 }}>
          <Eyebrow spacing={0.08}>URL DEL SERVIDOR PUENTE</Eyebrow>
          <TextInput
            value={url}
            onChangeText={(v) => { setUrl(v); setTest('idle'); }}
            onBlur={() => save({})}
            placeholder="http://192.168.0.10:8787"
            placeholderTextColor={C.dim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            allowFontScaling={false}
            style={[mono(15, 500), { color: C.text, backgroundColor: C.chip, borderRadius: 12, paddingHorizontal: 12, height: 46 }]}
          />
        </View>
        <PrimaryButton label={test === 'checking' ? 'Probando…' : 'Probar conexión'} onPress={check} disabled={test === 'checking' || !url} height={46} />
        {test === 'ok' && <T style={[mono(10), { color: C.lime }]}>SERVIDOR OK. AHORA PON LA MISMA URL Y CÓDIGO EN LA APP ZEPP.</T>}
        {test === 'fail' && <T style={[mono(10, 500, 1.4), { color: C.coral }]}>NO RESPONDE. ¿ESTÁ ENCENDIDO EL SERVIDOR Y EL MÓVIL EN LA MISMA WI-FI QUE EL MAC?</T>}
      </Card>

      <Card gap={0}>
        <Eyebrow style={{ paddingBottom: 4 }}>CÓMO CONECTARLO</Eyebrow>
        {STEPS.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <T style={[mono(11), { color: C.lime }]}>{String(i + 1).padStart(2, '0')}</T>
            <T style={[body(13, 400, 1.4), { flex: 1, color: C.soft }]}>{s.replace(/`/g, '')}</T>
          </View>
        ))}
      </Card>

      <GhostButton label="ABRIR EL SIMULADOR DEL RELOJ" onPress={() => { nav.goBack(); useUi.getState().setWatchOpen(true); }} />
    </Screen>
  );
}
