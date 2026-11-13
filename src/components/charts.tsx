import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Pattern, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { C, STATUS_COLOR, fmt } from '../data';
import type { MuscleKey } from '../domain/muscles';
import type { TrendSeries } from '../engines/trends';
import type { MuscleStatus } from '../engines/volume';
import { MUSCLES_BACK, MUSCLES_FRONT } from '../bodyPolygons';

const MONO = 'JetBrainsMono-SemiBold';
const MONO_MED = 'JetBrainsMono-Medium';

/** Diagonal hatch fill for photo placeholders (fills its parent absolutely). */
export function Hatch() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="hatch" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={14} height={14} fill="#111211" />
          <Rect width={7} height={14} fill="#171817" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hatch)" />
    </Svg>
  );
}

/** Circular progress ring used by the watch rest screen. */
export function Ring({ progress, color, size = 150 }: { progress: number; color: string; size?: number }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox="0 0 150 150" style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
      <Circle cx={75} cy={75} r={r} fill="none" stroke="#1d1f1d" strokeWidth={10} />
      <Circle
        cx={75} cy={75} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - Math.min(1, progress))}
      />
    </Svg>
  );
}

/** Front/back anatomical map; muscles colored by training status, selected one outlined. */
export function BodyMap({ view, selected, onSelect, status, width = 170 }: { view: 'front' | 'back'; selected: MuscleKey; onSelect: (k: MuscleKey) => void; status: (k: MuscleKey) => MuscleStatus; width?: number }) {
  const list = view === 'front' ? MUSCLES_FRONT : MUSCLES_BACK;
  // Draw the selected muscle last so its outline sits on top.
  const ordered = [...list.filter(([k]) => k !== selected), ...list.filter(([k]) => k === selected)];
  return (
    <Svg width={width} height={width * 2} viewBox="-5 -2 110 224" accessibilityLabel="Mapa muscular">
      {ordered.map(([k, polys], i) =>
        polys.map((points, j) => {
          const sel = k === selected;
          return (
            <Polygon
              key={`${view}-${k ?? 'x'}-${i}-${j}`}
              points={points}
              fill={k ? STATUS_COLOR[status(k)] : C.border}
              stroke={sel ? '#ffffff' : '#000000'}
              strokeWidth={sel ? 1.2 : 0.5}
              strokeLinejoin="round"
              onPress={k ? () => onSelect(k) : undefined}
            />
          );
        }),
      )}
    </Svg>
  );
}

/** Daily weigh-ins (dots) with their 7-day moving average (line), oldest first. */
export function WeightChart({ raw, ma }: { raw: number[]; ma: number[] }) {
  const W = 326, H = 120;
  if (raw.length < 2) return <View style={{ height: H }} />;
  const n = raw.length - 1;
  const mn = Math.min(...raw, ...ma) - 0.2, mx = Math.max(...raw, ...ma) + 0.2;
  const X = (i: number) => 6 + (i * (W - 12)) / n;
  const Y = (v: number) => 8 + ((mx - v) / (mx - mn)) * (H - 16);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="Peso diario y media móvil de 7 días">
      {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke={C.chip} />)}
      {raw.map((v, i) => <Circle key={i} cx={X(i)} cy={Y(v)} r={2.4} fill="#4c504a" />)}
      <Polyline points={ma.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.lime} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={X(n)} cy={Y(ma[n])} r={5} fill={C.lime} />
    </Svg>
  );
}

export type TrendKey = 'f' | 'm' | 'g' | 'b';

// [series, color, end label]
const TREND_LINES: [Exclude<TrendKey, 'b'>, string, (v: number) => string][] = [
  ['f', C.lime, (v) => (v >= 1 ? '+' : '−') + fmt(Math.abs(v - 1) * 100, 1) + '%'],
  ['m', C.cyan, (v) => fmt(v, 1) + ' kg'],
  ['g', C.coral, (v) => fmt(v, 1) + '%'],
];

/** Push end labels apart vertically so they never overlap (min 12 px). */
function spreadLabels(ys: number[], gap = 12) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const out = [...ys];
  order.forEach((o) => (out[o.i] = o.y));
  return out;
}

/** Weekly normalized trend lines (gaps skipped) plus mean daily kcal balance bars. */
export function TrendChart({ series, visible }: { series: TrendSeries; visible: Record<TrendKey, boolean> }) {
  const W = 326, H = 186, base = 146;
  const n = Math.max(1, series.weeks.length - 1);
  const X = (i: number) => 8 + (i * (W - 64)) / n;
  const mid = Math.round(n / 2);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`Tendencia de ${series.weeks.length} semanas`}>
      <Line x1={0} x2={W - 56} y1={base} y2={base} stroke={C.border} />
      {visible.b &&
        series.b.map((v, i) => {
          if (v === null) return null;
          const bh = Math.min(20, (Math.abs(v) / 400) * 20);
          return <Rect key={'b' + i} x={X(i) - 7} y={v < 0 ? base : base - bh} width={14} height={bh} rx={2} fill={v < 0 ? '#3a3d39' : C.amber} />;
        })}
      {(() => {
        const lines = TREND_LINES.filter(([k]) => visible[k]).map(([k, color, label]) => {
          const pts = series[k].map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
          if (!pts.length) return null;
          const mn = Math.min(...pts.map((p) => p.v)), mx = Math.max(...pts.map((p) => p.v));
          const Y = (v: number) => (mx === mn ? 57 : 104 - ((v - mn) / (mx - mn)) * 94);
          return { k, color, label, pts, Y, last: pts[pts.length - 1] };
        }).filter((l): l is NonNullable<typeof l> => l !== null);
        const labelY = spreadLabels(lines.map((l) => l.Y(l.last.v) + 4));
        return lines.map((l, idx) => (
          <G key={l.k}>
            {l.pts.length > 1 && <Polyline points={l.pts.map((p) => `${X(p.i)},${l.Y(p.v)}`).join(' ')} fill="none" stroke={l.color} strokeWidth={2.5} strokeLinejoin="round" />}
            <Circle cx={X(l.last.i)} cy={l.Y(l.last.v)} r={4} fill={l.color} />
            <SvgText x={X(l.last.i) + 8} y={labelY[idx]} fill={l.color} fontFamily={MONO} fontSize={10}>{l.label(l.last.v)}</SvgText>
          </G>
        ));
      })()}
      {[0, mid, n].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <SvgText key={i} x={X(i)} y={182} fill={C.dim} textAnchor="middle" fontFamily={MONO_MED} fontSize={10}>{`S${i + 1}`}</SvgText>
      ))}
    </Svg>
  );
}
