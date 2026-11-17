import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { AiRequestError, physiqueReview } from '../ai/api';
import { physiquePhotos } from '../ai/logic';
import { fmt } from '../data';
import { addDays, shortDay } from '../domain/dates';
import { MUSCLE_INFO, type MuscleKey } from '../domain/muscles';
import type { ProgressPhoto } from '../domain/types';
import type { WeeklyReview } from '../engines/coachRules';
import { photoDataUrl, photoUri } from '../photos';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, mono } from '../theme';
import { Card, Eyebrow, GhostButton, Placeholder, PrimaryButton, Row, T } from '../ui';

const VIEW_LABEL = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' } as const;

function Section({ title, color = C.muted, items }: { title: string; color?: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow color={color}>{title}</Eyebrow>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <T style={[mono(12), { color, width: 12 }]}>·</T>
          <T style={[body(14, 500, 1.4), { flex: 1 }]}>{x}</T>
        </View>
      ))}
    </View>
  );
}

/**
 * Progress photos read by the AI together with today's data (weight, body fat, muscle mass,
 * weekly volume, protein, coach signals). Photos are only sent after an explicit confirmation
 * and the server forwards them without storing them.
 */
export function PhysiqueCard({ review }: { review: WeeklyReview }) {
  const s = useStore();
  const d = useDerived();
  const [busy, setBusy] = useState(false);
  const { date, latest, older } = physiquePhotos(s.photos);
  const saved = date ? s.coach.physique?.[date] : undefined;
  const front = latest.find((p) => p.view === 'frente') ?? latest[0];

  const data = () => {
    const from = addDays(d.today, -6);
    const days = new Map<string, { p: number; kcal: number }>();
    for (const f of s.foods.filter((x) => x.date >= from)) {
      const v = days.get(f.date) ?? { p: 0, kcal: 0 };
      days.set(f.date, { p: v.p + f.p, kcal: v.kcal + f.kcal });
    }
    const logged = [...days.values()];
    const lastWeighIn = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const muscles = Object.fromEntries((Object.keys(d.states) as MuscleKey[]).map((m) => [MUSCLE_INFO[m].name, `${Math.round(d.states[m].sets * 10) / 10}/${d.states[m].target} series/sem · ${d.states[m].status}`]));
    return {
      perfil: { sexo: d.profile.sex, edad: d.profile.age, alturaCm: d.profile.heightCm, objetivo: d.profile.goal ?? 'recomp', experiencia: d.profile.experience ?? null },
      pesoUltimaPesadaKg: lastWeighIn?.kg ?? null,
      pesoMedia7dKg: Math.round(d.weight * 10) / 10,
      grasaBioimpedanciaPct: d.fatPct ?? null,
      masaMuscularEsqueleticaKg: d.smm ?? null,
      nutricion7d: logged.length ? { diasRegistrados: logged.length, proteinaGKg: Math.round((logged.reduce((a, x) => a + x.p, 0) / logged.length / (lastWeighIn?.kg ?? d.weight)) * 10) / 10, kcalMedia: Math.round(logged.reduce((a, x) => a + x.kcal, 0) / logged.length) } : null,
      volumenSemanalPorMusculo: muscles,
      sesiones7d: s.sessions.filter((x) => x.date >= from).length,
      senalesCoach: review.signals.map((x) => `${x.title}: ${x.detail}`),
      fechaFotos: date,
      fotoAnteriorFecha: older?.date ?? null,
    };
  };

  const run = async () => {
    if (busy || !latest.length) return;
    setBusy(true);
    try {
      const list: ProgressPhoto[] = [...latest, ...(older ? [older] : [])];
      const images = await Promise.all(list.map((p) => photoDataUrl(p)));
      const photos = list.map((p, i) => ({ label: `${p === older ? 'Foto anterior · ' : ''}${VIEW_LABEL[p.view]} · ${p.date}`, image: images[i] }));
      const res = await physiqueReview(s.settings.watch, photos, data());
      s.setPhysique(date!, { ...res, at: Date.now(), photoIds: list.map((p) => p.id) });
    } catch (e) {
      Alert.alert('IA', e instanceof AiRequestError ? e.message : 'No se pudieron leer o enviar las fotos.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    const n = latest.length + (older ? 1 : 0);
    Alert.alert(
      'Analizar fotos con IA',
      `Se enviarán ${n} ${n === 1 ? 'foto' : 'fotos'} (${latest.map((p) => VIEW_LABEL[p.view].toLowerCase()).join(', ')}${older ? ' y una de frente anterior' : ''}) y tus datos actuales a OpenAI. No se guardan en el servidor.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', onPress: () => { run(); } }],
    );
  };

  return (
    <Card gap={12}>
      <Row>
        <Eyebrow>FOTOS · LECTURA CON IA</Eyebrow>
        {date ? <T style={[mono(10, 500), { color: C.muted }]}>{shortDay(date).toUpperCase()}</T> : null}
      </Row>
      {latest.length ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {older ? (
            <View style={{ flex: 1, gap: 4 }}>
              <Image source={{ uri: photoUri(older) }} style={{ height: 130, borderRadius: 10, backgroundColor: C.chip, opacity: 0.85 }} resizeMode="cover" />
              <T style={[mono(9, 500), { color: C.dim }]}>ANTES · {shortDay(older.date).toUpperCase()}</T>
            </View>
          ) : null}
          {latest.map((p) => (
            <View key={p.id} style={{ flex: 1, gap: 4 }}>
              <Image source={{ uri: photoUri(p) }} style={{ height: 130, borderRadius: 10, backgroundColor: C.chip, borderWidth: p === front && older ? 1 : 0, borderColor: C.lime }} resizeMode="cover" />
              <T style={[mono(9, 500), { color: C.muted }]}>{VIEW_LABEL[p.view].toUpperCase()}</T>
            </View>
          ))}
        </View>
      ) : (
        <Placeholder label="Añade fotos en Cuerpo" height={120} radius={12} />
      )}

      {saved ? (
        <View style={{ gap: 14 }}>
          <T style={[cond(24, 800, 1.1), { textTransform: 'uppercase' }]}>{saved.headline}</T>
          {saved.bodyFat ? (
            <View style={{ backgroundColor: C.chip, borderRadius: 12, padding: 12, gap: 4 }}>
              <Row>
                <T style={[mono(10), { color: C.muted }]}>GRASA ESTIMADA A LA VISTA</T>
                <T style={[cond(22), { color: C.lime }]}>{fmt(saved.bodyFat.low)}–{fmt(saved.bodyFat.high)} %</T>
              </Row>
              <T style={[body(12, 400, 1.4), { color: C.soft }]}>{saved.bodyFat.note}{d.fatPct !== undefined ? ` Tu báscula: ${fmt(d.fatPct, 1)} %.` : ''}</T>
            </View>
          ) : null}
          <Section title="LO QUE SE VE" items={saved.observations} />
          <Section title="PUNTOS FUERTES" color={C.lime} items={saved.strengths} />
          <Section title="A PRIORIZAR" color={C.amber} items={saved.priorities} />
          <View style={{ gap: 6 }}>
            <Eyebrow color={C.cyan}>FOTOS VS. TUS DATOS</Eyebrow>
            <T style={[body(14, 500, 1.4)]}>{saved.dataCheck}</T>
          </View>
          {saved.comparison ? (
            <View style={{ gap: 6 }}>
              <Eyebrow>CAMBIOS DESDE LA FOTO ANTERIOR</Eyebrow>
              <T style={[body(14, 500, 1.4)]}>{saved.comparison}</T>
            </View>
          ) : null}
          <Section title="QUÉ HACER" color={C.lime} items={saved.actions} />
          <T style={[mono(9, 500, 1.4), { color: C.dim }]}>ESTIMACIÓN VISUAL ORIENTATIVA: LA LUZ, EL ÁNGULO Y EL BOMBEO INFLUYEN. NO ES UNA MEDICIÓN.</T>
          <GhostButton label={busy ? 'ANALIZANDO…' : '↻ VOLVER A ANALIZAR CON DATOS ACTUALES'} onPress={confirm} height={40} />
        </View>
      ) : latest.length ? (
        <>
          <T style={[body(13, 400, 1.4), { color: C.soft }]}>La IA observa tus fotos por zonas, estima tu grasa a la vista y lo cruza con tu peso, báscula, volumen por músculo y proteína.</T>
          <PrimaryButton label={busy ? 'Analizando…' : '✦ Analizar mis fotos'} onPress={confirm} disabled={busy} height={46} />
        </>
      ) : (
        <T style={[body(13, 400, 1.4), { color: C.soft }]}>Sube frente, perfil y espalda en Cuerpo con la misma luz y postura para que la IA pueda leerlas.</T>
      )}
    </Card>
  );
}
