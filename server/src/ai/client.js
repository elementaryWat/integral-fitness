// Thin wrapper around the OpenAI Responses API with strict JSON-schema outputs.
// The OpenAI client is injected so tests can run without network or cost.
import OpenAI from 'openai';

export class AiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ timeout: 90 * 1000, maxRetries: 1 });
}

/** Maps SDK and model failures to HTTP errors the app can show. */
function mapError(e) {
  if (e instanceof AiError) return e;
  if (e instanceof OpenAI.RateLimitError) return new AiError(429, 'rate_limited', 'OpenAI está limitando las peticiones o no hay saldo. Prueba en un rato.');
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) return new AiError(502, 'ai_config', 'La API key de OpenAI del servidor no es válida.');
  if (e instanceof OpenAI.BadRequestError) return new AiError(502, 'ai_request', `OpenAI rechazó la petición: ${e.message}`);
  if (e instanceof OpenAI.APIConnectionTimeoutError) return new AiError(504, 'ai_timeout', 'La IA tardó demasiado. Vuelve a intentarlo.');
  if (e instanceof OpenAI.APIError) return new AiError(502, 'ai_error', `Error de OpenAI (${e.status ?? 'sin estado'}).`);
  return new AiError(500, 'ai_error', e?.message ?? 'Error inesperado de la IA.');
}

/**
 * `structured({ system, content, format })` → parsed object matching `format.schema`.
 * `content` is a Responses API user content array (input_text / input_image parts).
 */
export function createAi({ client, model }) {
  return {
    model,
    enabled: !!client,
    async structured({ system, content, format }) {
      if (!client) throw new AiError(503, 'ai_disabled', 'La IA no está configurada en el servidor (falta OPENAI_API_KEY).');
      try {
        const response = await client.responses.create({
          model,
          instructions: system,
          input: [{ role: 'user', content }],
          text: { format: { type: 'json_schema', name: format.name, schema: format.schema, strict: true } },
        });
        const refusal = (response.output ?? [])
          .flatMap((item) => (item.type === 'message' ? item.content ?? [] : []))
          .find((part) => part.type === 'refusal');
        if (refusal) throw new AiError(422, 'ai_refusal', refusal.refusal || 'La IA no puede analizar este contenido.');
        if (response.status === 'incomplete') throw new AiError(502, 'ai_incomplete', 'La respuesta de la IA quedó incompleta. Vuelve a intentarlo.');
        try {
          return JSON.parse(response.output_text);
        } catch {
          throw new AiError(502, 'ai_parse', 'La IA devolvió un formato inesperado.');
        }
      } catch (e) {
        throw mapError(e);
      }
    },
  };
}
