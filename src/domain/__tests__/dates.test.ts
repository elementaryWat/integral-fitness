import { dayName } from '../dates';

describe('dayName', () => {
  it('names nearby days and dates the rest', () => {
    expect(dayName('2026-11-15', '2026-11-15')).toBe('HOY');
    expect(dayName('2026-11-14', '2026-11-15')).toBe('AYER');
    expect(dayName('2026-11-16', '2026-11-15')).toBe('MAÑANA');
    expect(dayName('2026-11-12', '2026-11-15')).toBe('JUE 12 NOV');
  });
});
