import type { ReactNode } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Hatch } from './components/charts';
import { C, body, cond, em, mono } from './theme';

/** Text with design defaults (light text color). */
export function T({ style, children, lines }: { style?: StyleProp<TextStyle>; children: ReactNode; lines?: number }) {
  return (
    <Text style={[{ color: C.text }, style]} numberOfLines={lines} allowFontScaling={false}>
      {children}
    </Text>
  );
}

export function Card({ children, gap = 12, radius = 20, padding = 16, style }: { children: ReactNode; gap?: number; radius?: number; padding?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: radius, padding, gap }, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children, color = C.muted, spacing = 0.12, style }: { children: ReactNode; color?: string; spacing?: number; style?: StyleProp<TextStyle> }) {
  return <T style={[mono(10), { letterSpacing: em(10, spacing), color }, style]}>{children}</T>;
}

export function ScreenHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: 4, paddingTop: 6, paddingHorizontal: 2, paddingBottom: 2 }}>
      <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.muted }]}>{eyebrow}</T>
      <T style={[cond(40), { textTransform: 'uppercase' }]}>{title}</T>
      {sub ? <T style={[mono(12, 500), { color: C.muted }]}>{sub}</T> : null}
    </View>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <T style={[cond(24), { textTransform: 'uppercase' }]}>{title}</T>
    </View>
  );
}

export function StatTile({ label, value, sub, subColor, size = 38 }: { label: string; value: string; sub: string; subColor?: string; size?: number }) {
  return (
    <Card radius={16} padding={14} gap={6} style={{ flex: 1 }}>
      <Eyebrow spacing={0.08}>{label}</Eyebrow>
      <T style={cond(size, 900)}>{value}</T>
      <T style={[subColor ? mono(11) : body(11), { color: subColor ?? C.muted }]}>{sub}</T>
    </Card>
  );
}

/** Two equal columns. */
export function Grid2({ children, gap = 8 }: { children: [ReactNode, ReactNode]; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {children}
    </View>
  );
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, style]}>{children}</View>
);

/** Pill-group selector with lime highlight on the active option. */
export function Segmented<V extends string | number>({
  options, value, onChange, height, radius, outerRadius, render,
}: {
  options: readonly V[];
  value: V;
  onChange: (v: V) => void;
  height: number;
  radius: number;
  outerRadius: number;
  render: (v: V, active: boolean) => ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: outerRadius, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, height, borderRadius: radius, backgroundColor: on ? C.lime : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            {render(o, on)}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small filled or outlined chip. */
export function Chip({ label, bg = 'transparent', color = C.soft, border = C.border, size = 10 }: { label: string; bg?: string; color?: string; border?: string; size?: number }) {
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <T style={[mono(size), { color }]}>{label}</T>
    </View>
  );
}

/** Diagonal-hatched photo placeholder. */
export function Placeholder({ label, height, radius = 10, highlight }: { label: string; height: number; radius?: number; highlight?: boolean }) {
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', borderWidth: highlight ? 1 : 0, borderColor: C.lime, justifyContent: 'flex-end', padding: 8 }}>
      <Hatch />
      <T style={[mono(10, 500), { color: C.muted }]}>{label}</T>
    </View>
  );
}

/** Lime primary action (pill). */
export function PrimaryButton({ label, onPress, disabled, height = 48 }: { label: string; onPress: () => void; disabled?: boolean; height?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ height, borderRadius: height / 2, backgroundColor: disabled ? '#4c504a' : C.lime, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
    >
      <T style={[cond(18), { color: C.bg, textTransform: 'uppercase' }]}>{label}</T>
    </Pressable>
  );
}

/** Outlined secondary action (pill, mono caps). */
export function GhostButton({ label, onPress, height = 44, color = C.soft }: { label: string; onPress: () => void; height?: number; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ height, borderRadius: height / 2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: pressed ? C.chip : 'transparent' })}
    >
      <T style={[mono(11), { color, letterSpacing: em(11, 0.08) }]}>{label}</T>
    </Pressable>
  );
}

/** Small text link in lime mono caps, e.g. "REGISTRAR →". */
export function LinkButton({ label, onPress, color = C.lime }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <T style={[mono(11), { color, letterSpacing: em(11, 0.06) }]}>{label}</T>
    </Pressable>
  );
}

/** Labelled numeric/text input styled like the cards. */
export function Field({
  label, value, onChange, keyboard = 'decimal-pad', placeholder, suffix, flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'decimal-pad' | 'number-pad' | 'default';
  placeholder?: string;
  suffix?: string;
  flex?: boolean;
}) {
  return (
    <View style={{ gap: 6, flex: flex ? 1 : undefined }}>
      <Eyebrow spacing={0.08}>{label}</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.chip, borderRadius: 12, paddingHorizontal: 12, height: 48 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          placeholder={placeholder}
          placeholderTextColor={C.dim}
          allowFontScaling={false}
          style={[cond(24, 700), { flex: 1, color: C.text, padding: 0 }]}
        />
        {suffix ? <T style={[mono(11), { color: C.muted }]}>{suffix}</T> : null}
      </View>
    </View>
  );
}

/** Wrap-around chip selector (single or multi). */
export function ChipSelect<V extends string | number>({
  options, selected, onToggle, label, color = C.lime,
}: {
  options: readonly { value: V; label: string }[];
  selected: readonly V[];
  onToggle: (v: V) => void;
  label?: string;
  color?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Eyebrow spacing={0.08}>{label}</Eyebrow> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onToggle(o.value)}
              accessibilityState={{ selected: on }}
              style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: on ? color : C.border, backgroundColor: on ? color : 'transparent', justifyContent: 'center' }}
            >
              <T style={[mono(11), { color: on ? C.bg : C.soft }]}>{o.label.toUpperCase()}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Muted placeholder for cards without data yet, with an optional action. */
export function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ gap: 10, paddingVertical: 6 }}>
      <T style={[body(13, 400, 1.4), { color: C.muted }]}>{text}</T>
      {action && onAction ? <LinkButton label={action} onPress={onAction} /> : null}
    </View>
  );
}

/** Header for stacked screens: eyebrow, title and a close/back control. */
export function SheetHeader({ eyebrow, title, onClose, closeLabel = 'CERRAR' }: { eyebrow: string; title: string; onClose: () => void; closeLabel?: string }) {
  return (
    <Row style={{ alignItems: 'flex-start', gap: 12, paddingTop: 6 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <T style={[mono(11), { letterSpacing: em(11, 0.12), color: C.lime }]}>{eyebrow}</T>
        <T style={[cond(32), { textTransform: 'uppercase' }]}>{title}</T>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, justifyContent: 'center' }}>
        <T style={mono(11)}>{closeLabel}</T>
      </Pressable>
    </Row>
  );
}

/** Parse a user-typed decimal ("82,5" or "82.5"); undefined when empty/invalid. */
export const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
};

/** Native action sheet on iOS, alert with buttons elsewhere. */
export function actions(title: string, options: { label: string; onPress: () => void; destructive?: boolean }[]) {
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Cancelar'];
    const destructiveButtonIndex = options.findIndex((o) => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined, userInterfaceStyle: 'dark' },
      (i) => options[i]?.onPress(),
    );
  } else {
    Alert.alert(title, undefined, [...options.map((o) => ({ text: o.label, onPress: o.onPress, style: o.destructive ? ('destructive' as const) : ('default' as const) })), { text: 'Cancelar', style: 'cancel' }]);
  }
}
