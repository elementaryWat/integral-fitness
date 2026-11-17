export type Meal = 'desayuno' | 'almuerzo' | 'snack' | 'cena';

export const MEALS: readonly { key: Meal; label: string }[] = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'almuerzo', label: 'Almuerzo' },
  { key: 'snack', label: 'Snack' },
  { key: 'cena', label: 'Cena' },
];

export const mealLabel = (m?: Meal) => MEALS.find((x) => x.key === m)?.label ?? 'Sin asignar';

/** Sensible default for "now": breakfast until 11, lunch until 16, snack until 19, then dinner. */
export function mealForHour(h: number): Meal {
  if (h >= 5 && h < 11) return 'desayuno';
  if (h >= 11 && h < 16) return 'almuerzo';
  if (h >= 16 && h < 19) return 'snack';
  if (h >= 19) return 'cena';
  return 'snack';
}

/** Foods grouped by meal, always the four meals in order, plus "sin asignar" for old entries. */
export function groupByMeal<T extends { meal?: Meal; kcal: number }>(xs: T[]) {
  const groups: { meal?: Meal; label: string; items: T[]; kcal: number }[] = MEALS.map((m) => ({ meal: m.key, label: m.label, items: [], kcal: 0 }));
  const other = { meal: undefined, label: 'Sin asignar', items: [] as T[], kcal: 0 };
  for (const x of xs) {
    const g = groups.find((y) => y.meal === x.meal) ?? other;
    g.items.push(x);
    g.kcal += x.kcal;
  }
  return other.items.length ? [...groups, other] : groups;
}

/** Quick portion presets relative to the detected portion (½, 1, 1½, 2), rounded to 5 g. */
export function portionPresets(base: number) {
  if (!(base > 0)) return [];
  return [0.5, 1, 1.5, 2].map((k) => ({ k, grams: Math.max(5, Math.round((base * k) / 5) * 5) }));
}

/** Step for the −/+ buttons: finer for small portions. */
export const portionStep = (grams: number) => (grams < 60 ? 5 : grams < 300 ? 10 : 25);
