import { Alert, Image, Pressable, View } from 'react-native';
import { WeightChart } from '../components/charts';
import { Screen } from '../components/Screen';
import { fmt, fmtSigned } from '../data';
import { addDays, daysBetween, shortDay, startOfWeek, today as todayISO, uid } from '../domain/dates';
import type { ISODate, Perimeters, PhotoView, ProgressPhoto } from '../domain/types';
import { movingAverage } from '../engines/energy';
import { useNav } from '../navigation';
import { deletePhotoFile, photoUri, pickPhoto } from '../photos';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, mono } from '../theme';
import { Card, Chip, Empty, Eyebrow, LinkButton, Placeholder, PrimaryButton, Row, ScreenHeader, SectionTitle, StatTile, T } from '../ui';

const VIEWS: PhotoView[] = ['frente', 'perfil', 'espalda'];

/** Change of a measurement vs. the closest entry ≥ 21 days earlier (or the first one). */
function delta<T extends { date: ISODate }>(xs: T[], pick: (x: T) => number | undefined) {
  const list = xs.filter((x) => pick(x) !== undefined).sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = list.at(-1);
  if (!last || list.length < 2) return { value: last ? pick(last) : undefined, delta: undefined };
  const ref = list.filter((x) => daysBetween(x.date, last.date) >= 21).at(-1) ?? list[0];
  return { value: pick(last), delta: (pick(last) as number) - (pick(ref) as number) };
}

function WeightCard() {
  const nav = useNav();
  const weighIns = useStore((s) => s.weighIns);
  const { rate } = useDerived();
  const recent = weighIns.filter((w) => w.date > addDays(todayISO(), -28));
  const ma = movingAverage(weighIns).filter((w) => w.date > addDays(todayISO(), -28));
  return (
    <Card gap={10}>
      <Eyebrow>EN AYUNAS · MEDIA MÓVIL 7 D</Eyebrow>
      <Row style={{ alignItems: 'baseline' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T style={cond(64, 900)}>{ma.length ? fmt(ma.at(-1)!.kg, 1) : '—'}</T>
          <T style={[mono(12), { color: C.muted }]}>KG</T>
        </View>
        <T style={[mono(12), { color: rate === null ? C.muted : rate <= 0 ? C.lime : C.coral }]}>{rate === null ? 'SIN TENDENCIA' : `${fmtSigned(rate, 2)} KG/SEM`}</T>
      </Row>
      {recent.length >= 2 ? (
        <WeightChart raw={recent.map((w) => w.kg)} ma={ma.map((w) => w.kg)} />
      ) : (
        <Empty text="Pésate cada mañana en ayunas: la media de 7 días filtra el ruido de agua y glucógeno." />
      )}
      <Row style={{ gap: 12 }}>
        <T style={[mono(10, 500, 1.4), { color: C.dim, flex: 1 }]}>PUNTOS: PESAJE DIARIO · LÍNEA: MEDIA 7 D · 28 DÍAS</T>
        <LinkButton label="+ PESAJE" onPress={() => nav.navigate('BodyEntry')} />
      </Row>
    </Card>
  );
}

function PerimetersCard() {
  const perimeters = useStore((s) => s.perimeters);
  const rows: [string, (p: Perimeters) => number | undefined, boolean][] = [
    ['Cintura', (p) => p.waist, false],
    ['Pecho', (p) => p.chest, true],
    ['Brazo', (p) => p.arm, true],
    ['Muslo', (p) => p.thigh, true],
  ];
  return (
    <Card gap={0}>
      <Eyebrow style={{ paddingBottom: 6 }}>PERÍMETROS · CM · VS 4 SEM</Eyebrow>
      {rows.map(([k, pick, upIsGood], i) => {
        const d = delta(perimeters, pick);
        const good = d.delta === undefined ? undefined : upIsGood ? d.delta >= 0 : d.delta <= 0;
        const last = i === rows.length - 1;
        return (
          <Row key={k} style={{ alignItems: 'baseline', paddingTop: 10, paddingBottom: last ? 0 : 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
            <T style={body(15, 600)}>{k}</T>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'baseline' }}>
              <T style={[mono(11), { color: good === undefined ? C.muted : good ? C.lime : C.coral }]}>{d.delta === undefined ? '' : fmtSigned(d.delta, 1)}</T>
              <T style={cond(22)}>{d.value === undefined ? '—' : fmt(d.value, 1)}</T>
            </View>
          </Row>
        );
      })}
    </Card>
  );
}

function Gallery() {
  const photos = useStore((s) => s.photos);
  const addPhoto = useStore((s) => s.addPhoto);
  const removePhoto = useStore((s) => s.removePhoto);
  const foods = useStore((s) => s.foods);
  const coach = useStore((s) => s.coach);
  const { weightOn } = useDerived();
  const day = todayISO();
  const thisWeek = startOfWeek(day);
  const weeks = [...new Set([thisWeek, ...photos.map((p) => startOfWeek(p.date))])].sort().reverse();

  /** Auto-tags: 7-day weight average, mean kcal/protein of the week and training phase. */
  const tagsFor = (date: ISODate): ProgressPhoto['tags'] => {
    const wk = foods.filter((f) => f.date > addDays(date, -7) && f.date <= date);
    const days = new Set(wk.map((f) => f.date)).size;
    const mesoWeek = Math.floor(daysBetween(coach.mesoStart, date) / 7) + 1;
    return {
      weightKg: +weightOn(date).toFixed(1),
      kcalAvg: days ? Math.round(wk.reduce((a, f) => a + f.kcal, 0) / days) : undefined,
      proteinAvg: days ? Math.round(wk.reduce((a, f) => a + f.p, 0) / days) : undefined,
      phase: coach.deloadWeekOf === startOfWeek(date) ? 'DESCARGA' : `ACUMULACIÓN · S${Math.max(1, mesoWeek)}`,
    };
  };

  const add = async (view: PhotoView) => {
    const name = await pickPhoto();
    if (name) addPhoto({ id: uid(), date: day, view, uri: name, tags: tagsFor(day) });
  };
  const remove = (p: ProgressPhoto) =>
    Alert.alert('Eliminar foto', `${p.view} · ${shortDay(p.date)}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deletePhotoFile(p); removePhoto(p.id); } },
    ]);

  return (
    <Card gap={16}>
      <SectionTitle eyebrow="HISTORIAL VISUAL" title="Frente · perfil · espalda" />
      {weeks.map((w) => {
        const wp = photos.filter((p) => startOfWeek(p.date) === w);
        const tags = wp[0]?.tags;
        const current = w === thisWeek;
        return (
          <View key={w} style={{ gap: 8 }}>
            <Row style={{ alignItems: 'baseline' }}>
              <T style={[cond(18), { textTransform: 'uppercase' }]}>{current ? 'Esta semana' : `Semana del ${shortDay(w).toLowerCase()}`}</T>
              <T style={[mono(11, 500), { color: C.muted }]}>{wp[0] ? shortDay(wp[0].date) : current ? 'PENDIENTE' : ''}</T>
            </Row>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {VIEWS.map((v) => {
                const p = wp.find((x) => x.view === v);
                return (
                  <Pressable key={v} style={{ flex: 1 }} onPress={() => (p ? remove(p) : current && add(v))} disabled={!p && !current} accessibilityLabel={p ? `Foto ${v}` : `Añadir foto ${v}`}>
                    {p ? (
                      <Image source={{ uri: photoUri(p) }} style={{ height: 116, borderRadius: 10, backgroundColor: C.chip }} resizeMode="cover" />
                    ) : (
                      <Placeholder label={current ? `+ ${v}` : v} height={116} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            {tags && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {tags.weightKg !== undefined && <Chip label={`${fmt(tags.weightKg, 1)} KG`} bg={C.lime} color={C.bg} border={C.lime} />}
                {tags.kcalAvg !== undefined && <Chip label={`${fmt(tags.kcalAvg)} KCAL/DÍA · P${tags.proteinAvg}`} />}
                {tags.phase && <Chip label={tags.phase} />}
              </View>
            )}
          </View>
        );
      })}
      <T style={[mono(10, 500, 1.4), { color: C.dim }]}>TOCA UNA FOTO PARA ELIMINARLA. SE ETIQUETAN SOLAS CON PESO, MACROS Y FASE.</T>
    </Card>
  );
}

export function CuerpoScreen() {
  const nav = useNav();
  const bodyComps = useStore((s) => s.bodyComps);
  const fat = delta(bodyComps, (b) => b.fatPct);
  const smm = delta(bodyComps, (b) => b.smmKg);
  return (
    <Screen>
      <ScreenHeader eyebrow="COMPOSICIÓN CORPORAL" title="Peso y medidas" />
      <WeightCard />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="GRASA CORPORAL" value={fat.value !== undefined ? `${fmt(fat.value, 1)}%` : '—'} sub={fat.delta !== undefined ? `${fmtSigned(fat.delta, 1)} · 4 SEM` : 'SIN DATOS'} subColor={fat.delta !== undefined && fat.delta <= 0 ? C.lime : C.muted} size={40} />
        <StatTile label="MASA MUSC. ESQ." value={smm.value !== undefined ? `${fmt(smm.value, 1)} KG` : '—'} sub={smm.delta !== undefined ? `${fmtSigned(smm.delta, 1)} · 4 SEM` : 'SIN DATOS'} subColor={smm.delta !== undefined && smm.delta >= 0 ? C.lime : C.muted} size={40} />
      </View>
      <PerimetersCard />
      <PrimaryButton label="Registrar medidas" onPress={() => nav.navigate('BodyEntry')} height={46} />
      <Gallery />
    </Screen>
  );
}
