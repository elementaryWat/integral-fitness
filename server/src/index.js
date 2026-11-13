import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createAi, createOpenAiClient } from './ai/client.js';
import { accessCodes, Quota } from './ai/routes.js';
import { createRelay } from './relay.js';

const port = Number(process.env.PORT ?? 8787);
const file = process.env.RELAY_FILE ?? fileURLToPath(new URL('../data/relay.json', import.meta.url));
const ai = {
  ai: createAi({ client: createOpenAiClient(), model: process.env.OPENAI_MODEL || 'gpt-5.5' }),
  quota: new Quota(Number(process.env.AI_DAILY_LIMIT ?? 60)),
  codes: accessCodes(),
};
const { server } = createRelay({ file, ai });

server.listen(port, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Recomp relay listening on :${port} · IA ${ai.ai.enabled ? `${ai.ai.model}, ${ai.codes.size} código(s)` : 'desactivada (sin OPENAI_API_KEY)'}`);
  for (const ip of ips) console.log(`  → http://${ip}:${port}  (usa esta URL en la app y en los ajustes del reloj)`);
});
