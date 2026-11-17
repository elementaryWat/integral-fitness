// JSON schemas for OpenAI Structured Outputs (strict mode: every property required,
// optional values expressed as `null`, no additional properties). Enum values mirror the
// app's domain types in src/domain/types.ts and src/domain/muscles.ts.

export const MUSCLES = ['pecho', 'delt', 'bic', 'ante', 'abs', 'obl', 'quad', 'gem', 'trap', 'dors', 'deltp', 'tri', 'lumb', 'glut', 'isq'];

const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const num = { type: 'number' };
const str = { type: 'string' };
const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
const macros = obj({ kcal: num, p: num, c: num, f: num });

export const FOOD_SCAN = {
  name: 'food_scan',
  schema: obj({
    kind: { type: 'string', enum: ['plato', 'etiqueta', 'ticket'] },
    title: str,
    items: {
      type: 'array',
      items: obj({
        name: str,
        grams: num,
        kcal: num,
        p: num,
        c: num,
        f: num,
        per100: nullable(macros),
        confidence: { type: 'string', enum: ['alta', 'media', 'baja'] },
      }),
    },
    notes: str,
  }),
};

export const EXERCISE_DRAFT = {
  name: 'exercise_draft',
  schema: obj({
    name: str,
    discipline: { type: 'string', enum: ['Pesas', 'Calistenia', 'Core', 'Cardio'] },
    loadMode: { type: 'string', enum: ['peso', 'lastre', 'corporal', 'palanca', 'tiempo'] },
    pattern: { type: 'string', enum: ['empuje', 'traccion', 'pierna', 'bisagra', 'core', 'aislamiento', 'aerobico'] },
    plane: nullable({ type: 'string', enum: ['horizontal', 'vertical'] }),
    region: { type: 'string', enum: ['superior', 'inferior', 'core'] },
    unit: { type: 'string', enum: ['reps', 's', 'min'] },
    primary: { type: 'array', items: { type: 'string', enum: MUSCLES } },
    secondary: { type: 'array', items: { type: 'string', enum: MUSCLES } },
    step: num,
    defaultLoad: num,
    defaultReps: num,
    repMin: num,
    repMax: num,
    levers: nullable({ type: 'array', items: str }),
    legImpact: nullable({ type: 'string', enum: ['bajo', 'alto'] }),
    notes: str,
    technique: obj({
      setup: { type: 'array', items: str },
      steps: { type: 'array', items: str },
      mistakes: { type: 'array', items: str },
      feel: { type: 'array', items: { type: 'string', enum: MUSCLES } },
      tip: nullable(str),
    }),
  }),
};

export const COACH_NARRATIVE = {
  name: 'coach_narrative',
  schema: obj({
    headline: str,
    summary: str,
    wins: { type: 'array', items: str },
    watch: { type: 'array', items: str },
    photoNote: nullable(str),
  }),
};

/** Physique read from progress photos, contrasted with the user's data. */
export const PHYSIQUE = {
  name: 'physique_review',
  schema: obj({
    headline: str,
    observations: { type: 'array', items: str },
    strengths: { type: 'array', items: str },
    priorities: { type: 'array', items: str },
    bodyFat: nullable(obj({ low: { type: 'number' }, high: { type: 'number' }, note: str })),
    dataCheck: str,
    comparison: nullable(str),
    actions: { type: 'array', items: str },
  }),
};

/** Routine schema built per request: exercise ids are limited to the user's own library. */
export function routineFormat(ids) {
  return {
    name: 'ai_routine',
    schema: obj({
      name: str,
      rationale: str,
      blocks: {
        type: 'array',
        items: obj({
          exerciseIds: { type: 'array', items: { type: 'string', enum: ids } },
          rounds: { type: 'integer' },
          why: str,
        }),
      },
    }),
  };
}
