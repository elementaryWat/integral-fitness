// AI endpoints under /v1/:code/ai/* (scan, food, exercise, coach, physique, routine, status). Only pairing codes listed in AI_ACCESS_CODES may spend
// tokens, each with a daily quota. Images are forwarded to the model and never stored or logged.
import { AiError } from './client.js';
import { COACH_NARRATIVE, EXERCISE_DRAFT, FOOD_SCAN, PHYSIQUE, routineFormat } from './schemas.js';
import { COACH_SYSTEM, EXERCISE_SYSTEM, FOOD_TEXT_SYSTEM, PHYSIQUE_SYSTEM, ROUTINE_SYSTEM, SCAN_SYSTEM } from './prompts.js';

const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Accepts `image/jpg` (what iOS reports) and stray whitespace in the base64 payload. */
function normalizeImage(url) {
  if (typeof url !== 'string') return url;
  return url.replace(/^data:image\/jpg;/i, 'data:image/jpeg;').replace(/^(data:[^,]+,)(.*)$/s, (_, head, b64) => head.toLowerCase() + b64.replace(/\s+/g, ''));
}
const MAX_IMAGE_CHARS = 7 * 1024 * 1024;
const HINTS = { plato: 'Es una foto de un plato de comida.', etiqueta: 'Es una etiqueta nutricional.', ticket: 'Es un ticket de supermercado.' };

export function accessCodes(env = process.env) {
  return new Set(String(env.AI_ACCESS_CODES ?? '').split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean));
}

/** Per-code daily counter (in memory; resets on restart, which only ever makes it more permissive). */
export class Quota {
  constructor(limit) {
    this.limit = limit;
    this.used = new Map();
  }

  take(code, now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    const u = this.used.get(code);
    const count = u && u.day === day ? u.count : 0;
    if (count >= this.limit) throw new AiError(429, 'quota', `Has llegado al límite diario de ${this.limit} peticiones de IA.`);
    this.used.set(code, { day, count: count + 1 });
    return this.limit - count - 1;
  }
}

const image = (raw, detail = 'high') => {
  const url = normalizeImage(raw);
  if (typeof url !== 'string' || url.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(url)) {
    throw new AiError(400, 'bad_image', 'La imagen debe ser JPEG, PNG o WebP en base64 (máx. ~5 MB).');
  }
  return { type: 'input_image', image_url: url, detail };
};

export async function handleAi({ action, code, body, ai, quota, codes }) {
  if (action === 'status') {
    return { enabled: ai.enabled && codes.has(code), model: ai.model, remaining: quota.limit - (quota.used.get(code)?.day === new Date().toISOString().slice(0, 10) ? quota.used.get(code).count : 0) };
  }
  if (!codes.has(code)) throw new AiError(403, 'not_allowed', 'Este código no tiene acceso a la IA. Añádelo a AI_ACCESS_CODES en el servidor.');
  if (!ai.enabled) throw new AiError(503, 'ai_disabled', 'La IA no está configurada en el servidor (falta OPENAI_API_KEY).');

  switch (action) {
    case 'scan': {
      const hint = HINTS[body?.hint] ?? 'Decide si es un plato, una etiqueta o un ticket.';
      const img = image(body?.image);
      quota.take(code);
      return ai.structured({ system: SCAN_SYSTEM, format: FOOD_SCAN, content: [{ type: 'input_text', text: hint }, img] });
    }
    case 'food': {
      const text = String(body?.text ?? '').trim();
      if (text.length < 3 || text.length > 500) throw new AiError(400, 'bad_text', 'Describe lo que comiste en 3–500 caracteres.');
      quota.take(code);
      return ai.structured({ system: FOOD_TEXT_SYSTEM, format: FOOD_SCAN, content: [{ type: 'input_text', text: `Comida: ${text}` }] });
    }
    case 'exercise': {
      const text = String(body?.text ?? '').trim();
      if (text.length < 3 || text.length > 300) throw new AiError(400, 'bad_text', 'Describe el ejercicio en 3–300 caracteres.');
      quota.take(code);
      return ai.structured({ system: EXERCISE_SYSTEM, format: EXERCISE_DRAFT, content: [{ type: 'input_text', text: `Ejercicio: ${text}` }] });
    }
    case 'coach': {
      if (!body?.review || typeof body.review !== 'object') throw new AiError(400, 'bad_review', 'Falta la revisión semanal.');
      const photos = Array.isArray(body.photos) ? body.photos.slice(0, 2) : [];
      const parts = photos.map((p) => image(p, 'low'));
      const data = JSON.stringify({ review: body.review, stats: body.stats ?? null }).slice(0, 40000);
      quota.take(code);
      const content = [{ type: 'input_text', text: `Datos de la semana (JSON):\n${data}` }];
      if (parts.length === 2) content.push({ type: 'input_text', text: 'Foto de frente — primera semana:' }, parts[0], { type: 'input_text', text: 'Foto de frente — última semana:' }, parts[1]);
      return ai.structured({ system: COACH_SYSTEM, format: COACH_NARRATIVE, content });
    }
    case 'physique': {
      // Up to 4 labelled photos (latest front/side/back + an older front). Forwarded, never stored or logged.
      const list = Array.isArray(body?.photos) ? body.photos.slice(0, 4) : [];
      if (!list.length) throw new AiError(400, 'no_photos', 'Falta al menos una foto.');
      const parts = list.map((p) => [{ type: 'input_text', text: String(p?.label ?? 'Foto').slice(0, 80) + ':' }, image(p?.image, 'high')]).flat();
      const data = JSON.stringify(body.data ?? {}).slice(0, 40000);
      quota.take(code);
      return ai.structured({ system: PHYSIQUE_SYSTEM, format: PHYSIQUE, content: [{ type: 'input_text', text: `Datos actuales (JSON):\n${data}` }, ...parts] });
    }
    case 'routine': {
      const catalog = Array.isArray(body?.catalog) ? body.catalog.filter((e) => e && typeof e.id === 'string').slice(0, 120) : [];
      if (catalog.length < 2) throw new AiError(400, 'bad_catalog', 'No hay suficientes ejercicios en tu biblioteca para esos grupos.');
      const ids = [...new Set(catalog.map((e) => e.id))];
      const context = JSON.stringify({
        groups: body.groups ?? [], minutes: body.minutes ?? 45, experience: body.experience ?? 'intermedio', goal: body.goal ?? null,
        deload: !!body.deload, muscles: body.muscles ?? {}, catalog,
      }).slice(0, 60000);
      quota.take(code);
      const out = await ai.structured({ system: ROUTINE_SYSTEM, format: routineFormat(ids), content: [{ type: 'input_text', text: `Datos (JSON):\n${context}` }] });
      // Never trust ids blindly: drop unknown ones and empty blocks.
      const known = new Set(ids);
      out.blocks = (out.blocks ?? []).map((b) => ({ ...b, exerciseIds: (b.exerciseIds ?? []).filter((id) => known.has(id)) })).filter((b) => b.exerciseIds.length);
      return out;
    }
    default:
      throw new AiError(404, 'not_found', 'Acción de IA desconocida.');
  }
}
