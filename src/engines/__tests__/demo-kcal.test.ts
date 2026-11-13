import { buildDemoData } from '../../store/demo';
it('demo meals average near a realistic intake', () => {
  const d = buildDemoData();
  const days = new Map<string, number>();
  d.foods!.forEach((f) => days.set(f.date, (days.get(f.date) ?? 0) + f.kcal));
  const avg = [...days.values()].reduce((a, b) => a + b, 0) / days.size;
  expect(avg).toBeGreaterThan(2200);
  expect(avg).toBeLessThan(2700);
});
