import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useUi } from '../navigation';
import { useStore } from '../store';
import { nightlyHrv, nightlySleep } from './hrv';

const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const;
const RHR = 'HKQuantityTypeIdentifierRestingHeartRate' as const;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Reads Apple Health (written there by the Zepp app) on launch and whenever the app returns to
 * the foreground, for the last 10 days:
 *  - overnight HRV (SDNN) as `hrvMs`;
 *  - resting HR and sleep stages, only for days the watch itself did not report (the mini-app
 *    only sends them when opened, Apple Health fills the gaps in the background).
 */
export function useHealthSync() {
  const hasProfile = useStore((s) => !!s.profile);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !hasProfile) return;
    let busy = false;
    const sync = async () => {
      if (busy) return;
      busy = true;
      try {
        // Required here (not imported at the top) so a missing native module only fails this sync, never app start.
         
        const hk: typeof import('@kingstinct/react-native-healthkit') = require('@kingstinct/react-native-healthkit');
        if (!hk.isHealthDataAvailable()) {
          useUi.getState().setHealth('Salud no disponible');
          return;
        }
        await hk.requestAuthorization({ toRead: [HRV, RHR, SLEEP] });
        const startDate = new Date(Date.now() - 10 * 864e5);
        const samples = await hk.queryQuantitySamples(HRV, { limit: 0, unit: 'ms', filter: { date: { startDate } } });
        const days = nightlyHrv(samples.map((s) => ({ value: s.quantity, start: new Date(s.startDate) })));
        const { setActivity } = useStore.getState();
        for (const [date, hrvMs] of Object.entries(days)) setActivity({ date, hrvMs });
        const has = (date: string, k: 'restingHr' | 'sleepMin') => !!useStore.getState().activity.find((a) => a.date === date)?.[k];
        try {
          const rhr = await hk.queryQuantitySamples(RHR, { limit: 0, unit: 'count/min', filter: { date: { startDate } } });
          const byDay = new Map<string, number>();
          for (const r of rhr) byDay.set(localISO(new Date(r.startDate)), Math.round(r.quantity));
          for (const [date, restingHr] of byDay) if (!has(date, 'restingHr') && restingHr > 25 && restingHr < 130) setActivity({ date, restingHr });
        } catch { /* no resting HR permission or data */ }
        try {
          const sl = await hk.queryCategorySamples(SLEEP, { limit: 0, filter: { date: { startDate } } });
          const nights = nightlySleep(sl.map((x) => ({ value: Number(x.value), start: new Date(x.startDate), end: new Date(x.endDate) })));
          for (const [date, n] of Object.entries(nights)) if (!has(date, 'sleepMin') && n.sleepMin > 60) setActivity({ date, ...n });
        } catch { /* no sleep permission or data */ }
        useUi.getState().setHealth(samples.length ? `salud: ${samples.length} muestras` : 'salud: 0 muestras HRV');
      } catch (e) {
        useUi.getState().setHealth(`salud: ${e instanceof Error ? e.message.slice(0, 60) : 'error'}`);
      } finally {
        busy = false;
      }
    };
    sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, [hasProfile]);
}
