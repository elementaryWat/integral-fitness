import { useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

/** Scrollable page with the app's gutters; `sheet` screens add the bottom safe area themselves. */
export function Screen({ children, sheet }: { children: ReactNode; sheet?: boolean }) {
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollViewInstance>(null);
  useScrollToTop(ref as never);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: (sheet ? 16 : insets.top + 6), paddingHorizontal: 16, paddingBottom: sheet ? insets.bottom + 28 : 28 }}
      >
        <View style={{ gap: 12 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const screenBg = { backgroundColor: C.bg };
