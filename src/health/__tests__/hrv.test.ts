import { nightlyHrv } from '../hrv';

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
