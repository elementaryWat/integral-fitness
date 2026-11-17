/**
 * Wrep — phone app paired with an Amazfit Bip 6 (Zepp OS mini-app, simulated in-app for now).
 */
import { useEffect } from 'react';
import { Pressable, StatusBar, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WatchSimulator } from './src/components/Watch';
import { addDays, daysBetween, today } from './src/domain/dates';
import { recalibrate } from './src/engines/energy';
import { useUi, type RootStackParamList, type TabParamList } from './src/navigation';
import { ActivityEntryScreen } from './src/screens/ActivityEntryScreen';
import { BodyEntryScreen } from './src/screens/BodyEntryScreen';
import { CoachScreen } from './src/screens/CoachScreen';
import { CuerpoScreen } from './src/screens/CuerpoScreen';
import { EntrenoScreen } from './src/screens/EntrenoScreen';
import { ExerciseEditScreen } from './src/screens/ExerciseEditScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { SessionSummaryScreen } from './src/screens/SessionSummaryScreen';
import { RecoveryDetailScreen } from './src/screens/RecoveryDetailScreen';
import { FoodAddScreen } from './src/screens/FoodAddScreen';
import { FoodScanScreen } from './src/screens/FoodScanScreen';
import { HoyScreen } from './src/screens/HoyScreen';
import { NutricionScreen } from './src/screens/NutricionScreen';
import { OnboardingScreen, ProfileEditScreen } from './src/screens/OnboardingScreen';
import { WatchPairScreen } from './src/screens/WatchPairScreen';
import { ExercisePickerScreen } from './src/screens/ExercisePickerScreen';
import { RoutinesScreen } from './src/screens/RoutinesScreen';
import { useWatchSync } from './src/watch/useWatchSync';
import { useHealthSync } from './src/health/useHealthSync';
import { LiveSessionProvider } from './src/session';
import { useStore } from './src/store';
import { DerivedProvider, energyContext } from './src/store/derived';
import { C, cond, em } from './src/theme';
import { T } from './src/ui';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_LABELS: Record<keyof TabParamList, string> = { Hoy: 'Hoy', Entreno: 'Entreno', Nutricion: 'Nutrición', Cuerpo: 'Cuerpo', Coach: 'Coach' };

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.chip, backgroundColor: '#000' }}
    >
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!on && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: 'center', gap: 7, paddingVertical: 6 }}>
            <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: on ? C.lime : 'transparent' }} />
            <T style={[cond(14, 700), { color: on ? C.text : C.dim, textTransform: 'uppercase', letterSpacing: em(14, 0.04) }]}>{TAB_LABELS[route.name as keyof TabParamList]}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const renderTabBar = (p: BottomTabBarProps) => <TabBar {...p} />;

function Tabs() {
  return (
    <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#000' } }}>
      <Tab.Screen name="Hoy" component={HoyScreen} />
      <Tab.Screen name="Entreno" component={EntrenoScreen} />
      <Tab.Screen name="Nutricion" component={NutricionScreen} />
      <Tab.Screen name="Cuerpo" component={CuerpoScreen} />
      <Tab.Screen name="Coach" component={CoachScreen} />
    </Tab.Navigator>
  );
}

/** Weekly TDEE recalibration, run on launch when a week has passed since the last one. */
function useWeeklyRecalibration() {
  useEffect(() => {
    const s = useStore.getState();
    if (!s.profile) return;
    const day = today();
    const last = s.coach.lastRecalibration?.date;
    if (last && daysBetween(last, day) < 7) return;
    const ex = Object.fromEntries(s.exercises.map((e) => [e.id, e]));
    // Use TDEE before any offset: the recalibration corrects the model, not the target.
    const ctx = energyContext({ ...s, coach: { ...s.coach, kcalOffset: 0, restDayKcal: 0 } }, ex, day);
    const r = recalibrate({ weighIns: s.weighIns, foods: s.foods.filter((f) => f.date < day), tdeeOn: (d) => ctx.energyOn(d).tdee, today: addDays(day, -1) });
    if (r && Math.abs(r.delta) >= 25) s.applyRecalibration(r, day);
  }, []);
}

const NavTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#000', card: '#000', primary: C.lime } };

function Root() {
  const hasProfile = useStore((s) => !!s.profile);
  const watchOpen = useUi((s) => s.watchOpen);
  const setWatchOpen = useUi((s) => s.setWatchOpen);
  useWeeklyRecalibration();
  useWatchSync();
  useHealthSync();
  return (
    <DerivedProvider>
    <LiveSessionProvider>
      <NavigationContainer theme={NavTheme}>
        <StatusBar barStyle="light-content" />
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
          {!hasProfile ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <>
              <Stack.Screen name="Tabs" component={Tabs} />
              <Stack.Group screenOptions={{ presentation: 'modal', contentStyle: { backgroundColor: C.bg } }}>
                <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
                <Stack.Screen name="ExerciseEdit" component={ExerciseEditScreen} />
                <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
                <Stack.Screen name="SessionSummary" component={SessionSummaryScreen} />
                <Stack.Screen name="RecoveryDetail" component={RecoveryDetailScreen} />
                <Stack.Screen name="FoodAdd" component={FoodAddScreen} />
                <Stack.Screen name="FoodScan" component={FoodScanScreen} />
                <Stack.Screen name="BodyEntry" component={BodyEntryScreen} />
                <Stack.Screen name="ActivityEntry" component={ActivityEntryScreen} />
                <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
                <Stack.Screen name="WatchPair" component={WatchPairScreen} />
                <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
                <Stack.Screen name="Routines" component={RoutinesScreen} />
              </Stack.Group>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <WatchSimulator visible={watchOpen} onClose={() => setWatchOpen(false)} />
    </LiveSessionProvider>
    </DerivedProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
