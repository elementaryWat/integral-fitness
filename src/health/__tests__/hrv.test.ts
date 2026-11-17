import { nightlyHrv, nightlySleep } from '../hrv';

const at = (iso: string) => new Date(iso);

describe('nightly HRV', () => {
  it('averages night samples into the following morning and ignores daytime and outliers', () => {
    const days = nightlyHrv([
      { value: 40, start: at('2026-11-12T23:10:00') },
      { value: 50, start: at('2026-11-13T03:30:00') },
      { value: 90, start: at('2026-11-13T15:00:00') },
      { value: 900, start: at('2026-11-13T04:00:00') },
    ]);
    expect(days).toEqual({ '2026-11-13': 45 });
  });

  it('falls back to daytime readings when a day has no night samples', () => {
    expect(nightlyHrv([{ value: 62, start: at('2026-11-12T14:00:00') }])).toEqual({ '2026-11-12': 62 });
  });
});

describe('nightlySleep', () => {
  it('sums stages per night and attributes them to the morning', () => {
    const r = nightlySleep([
      { value: 0, start: at('2026-11-13T23:00:00'), end: at('2026-11-14T07:00:00') },
      { value: 3, start: at('2026-11-13T23:30:00'), end: at('2026-11-14T02:00:00') },
      { value: 4, start: at('2026-11-14T02:00:00'), end: at('2026-11-14T03:00:00') },
      { value: 5, start: at('2026-11-14T03:00:00'), end: at('2026-11-14T04:30:00') },
      { value: 2, start: at('2026-11-14T04:30:00'), end: at('2026-11-14T04:45:00') },
    ]);
    expect(r['2026-11-14']).toEqual({ sleepMin: 150 + 60 + 90, lightMin: 150, deepSleepMin: 60, remMin: 90, awakeMin: 15 });
  });
});
