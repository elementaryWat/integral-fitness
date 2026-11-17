import { groupByMeal, mealForHour, portionPresets, portionStep } from '../meals';

describe('meals', () => {
  it('picks a meal from the hour', () => {
    expect(mealForHour(8)).toBe('desayuno');
    expect(mealForHour(13)).toBe('almuerzo');
    expect(mealForHour(17)).toBe('snack');
    expect(mealForHour(21)).toBe('cena');
    expect(mealForHour(2)).toBe('snack');
  });

  it('groups by meal in order with subtotals and keeps old entries apart', () => {
    const g = groupByMeal([
      { meal: 'cena' as const, kcal: 500 },
      { meal: 'desayuno' as const, kcal: 300 },
      { meal: 'desayuno' as const, kcal: 100 },
      { kcal: 50 },
    ]);
    expect(g.map((x) => x.label)).toEqual(['Desayuno', 'Almuerzo', 'Snack', 'Cena', 'Sin asignar']);
    expect(g[0].kcal).toBe(400);
    expect(g[1].items).toHaveLength(0);
    expect(g[4].kcal).toBe(50);
    expect(groupByMeal([])).toHaveLength(4);
  });

  it('offers portion presets around the detected portion', () => {
    expect(portionPresets(160).map((p) => p.grams)).toEqual([80, 160, 240, 320]);
    expect(portionPresets(33).map((p) => p.grams)).toEqual([15, 35, 50, 65]);
    expect(portionPresets(0)).toEqual([]);
    expect(portionStep(40)).toBe(5);
    expect(portionStep(150)).toBe(10);
    expect(portionStep(400)).toBe(25);
  });
});
