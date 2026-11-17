import { View, useWindowDimensions } from 'react-native';
import { Sparkline } from '../components/charts';
import { Screen } from '../components/Screen';
import { fmt } from '../data';
import { addDays, shortDay } from '../domain/dates';
import type { DailyActivity } from '../domain/types';
import { dayAdvice, lastWeek, SLEEP_TARGET_MIN, STEP_GOAL } from '../engines/recovery';
import { useNav, useUi } from '../navigation';
import { useStore } from '../store';
import { useDerived } from '../store/derived';
import { C, body, cond, mono } from '../theme';
import { Card, Eyebrow, GhostButton, Row, SheetHeader, T } from '../ui';

const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

interface Metric {
  key: string;
  label: string;
  pick: (a: DailyActivity) => number | undefined;
  format: (v: number) => string;
  /** true when lower is better (resting HR, stress) */
  lowerBetter?: boolean;
  note: string;
}

const METRICS: Metric[] = [
  { key: 'rhr', label: 'FC en reposo', pick: (a) => a.restingHr, format: (v) => `${Math.round(v)} lpm`, lowerBetter: true, note: 'Sube 3–5 lpm con fatiga, poco sueño, alcohol o enfermedad.' },
  { key: 'ns', label: 'Estrés nocturno', pick: (a) => a.nightStress, format: (v) => String(Math.round(v)), lowerBetter: true, note: 'Zepp lo calcula con la variabilidad del pulso (HRV) mientras duermes. Bajo = sistema nervioso recuperado.' },
  { key: 'sd', label: 'Estrés del día', pick: (a) => a.stressAvg, format: (v) => String(Math.round(v)), lowerBetter: true, note: '1–39 relajado · 40–59 normal · 60–79 medio · 80–100 alto.' },
  { key: 'hrv', label: 'HRV nocturno', pick: (a) => a.hrvMs, format: (v) => `${Math.round(v)} ms`, note: 'Solo si Apple Health lo tiene (otro dispositivo); el Bip 6 no lo comparte.' },
  { key: 'sl', label: 'Sueño total', pick: (a) => a.sleepMin, format: hm, note: `Referencia: ${hm(SLEEP_TARGET_MIN)} por noche si entrenas fuerte.` },
  { key: 'dp', label: 'Sueño profundo', pick: (a) => a.deepSleepMin, format: hm, note: 'Donde más se recupera el músculo; 13–23 % del total es lo habitual.' },
  { key: 'rem', label: 'REM', pick: (a) => a.remMin, format: hm, note: 'Recuperación mental y memoria motora (aprender técnica).' },
  { key: 'st', label: 'Pasos', pick: (a) => a.steps, format: (v) => fmt(v), note: `Objetivo ${fmt(STEP_GOAL)}: el NEAT es clave en déficit.` },
  { key: 'pai', label: 'PAI', pick: (a) => a.pai, format: (v) => String(Math.round(v)), note: 'Carga cardiovascular de Zepp; mantener ≥ 100 en 7 días.' },
];

/** Recovery in detail: each signal over the last 7 days, against its average, and how the score is built. */
export function RecoveryDetailScreen() {
  const nav = useNav();
  const { recovery: r, states, today } = useDerived();
  const activity = useStore((s) => s.activity);
  const health = useUi((s) => s.healthStatus);
  const { width } = useWindowDimensions();
  const advice = dayAdvice(r.score, states);
  const rows = METRICS.map((m) => ({ m, values: lastWeek(activity, today, m.pick) })).filter((x) => x.values.some((v) => v !== null));
  const missing = METRICS.filter((m) => !rows.some((x) => x.m.key === m.key)).map((m) => m.label.toLowerCase());

  return (
    <Screen sheet>
      <SheetHeader eyebrow="HOY · RECUPERACIÓN" title={r.score !== null ? `${r.score} · ${advice.title}` : advice.title} onClose={() => nav.goBack()} />
      <Card gap={6} style={{ borderWidth: 1, borderColor: C.lime }}>
        <T style={[body(14, 500, 1.4)]}>{advice.detail}</T>
        <T style={[mono(10, 500, 1.4), { color: C.muted }]}>
          {r.score === null
            ? 'SIN DATOS DE HOY: ABRE WREP EN EL RELOJ O ESPERA A QUE ZEPP SINCRONICE CON SALUD.'
            : r.provisional
              ? `PROVISIONAL (BASE ${Math.min(r.baseDays, 3)}/3 DÍAS): DE MOMENTO SOLO CUENTAN SUEÑO Y NIVEL DE ESTRÉS. CON 3 DÍAS SE COMPARA CON TU PROPIA MEDIA.`
              : 'COMPARA FC EN REPOSO, ESTRÉS NOCTURNO, HRV Y SUEÑO CON TU MEDIA DE 7 DÍAS.'}
        </T>
      </Card>

      {rows.map(({ m, values }) => {
        const today_ = values[6];
        const prev = values.slice(0, 6).filter((v): v is number => v !== null);
        const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
        const diff = today_ !== null && avg !== null ? today_ - avg : null;
        const good = diff === null || Math.abs(diff) < (avg ?? 1) * 0.03 ? null : m.lowerBetter ? diff < 0 : diff > 0;
        return (
          <Card key={m.key} gap={6}>
            <Row>
              <Eyebrow>{m.label.toUpperCase()}</Eyebrow>
              <T style={[mono(10, 500), { color: C.dim }]}>{avg !== null ? `MEDIA 7 D ${m.format(avg)}` : 'SIN MEDIA'}</T>
            </Row>
            <Row style={{ alignItems: 'flex-end' }}>
              <View style={{ gap: 2 }}>
                <T style={cond(30)}>{today_ !== null ? m.format(today_) : '—'}</T>
                <T style={[mono(10), { color: good === null ? C.muted : good ? C.lime : C.coral }]}>
                  {today_ === null ? 'SIN DATO HOY' : diff === null ? 'HOY' : `${diff > 0 ? '▲' : '▼'} ${m.format(Math.abs(diff))} VS MEDIA`}
                </T>
              </View>
              <Sparkline values={values.map((v) => v ?? 0)} width={Math.min(170, width * 0.42)} height={46} color={good === false ? C.coral : C.lime} />
            </Row>
            <Row>
              <T style={[mono(9, 500), { color: C.dim }]}>{shortDay(addDays(today, -6)).toUpperCase()}</T>
              <T style={[mono(9, 500), { color: C.dim }]}>HOY</T>
            </Row>
            <T style={[body(12, 400, 1.4), { color: C.muted }]}>{m.note}</T>
          </Card>
        );
      })}

      {missing.length ? (
        <T style={[mono(10, 500, 1.4), { color: C.dim, paddingHorizontal: 2 }]}>
          SIN DATOS AÚN: {missing.join(', ').toUpperCase()}. EL RELOJ LOS ENVÍA AL ABRIR WREP (ESTRÉS Y PAI DE TODA LA SEMANA); SALUD RELLENA FC EN REPOSO Y SUEÑO.{health ? ` · ${health.toUpperCase()}` : ''}
        </T>
      ) : null}
      <GhostButton label="REGISTRAR A MANO (HRV, SUEÑO, PASOS)" onPress={() => nav.navigate('ActivityEntry')} />
    </Screen>
  );
}
