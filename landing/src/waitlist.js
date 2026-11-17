import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const QUESTIONS = {
  goal: { multi: false, options: ['Ganar músculo', 'Perder grasa', 'Recomposición (ambas)', 'Fuerza / rendimiento'] },
  phone: { multi: false, options: ['iPhone', 'Android'] },
  watch: { multi: false, options: ['Amazfit', 'Apple Watch', 'Garmin', 'Otro reloj', 'Ninguno'] },
  need: {
    multi: true,
    max: 2,
    options: [
      'Registrar series en el reloj',
      'Sesiones generadas',
      'Recuperación diaria',
      'Escaneo de comida con IA',
      'Coach IA semanal',
      'Fotos y medidas',
    ],
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida y normaliza una inscripción. Devuelve { ok, entry } o { ok: false, error }. */
export function validateEntry(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido' };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: 'Introduce un email válido' };
  const plan = body.plan === 'free' ? 'free' : 'premium';
  const entry = { email, plan };
  for (const [id, q] of Object.entries(QUESTIONS)) {
    const v = body[id];
    if (q.multi) {
      const list = Array.isArray(v) ? [...new Set(v.filter((x) => q.options.includes(x)))] : [];
      if (list.length === 0 || list.length > q.max) return { ok: false, error: `Respuesta inválida: ${id}` };
      entry[id] = list;
    } else {
      if (!q.options.includes(v)) return { ok: false, error: `Respuesta inválida: ${id}` };
      entry[id] = v;
    }
  }
  return { ok: true, entry };
}

/** Lista de espera guardada en un fichero JSON (en Railway, monta un volumen en su carpeta). */
export function createStore(file) {
  let cache = null;
  let queue = Promise.resolve();

  async function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(await readFile(file, 'utf8'));
      if (!Array.isArray(cache)) cache = [];
    } catch {
      cache = [];
    }
    return cache;
  }

  async function persist(list) {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2));
    await rename(tmp, file);
  }

  return {
    async count() {
      return (await load()).length;
    },
    async all() {
      return [...(await load())];
    },
    /** Añade la inscripción (o actualiza la existente con el mismo email) y devuelve su posición (1-based). */
    add(entry, now = new Date()) {
      const run = queue.then(async () => {
        const list = await load();
        const i = list.findIndex((e) => e.email === entry.email);
        if (i >= 0) {
          list[i] = { ...list[i], ...entry, updatedAt: now.toISOString() };
          await persist(list);
          return { position: i + 1, existing: true, count: list.length };
        }
        list.push({ ...entry, ts: now.toISOString() });
        await persist(list);
        return { position: list.length, existing: false, count: list.length };
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
