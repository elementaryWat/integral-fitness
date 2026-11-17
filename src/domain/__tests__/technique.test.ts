import { SEED_EXERCISES } from '../catalog';
import { MUSCLE_KEYS } from '../muscles';
import { breathingFor, TECHNIQUE, techniqueOf, videoSearchUrl } from '../technique';

describe('technique', () => {
  it('covers every built-in exercise with usable cues', () => {
    for (const e of SEED_EXERCISES) {
      const t = TECHNIQUE[e.id];
      expect({ id: e.id, ok: !!t }).toEqual({ id: e.id, ok: true });
      expect(t.setup.length).toBeGreaterThan(0);
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      expect(t.mistakes.length).toBeGreaterThanOrEqual(2);
      for (const m of t.feel) expect(MUSCLE_KEYS).toContain(m);
      expect(breathingFor(e.pattern)).toBeTruthy();
    }
  });

  it('has no cues for exercises that do not exist', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    expect(Object.keys(TECHNIQUE).filter((k) => !ids.has(k))).toEqual([]);
  });

  it('prefers the exercise own technique', () => {
    const own = { setup: ['a'], steps: ['b', 'c'], mistakes: ['d', 'e'], feel: [] };
    expect(techniqueOf({ id: 'bench', technique: own })).toBe(own);
    expect(techniqueOf({ id: 'bench' })).toBe(TECHNIQUE.bench);
    expect(techniqueOf({ id: 'custom-x' })).toBeUndefined();
  });

  it('builds a YouTube search with only the exercise name', () => {
    expect(videoSearchUrl('Press banca')).toBe('https://www.youtube.com/results?search_query=Press%20banca%20t%C3%A9cnica%20correcta');
  });
});
