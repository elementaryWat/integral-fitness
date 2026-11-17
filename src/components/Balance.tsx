import { View } from 'react-native';
import { fmt } from '../data';
import { BALANCE_LABEL } from '../engines/balance';
import { useDerived } from '../store/derived';
import { C, body, cond } from '../theme';
import { Card, Eyebrow, Row, T } from '../ui';

/** Weekly 80/20 split (upper + core vs lower) and push:pull ratio over the last 7 days. */
export function Engine8020Card() {
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
