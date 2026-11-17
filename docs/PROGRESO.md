# Wrep — estado del proyecto y siguiente paso

Última actualización: 2026-11-12. Este documento sirve para retomar el trabajo, en Cursor o en otra sesión, sin el historial de la conversación.

## Qué es

Wrep es una app de recomposición corporal hecha en **React Native CLI** (0.88, TypeScript, sin Expo), con la interfaz en español. Tiene tres piezas:

| Carpeta | Qué es | Estado |
|---|---|---|
| `/` (App.tsx, `src/`) | App móvil iOS (Android sin compilar) | Fase 1 completa |
| `watch/` | Mini-app **Zepp OS** para Amazfit Bip 6 (API 4.2, 390×450) | Funciona de extremo a extremo |
| `server/` | Servidor Node (sin framework). Hace de puente entre el reloj y el móvil y aloja la IA | Desplegado en Railway; la IA está escrita pero falta desplegarla |

## Datos de despliegue

- **Servidor (Railway):** `https://recomp-production-825b8c55.up.railway.app`. Comprobar con `GET /health`.
- **Código de emparejamiento activo:** `73F9G5`. Está grabado en `watch/shared/defaults.js` y la app lo guarda en `settings.watch.code`. Si cambia, hay que ejecutar `node watch/scripts/pair.mjs <url> <código>` y reinstalar el reloj.
- **Zepp:** appId `1136058`, cuenta de desarrollador "geragusto". Para instalar en el reloj: en `watch/` ejecutar `npx zeus preview -t "Amazfit Bip 6"` y escanear el QR desde Zepp → Perfil → Amazfit Bip 6 → Modo desarrollador. En el iPhone del usuario, los campos de ajustes de la mini-app dentro de Zepp no se pueden editar; por eso la URL y el código van grabados en el código.
- **iPhone:** versión Release, bundle id `com.augustoromero.integralfitness`, equipo personal de Apple `H42T63A2Y8`. **Caduca cada 7 días.** Para reinstalar:
  ```bash
  cd ios && xcodebuild -workspace IntegralFitness.xcworkspace -scheme IntegralFitness -configuration Release -destination 'id=00008130-0001448E3A60001C' -derivedDataPath build/device -allowProvisioningUpdates build
  xcrun devicectl device install app --device 00008130-0001448E3A60001C ios/build/device/Build/Products/Release-iphoneos/IntegralFitness.app
  ```
- **Desarrollo:** `npx react-native start` (Metro) y una compilación Debug.

## Comandos de verificación

```bash
npx tsc --noEmit && npx eslint App.tsx src && npx jest   # app (56 tests)
cd server && npm test                                    # servidor + IA con cliente falso (8 tests)
cd watch && node --test                                  # lógica del reloj (6 tests)
```

## Arquitectura de la app (resumen)

- **Datos:** `src/store/index.ts` usa zustand, que guarda en MMKV.
  - `merge` añade al catálogo los ejercicios semilla nuevos (`seedMerge.ts`) y completa los ajustes que falten con los valores por defecto.
  - `src/store/derived.ts` calcula una sola vez todo lo derivado (plan, estados musculares, energía…) y lo comparte con `useDerived()`.
- **Motores puros** (`src/engines/`, con tests en `__tests__/`):
  - `volume`: series por músculo (MEV/MAV) y recuperación;
  - `balance`: reparto 80/20;
  - `generator`: sesión equilibrada;
  - `focus`: sesión según los grupos elegidos, alternativas e intercambios;
  - `progression`: e1RM y doble progresión;
  - `efficiency`;
  - `energy`: TDEE y recalibración;
  - `macros`: ciclado por tipo de día;
  - `goals`: objetivos del onboarding;
  - `coachRules`: revisión semanal con señales y propuestas;
  - `trends`.
- **Reloj:**
  - `src/watch/relay.ts` es el cliente HTTP del servidor puente.
  - `src/watch/useWatchSync.ts` envía la sesión, recoge las series y la frecuencia cardíaca, y reenvía la sesión si el servidor no la tiene.
  - `src/session.tsx` es la sesión en vivo, compartida entre el teléfono y el simulador del reloj.
- **Pantallas:** `src/screens/`. Hoy, Entreno (selector de grupos musculares y botón "Cambiar" ejercicio), Nutrición (escaneo de plato, etiqueta y ticket), Cuerpo, Coach, Onboarding/ProfileEdit, WatchPair, ExerciseLibrary/Edit, FoodAdd (con despensa), FoodScan, BodyEntry y ActivityEntry.
- **Estilo:** fondo negro y acento lima `#c8f53c`. Tipografías Barlow, Barlow Condensed y JetBrains Mono, a través de los helpers `cond`, `body` y `mono` de `src/theme.ts`. Los componentes base están en `src/ui.tsx`: `Card`, `Eyebrow`, `ScreenHeader`, `SheetHeader`, `Segmented`, `Chip`, `ChipSelect`, `Field`, `PrimaryButton`, `GhostButton`, `LinkButton`, `StatTile` y `Empty`. Todo el texto visible va en español.

## Fase 2 — IA con OpenAI (EN CURSO)

Decisiones del usuario:
- Se usa **OpenAI** con su propia API key. La key solo existe en Railway, nunca en la app.
- Las fotos de progreso se envían solo cuando el usuario lo pide, con aviso, y no se guardan.
- Los tickets de supermercado se guardan en una **Despensa** con macros por 100 g.

El plan completo está en `~/.claude/plans/ahora-si-eager-leaf.md`; lo esencial está resumido aquí.

### ✅ Hecho — servidor (`server/`)

- `server/package.json`: primera dependencia, `openai` ^7.56.0.
- `src/ai/schemas.js`: esquemas JSON en modo estricto (todo `required`, campos opcionales con `null` y `additionalProperties: false`).
  - `FOOD_SCAN`: `kind` (plato/etiqueta/ticket), `title`, `items[]` con nombre, gramos, kcal, p, c, f, `per100` o null y `confidence`, y `notes`.
  - `EXERCISE_DRAFT`: los mismos valores permitidos que `Exercise`, con `repMin`/`repMax`, `levers` y `legImpact`.
  - `COACH_NARRATIVE`: `headline`, `summary`, `wins[]`, `watch[]`, `photoNote`.
- `src/ai/prompts.js`: instrucciones de sistema en español.
- `src/ai/client.js`: `createAi({ client, model })` con el método `.structured()`.
  - Llama a `client.responses.create({ model, instructions, input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name, schema, strict: true } } })` y lee el resultado de `response.output_text`.
  - Detecta los rechazos del modelo (`refusal`) y las respuestas incompletas (`incomplete`), y traduce los errores del SDK a `AiError(status, code, message)`.
- `src/ai/routes.js`: `handleAi()` para las acciones `scan`, `exercise`, `coach` y `status`, con la clase `Quota` (cuota diaria por código) y `accessCodes()`.
- `src/relay.js`: rutas `POST /v1/:code/ai/{scan|exercise|coach}` y `GET /v1/:code/ai/status`, con un límite de cuerpo de 8 MB. Las imágenes no se registran en los logs.
- `src/index.js`: monta la IA con `OPENAI_API_KEY`, `OPENAI_MODEL` (por defecto `gpt-5.5`), `AI_ACCESS_CODES` y `AI_DAILY_LIMIT` (por defecto 60).
- `test/ai.test.js`: 8 tests en total con un cliente falso.

**Contrato de la API** (la imagen va como data URL `data:image/jpeg;base64,...`):
- `POST /v1/:code/ai/scan` — `{ image, hint?: 'plato'|'etiqueta'|'ticket' }`. Devuelve un `FoodScan`.
- `POST /v1/:code/ai/exercise` — `{ text }`. Devuelve un `ExerciseDraft`.
- `POST /v1/:code/ai/coach` — `{ review, stats, photos?: [dataUrl, dataUrl] }`. Devuelve una `CoachNarrative`.
- Errores: `{ error, code }`, con estos códigos y estados:
  - `not_allowed`: 403
  - `quota`: 429
  - `bad_image` / `bad_text`: 400
  - `ai_refusal`: 422
  - `ai_disabled`: 503
  - `ai_timeout`: 504

### ✅ Hecho — app

- `src/ai/api.ts`: tipos (`FoodScan`, `ScanItem`, `ExerciseDraftRaw`, `CoachNarrative`), `aiReady(link)`, `AiRequestError` y las funciones `scanFood`, `draftExercise` y `coachReview`. Usan `settings.watch.serverUrl` y `settings.watch.code`, con un tiempo de espera de 90 s.
- `src/ai/logic.ts`:
  - `macrosFor(per100, grams)`;
  - `exerciseFromDraft(draft)`: valida los valores contra el dominio y aplica valores por defecto seguros.
- `src/domain/types.ts`: tipos `PantryItem` y `AiCoachReview`, y el campo `CoachState.aiReview?: Record<ISODate, AiCoachReview>`.
- `src/store/index.ts`: `pantry: PantryItem[]` (se guarda en el móvil) y las acciones `addPantry(items)` (reemplaza por nombre), `removePantry(id)` y `setAiReview(weekOf, review)`.
- Estado al guardar: `tsc`, `eslint` y `jest` (56 tests) pasan; `server/` `npm test` (8 tests) pasa.

### ✅ Hecho — app, pantallas

- `src/photos.ts`: `pickImageForAi(title)` (cámara o carrete, 1280 px, `quality: 0.7`, `includeBase64`) y `photoDataUrl` (lee el archivo en base64).
- `src/ai/__tests__/logic.test.ts`: `macrosFor` y `exerciseFromDraft` (músculos desconocidos, palanca sin niveles, rango invertido, enums y nombre vacíos).
- Nutrición: tres botones (Plato, Etiqueta, Ticket) abren `FoodScan`. Si el servidor no está configurado, un aviso pide emparejar el reloj.
- `FoodScanScreen` (modal `FoodScan: { kind }`): elige la foto, muestra "Analizando…", lista editable y, si el alimento trae `per100`, recalcula al cambiar los gramos. Plato añade a hoy; etiqueta añade a hoy o guarda en la despensa; ticket marca productos y guarda en la despensa. El error de `AiRequestError` tiene reintentar.
- Despensa en `FoodAddScreen`: tocar un producto pide los gramos y añade con `macrosFor`; pulsación larga lo quita.
- Ejercicios: "Describe el ejercicio" y **Rellenar con IA** rellenan el formulario sin guardar. La región sale del músculo principal y el cardio conserva el impacto en piernas.
- Coach: **Revisión con IA** envía la revisión semanal y las últimas 8 semanas de tendencias, el objetivo, el peso y la grasa. El texto queda en la tarjeta RESUMEN (`wins` / `watch` aparte) y se guarda con `setAiReview`; si ya hay una de esa semana, se muestra y no se vuelve a pedir. **Analizar fotos** pide confirmación y envía la primera y la última foto de frente. Ya no quedan textos de "Fase 2".

### ⏳ Pendiente (en este orden)

1. **Despliegue:**
   - **El usuario** añade en Railway → Variables: `OPENAI_API_KEY`, `AI_ACCESS_CODES=73F9G5` y, si quiere, `OPENAI_MODEL`. Hay que confirmar con su key que el modelo existe y admite imágenes y `json_schema`.
   - Desde `server/`: `railway up`.
   - Comprobar con `curl https://…/v1/73F9G5/ai/status`, que debe devolver `enabled: true`.
   - Instalar la versión Release en el iPhone (comando de arriba).
2. **Prueba en el iPhone:**
    - escanear un plato y añadirlo;
    - escanear una etiqueta y guardarla en la despensa;
    - escanear un ticket y añadir un producto de la despensa;
    - crear un ejercicio con IA;
    - pedir la revisión del Coach con y sin fotos.

## Fases siguientes

- **Fase 4 — Apple Health / Health Connect:** pasos, kcal activas, sueño profundo, HRV y frecuencia cardíaca en reposo. Alimenta la tarjeta de recuperación, el NEAT del TDEE y las señales del Coach. Hoy esos datos se introducen a mano en `ActivityEntryScreen`.
- **Mejoras pendientes del reloj:**
  - introducir el código de emparejamiento desde el propio reloj, en vez de grabarlo en el código;
  - mostrar en el teléfono el estado de descanso real que lleva el reloj (ahora el teléfono simula su propio descanso y se resincroniza cuando llegan series).
