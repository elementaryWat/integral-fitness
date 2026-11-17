import { Pressable, TextInput, View } from 'react-native';
import { fmt } from '../data';
import { MEALS, portionPresets, portionStep, type Meal } from '../domain/meals';
import { C, body, cond, mono } from '../theme';
import { Eyebrow, Segmented, T, num } from '../ui';

const g1 = (v: number) => (Math.round(v * 10) % 10 === 0 ? fmt(v) : fmt(v, 1));
const label = (k: number) => (k === 0.5 ? '½' : k === 1.5 ? '1½' : k === 1 ? '1×' : `${k}×`);

/**
 * Portion control: −/+ around the typed grams and quick multiples of the detected portion.
 * Macros are recalculated by the caller from the grams.
 */
export function PortionPicker({ grams, base, onChange }: { grams: string; base: number; onChange: (text: string) => void }) {
  const g = num(grams) ?? 0;
  const step = portionStep(g || base);
  const bump = (d: number) => onChange(String(Math.max(0, Math.round((g + d) / step) * step)));
  const presets = portionPresets(base);
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow spacing={0.08}>PORCIÓN</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StepButton label="−" onPress={() => bump(-step)} disabled={g <= 0} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.chip, borderRadius: 12, height: 52, paddingHorizontal: 12 }}>
          <TextInput
            value={grams}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            selectTextOnFocus
            allowFontScaling={false}
            accessibilityLabel="Gramos"
            style={[cond(30, 800), { color: C.text, padding: 0, minWidth: 50, textAlign: 'center' }]}
          />
          <T style={[mono(12), { color: C.muted }]}> G</T>
        </View>
        <StepButton label="+" onPress={() => bump(step)} />
      </View>
      {presets.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {presets.map((p) => {
            const on = g === p.grams;
            return (
              <Pressable
                key={p.k}
                onPress={() => onChange(String(p.grams))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center', gap: 1, backgroundColor: on ? C.lime : C.chip, opacity: pressed ? 0.7 : 1 })}
              >
                <T style={[cond(17), { color: on ? C.bg : C.text }]}>{label(p.k)}</T>
                <T style={[mono(9, 500), { color: on ? C.bg : C.muted }]}>{fmt(p.grams)} G</T>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function StepButton({ label: l, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={l === '+' ? 'Más gramos' : 'Menos gramos'}
      style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.6 : 1 })}
    >
      <T style={[cond(28), { color: C.lime }]}>{l}</T>
    </Pressable>
  );
}

/** Big kcal plus P/C/G for the current portion. */
export function MacroSummary({ kcal, p, c, f }: { kcal: number; p: number; c: number; f: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <T style={cond(38, 900)}>{fmt(kcal)}</T>
        <T style={[mono(11), { color: C.muted }]}>KCAL</T>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingBottom: 5 }}>
        {([['P', p, C.lime], ['C', c, C.cyan], ['G', f, C.amber]] as const).map(([k, v, color]) => (
          <T key={k} style={body(14, 600)}>
            <T style={[mono(11), { color }]}>{k} </T>{g1(v)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Desayuno · Almuerzo · Snack · Cena. */
export function MealPicker({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow spacing={0.08}>COMIDA</Eyebrow>
      <Segmented
        options={MEALS.map((m) => m.key)}
        value={value}
        onChange={onChange}
        height={36}
        radius={10}
        outerRadius={14}
        render={(m, on) => <T style={[cond(15), { color: on ? C.bg : C.soft, textTransform: 'uppercase' }]}>{MEALS.find((x) => x.key === m)?.label}</T>}
      />
    </View>
  );
}
