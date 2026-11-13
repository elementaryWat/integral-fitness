// Usage: node scripts/pair.mjs http://192.168.0.241:8787 7XWSB5  → rewrites shared/defaults.js
import { readFileSync, writeFileSync } from 'node:fs'
const [url, code] = process.argv.slice(2)
if (!/^https?:\/\//.test(url ?? '') || !/^[A-Z0-9]{6,12}$/.test(code ?? '')) {
  console.error('Uso: node scripts/pair.mjs <http://IP:8787> <CODIGO>')
  process.exit(1)
}
const file = new URL('../shared/defaults.js', import.meta.url)
const src = readFileSync(file, 'utf8').replace(/export const DEFAULT_LINK = .*/, `export const DEFAULT_LINK = { serverUrl: '${url.replace(/\/+$/, '')}', pairCode: '${code}' }`)
writeFileSync(file, src)
console.log(`Emparejamiento por defecto: ${code} → ${url}`)
