import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useUi } from '../navigation';
import { useStore } from '../store';
import { nightlyHrv } from './hrv';

const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const;

/**
 * Reads overnight HRV (SDNN, written to Apple Health by the Zepp app) for the last 10 days on
 * launch and whenever the app returns to the foreground, and stores it as `hrvMs` per day.
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
        await hk.requestAuthorization({ toRead: [HRV] });
        const startDate = new Date(Date.now() - 10 * 864e5);
        const samples = await hk.queryQuantitySamples(HRV, { limit: 0, unit: 'ms', filter: { date: { startDate } } });
        const days = nightlyHrv(samples.map((s) => ({ value: s.quantity, start: new Date(s.startDate) })));
        const { setActivity } = useStore.getState();
        for (const [date, hrvMs] of Object.entries(days)) setActivity({ date, hrvMs });
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
