# Instrucciones para agentes (Cursor, Claude, etc.)

Lee primero **`docs/PROGRESO.md`**. Ahí están el estado del proyecto, los datos de despliegue y la lista ordenada de lo que falta en la Fase 2 (IA con OpenAI).

Convenciones:
- Todo el texto visible de la app va en **español**. Respeta la estética actual: fondo negro, acento lima `#c8f53c` y los componentes de `src/ui.tsx` y `src/theme.ts`.
- Lógica de negocio en funciones puras (`src/engines/`, `src/ai/logic.ts`) con tests de Jest. Las pantallas solo componen.
- El estado guardado en el móvil vive en `src/store/index.ts`. Si añades un campo nuevo, añádelo también a `partialize` y dale un valor por defecto en `initialData`; el `merge` rellena los datos antiguos.
- Ninguna API key va en la app. La IA se llama a través de `server/` (Railway).
- Antes de terminar, ejecuta `npx tsc --noEmit && npx eslint App.tsx src && npx jest`, y en `server/` ejecuta `npm test`.
- Cualquier cambio en `watch/` obliga a generar un QR nuevo (`npx zeus preview -t "Amazfit Bip 6"`) y reinstalar la mini-app en el reloj.
