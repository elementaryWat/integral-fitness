# Wrep — hoja de ruta

Última actualización: 2026-11-17.

Este documento recoge las mejoras pendientes:
- llevar Wrep de uso propio a usuarios de prueba;
- añadir un modo calistenia completo;
- mejorar la sobrecarga progresiva.

Las mejoras del entreno en el gimnasio (descanso, LISTO, omitir…) siguen en [`MEJORAS.md`](MEJORAS.md). El estado de cada funcionalidad está en [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md).

**Prioridad:**
- **P0:** bloquea el siguiente paso.
- **P1:** mejora mucho el uso.
- **P2:** valor a medio plazo.

Cuando algo se termine, márcalo con ✅ aquí y en `FUNCIONALIDADES.md`.

---

## Índice
1. [Uso propio estable con SideStore](#1-uso-propio-estable-con-sidestore)
2. [Robustez del uso diario](#2-robustez-del-uso-diario)
3. [Usuarios de prueba sin reloj](#3-usuarios-de-prueba-sin-reloj)
4. [Login](#4-login)
5. [Datos multiusuario: compartidos y personales](#5-datos-multiusuario-compartidos-y-personales)
6. [Modo calistenia](#6-modo-calistenia)
7. [Sobrecarga progresiva](#7-sobrecarga-progresiva)
8. [Otras mejoras](#8-otras-mejoras)
9. [Orden global sugerido](#9-orden-global-sugerido)

---

## 1. Uso propio estable con SideStore

**Objetivo:** dejar de reinstalar desde Xcode cada 7 días. SideStore refresca la firma gratuita solo.

> ⚠️ SideStore vuelve a firmar con tu Apple ID y suele **cambiar el bundle id** (añade el ID del equipo). Eso crea una app nueva con el almacenamiento vacío. **Hay que exportar los datos antes de instalar desde SideStore.**

### 1.1 Copia de seguridad: exportar e importar (P0)
- **Función pura `src/store/backup.ts`:**
  - `serializeBackup(state)`: usa los mismos campos que `partialize` en `src/store/index.ts`, más `version` y la fecha.
  - `parseBackup(json)`: valida la copia y la pasa por el `merge` y `sanitizeSettings` que ya existen (`src/store/seedMerge.ts`).
  - Tests de Jest.
- **Exportar:** escribe `wrep-AAAA-MM-DD.json` y abre la hoja de compartir (Archivos, AirDrop).
- **Importar:** elegir el archivo, confirmar con "Esto reemplaza tus datos" y aplicarlo. También en el onboarding, como "Restaurar copia".
- **Fotos de progreso:** guardan una ruta del contenedor que no sobrevive al cambio de app. Se incluyen opcionalmente en base64 o se avisa de que no se copian.
- Este serializador es también la base para la primera subida a la nube (§5).

### 1.2 Script para generar la IPA (P0)
- `scripts/build-ipa.sh`:
  - `xcodebuild archive` en Release sin firma (`CODE_SIGNING_ALLOWED=NO`);
  - empaqueta `Payload/IntegralFitness.app` en `build/Wrep.ipa`;
  - sube `CURRENT_PROJECT_VERSION` en cada build, para que SideStore detecte la actualización.
- Se documenta en `PROGRESO.md` y sustituye a la sección "caduca cada 7 días".

### 1.3 Apple Health con SideStore (P0)
- Con cuentas gratuitas, SideStore puede quitar el entitlement de HealthKit.
- `src/health/useHealthSync.ts` no debe bloquearse ni dar error si falta HealthKit. Debe volver a los datos del reloj y a la entrada manual.
- Si no hay permiso, mostrar un aviso discreto en la tarjeta de recuperación.

### 1.4 IA en Railway (P0, comprobación)
- La IA ya está desplegada.
- Comprobar que `GET /v1/73F9G5/ai/status` devuelve `enabled: true`.
- Comprobar que está desplegada la última versión del servidor, con las acciones `food`, `physique` y `routine`.

---

## 2. Robustez del uso diario

| Prioridad | Mejora | Detalle |
|---|---|---|
| P1 | **Pantalla de error en la raíz** | En `App.tsx` no hay ninguna. Pantalla "Algo falló" con **Exportar datos** (§1.1) y **Reintentar**. |
| P1 | **Migraciones del store** | Añadir `version` y `migrate` al `persist` de `src/store/index.ts`. Hoy los datos antiguos solo los protege el `merge`. |
| P1 | **Persistencia del relay** | `RelayStore` guarda en `data/relay.json`. Sin un Volume en Railway, ese archivo se borra en cada despliegue. Además hay que recortar las series y los datos diarios antiguos para que no crezca sin límite (test en `server/test/relay.test.js`). |
| P1 | **Probar todo lo marcado 🧪** | Por orden: flujo del reloj (LISTO, +30 s, omitir, paso fino), resumen al terminar, IA (plato, etiqueta, ticket, texto, ejercicio, rutina, coach, fotos) y Apple Health. |
| P1 | **Test que depende de la fecha** | `src/engines/__tests__/demo.test.ts:24`: el reparto de pierna sale 0,27 con un tope de 0,25 según el día de la semana. Fijar la fecha en el test o hacer los datos de ejemplo deterministas. |
| P2 | **Copia automática periódica** | Exportar cada semana a Archivos o iCloud Drive, además de la exportación manual. |

---

## 3. Usuarios de prueba sin reloj

### 3.1 Lo que hoy falla sin reloj
1. **La IA va atada al emparejamiento del reloj:**
   - `aiReady()` en `src/ai/api.ts:18` lee `settings.watch.serverUrl` y `settings.watch.code`.
   - Sin ellos sale "Configura el servidor en Hoy → Bip 6 → Reloj para usar la IA".
   - Afecta a Nutrición, Añadir alimento, Entreno (armar rutina), la ficha de ejercicio y el Coach.
2. **El código de quien prueba no estaría autorizado:** cada instalación genera un código aleatorio (`newPairCode()`), pero `AI_ACCESS_CODES` solo acepta `73F9G5`. El resultado es un error `not_allowed` (403).
3. **Textos y entradas que dan por hecho el reloj:** el comentario de cabecera de `App.tsx`, el acceso "Bip 6" en Hoy y el indicador de conexión.

### 3.2 Separar la IA del reloj (P0 para la prueba)
- **URL del servidor:** fija en la app, como ajuste de compilación, no editable.
- **Código propio para la IA:** cada instalación tiene un código de usuario (`settings.ai.code`), separado del de emparejamiento.
- **Reloj:** pasa a ser un dispositivo opcional.
- **Sin cuentas todavía:**
  - Usar **códigos de invitación**: varios en `AI_ACCESS_CODES`, con una cuota baja por código (unas 20 peticiones al día).
  - El código se introduce en el onboarding.
  - Así controlas el gasto y puedes revocar a alguien.

### 3.3 Camino sin reloj para cada función

| Función | Con reloj | Sin reloj |
|---|---|---|
| Registrar series | Reloj | Registro en el móvil, como modo principal y no como "simulador" |
| Descanso | Pulso + tiempo | Solo tiempo, con notificación local o vibración aunque la app esté en segundo plano |
| Pulso, HRR y curva de la sesión | Reloj | Se ocultan en el resumen, sin guiones vacíos |
| Recuperación | Reloj + Apple Health | Apple Health (cualquier reloj, incluido el Apple Watch) o entrada manual. Si no hay nada, preguntar "¿Cómo dormiste? ¿Energía?" del 1 al 5 |
| Pasos y NEAT del TDEE | Reloj | Pasos del iPhone en Apple Health, o la estimación actual |
| Omitir, +30 s, LISTO | Reloj y móvil | Comprobar que se ven bien sin la tarjeta del reloj |

### 3.4 Primera experiencia
- **Onboarding:**
  - "¿Tienes un Amazfit Bip 6?": si la respuesta es no, se oculta todo lo del reloj.
  - "¿Conectar Apple Health?": opcional.
- **Hoy sin datos:** durante los 3 primeros días, explicar qué falta en vez de mostrar una puntuación vacía.
- **Datos de ejemplo:** que se distingan bien y que se puedan borrar en un toque.

### 3.5 Logística de la prueba
- **Distribución:**
  - **TestFlight** requiere la cuenta de desarrollador de pago (99 €/año).
  - **SideStore** obliga a cada persona a instalarlo, y es una barrera para quien no es técnico.
- **Fallos:** pantalla de error (§2) + Sentry o similar (tiene plan gratuito).
- **Opiniones:** botón "Enviar comentario" que abre el correo con la versión de la app.
- **Privacidad:** aviso claro antes de enviar comidas o fotos a la IA. Las fotos ya lo llevan.

---

## 4. Login

**Recomendación:** Supabase Auth con **código por correo (OTP de 6 dígitos)** ahora, y **Sign in with Apple** al pasar a TestFlight o a la App Store.

### 4.1 Por qué
- **Sign in with Apple no funciona con SideStore:** las cuentas gratuitas no tienen esa capacidad. El OTP por correo funciona en cualquier instalación.
- **OTP mejor que enlace mágico:** no necesita enlaces profundos, y el enlace no se abre en Safari por error.
- **Normas de la App Store:**
  - si ofreces Google, tienes que ofrecer también Apple (norma 4.8);
  - es obligatorio un botón **"Eliminar cuenta"** dentro de la app (norma 5.1.1(v)).
- **Supabase** reúne login, Postgres con RLS y Storage para las fotos. Encaja con §5.

### 4.2 App (RN CLI, sin Expo)
- **Librerías:** `@supabase/supabase-js` + `react-native-url-polyfill`.
- **Sesión en el Keychain** (`react-native-keychain` como `storage` de Supabase), no en MMKV en claro, porque el refresh token es una credencial.
- **Apple, más adelante:** `@invertase/react-native-apple-authentication` con `signInWithIdToken`.
- **Pantallas:**
  - `Login` (correo → código);
  - en Perfil: "Cerrar sesión" y "Eliminar cuenta".
- **Estado `user` en el store:** fuera de `partialize`.

### 4.3 Flujo
1. **Local-first:** la app funciona sin cuenta, como ahora. El login desbloquea la IA, la sincronización y el reloj en la nube.
2. **Primer login:** preguntar "Tienes datos en este móvil. ¿Subirlos a tu cuenta?" y subirlos con el serializador de §1.1.
3. **Cerrar sesión:** preguntar si quiere borrar los datos de este móvil.
4. **Sin conexión con el token caducado:** la app sigue en local y sincroniza al volver la red.

### 4.4 Servidor de Railway
- **Autenticación:** las peticiones llevan `Authorization: Bearer <access_token>`. El servidor lo verifica con la clave pública de Supabase (`jose` + JWKS) y obtiene el `user_id`.
- **Cuota de la IA:** pasa de estar en memoria a una tabla `ai_usage` por `user_id`.
- **Quién puede usar la IA:** `profiles.ai_enabled`, o un código de invitación que se canjea al registrarse.
- **Reloj:**
  - El móvil autenticado pide un **código de emparejamiento temporal** (`POST /devices/pair`), que se guarda en `devices`.
  - El reloj usa ese código, y se puede revocar desde la app.
  - Sustituye al código fijo `73F9G5`.
- **Claves:** la service key de Supabase solo en Railway. La app usa únicamente la `anon key`.

### 4.5 Seguridad
- RLS activado en **todas** las tablas personales desde el principio: `user_id = auth.uid()`.
- Límite de envíos de OTP y un proveedor SMTP propio (Resend o similar). El correo por defecto de Supabase tiene un límite muy bajo.
- No guardar el correo en los logs ni enviarlo a la IA.

### 4.6 Orden
1. Proyecto en Supabase, tabla `profiles` y RLS.
2. Login por OTP en la app, con la sesión en el Keychain.
3. Servidor: verificación del token para la IA y cuota por usuario. **Aquí ya pueden probar personas sin reloj.**
4. Emparejamiento del reloj por usuario.
5. Sincronización de datos (§5).
6. Sign in with Apple y eliminar cuenta, al pasar a TestFlight.

---

## 5. Datos multiusuario: compartidos y personales

**Recomendación:** **local-first** (MMKV sigue siendo la fuente de verdad en el móvil) + **Postgres en Supabase con RLS** como copia sincronizada. Las pantallas y los motores puros no cambian; solo cambia la capa de guardado.

### 5.1 Qué es compartido y qué es personal

| Tipo | Datos | Quién escribe | Cómo se guarda |
|---|---|---|---|
| Compartido (catálogo) | Ejercicios semilla, técnica, músculos, MEV/MAV, rutinas plantilla | Admin | Tablas globales de solo lectura con `version`; la app las guarda en caché. Hoy viven en `catalog.ts` y `technique.ts`. |
| Compartido (alimentos) | Base de alimentos con macros por 100 g | Admin + IA + usuarios con moderación | `foods_catalog`, que se puede sembrar con Open Food Facts |
| Personal | Perfil, sesiones, series, pesajes, medidas, comidas, despensa, rutinas, actividad, revisiones del Coach | Usuario | Cada fila con `user_id`; RLS `user_id = auth.uid()` |
| Personal sensible | Fotos de progreso, datos de salud | Usuario | Bucket privado con URLs firmadas; fotos opcionales en la nube |
| Híbrido | Ejercicios del usuario | Usuario | `exercises.owner_id` nulo (global) o con un id (propio); ajustes a un ejercicio global en `user_exercise_overrides` |

**Regla clave:** lo personal **referencia** lo compartido por id y nunca lo copia.

### 5.2 Esquema base
```
users            (id, created_at)                 ← Auth
profiles         (user_id PK, nombre, sexo, altura, objetivo, settings jsonb, ai_enabled)
exercises        (id, owner_id NULL|user, data jsonb, version, updated_at)
user_exercise_overrides (user_id, exercise_id, patch jsonb)
sessions         (id, user_id, date, minutes, feel, deload, …, updated_at, deleted_at)
set_logs         (id, session_id, user_id, exercise_id, carga, reps, rpe, …)
weigh_ins        (id, user_id, date, kg, updated_at, deleted_at)
body_comps / perimeters / activity   (mismo patrón)
food_entries     (id, user_id, date, meal, food_id NULL, macros…, updated_at, deleted_at)
pantry_items     (id, user_id, name, per100 jsonb, …)
routines         (id, user_id NULL=plantilla, blocks jsonb, …)
coach_reviews    (id, user_id, week_of, kind: rules|ai|physique, data jsonb)
photos           (id, user_id, date, view, storage_path)
devices          (id, user_id, watch_code, last_seen)
ai_usage         (user_id, day, count)
```

### 5.3 Reglas para que escale
- **Ids:** UUID generados en el móvil (como `uid()`), para poder crear datos sin conexión.
- **Sincronización:**
  - `updated_at` en cada fila y `deleted_at` en vez de borrar de verdad;
  - se pide lo cambiado desde la última vez y se sube lo cambiado en local;
  - en caso de conflicto, gana la última escritura.
- **Columnas y jsonb:** columnas reales para lo que se filtra o se agrega (fecha, `user_id`, `exercise_id`); jsonb para lo que solo se pinta (técnica, bloques, texto del Coach).
- **Datos derivados:** no se guardan (plan, recuperación, TDEE). Se recalculan en el móvil (`derived.ts`).

### 5.4 Orden
1. Copia de seguridad (§1.1).
2. Separar en el store el catálogo compartido del estado personal. **No ata a ningún proveedor y vale la pena ya.**
3. Supabase: Auth, tablas con RLS y sincronización push/pull.
4. Relay e IA identificados por usuario en vez de por código.
5. Fotos en Storage, de forma opcional.

---

## 6. Modo calistenia

### 6.1 Lo que ya existe
- **Disciplina y modos de carga:** disciplina `Calistenia` y modos `corporal`, `lastre` (+kg sobre el peso corporal) y `palanca` (niveles en `levers`).
- **Ejercicios por niveles:** front lever, flexiones arquero → a una mano, pike → flexión en pino, pistol, nórdico, L-sit → V-sit.
- **Lastrados:** dominadas y fondos.
- **Isométricos:** `unit: 's'`.
- **Progresión:** la progresión doble ya sube de nivel de palanca (`src/engines/progression.ts:56`), y `systemLoad` suma el peso corporal en el modo `lastre`.
- **Catálogo:** unos 10 ejercicios de calistenia.

### 6.2 Mejoras

| Prioridad | Mejora | Detalle |
|---|---|---|
| P1 | **Equipamiento y lugar** | `Exercise.equipment: ('barra' \| 'paralelas' \| 'anillas' \| 'banda' \| 'suelo' \| 'banco' \| 'gimnasio')[]`. En el perfil, "¿Dónde entrenas?" con lugares guardados (gimnasio, casa, parque). `generator` y `focus` filtran por el lugar del día. También sirve para pesas en casa. |
| P1 | **Ampliar el catálogo a unos 40 ejercicios** con técnica | Ver la lista debajo de la tabla. |
| P1 | **Volumen y récords con peso corporal** | `isLoaded()` excluye `corporal` y `palanca`, así que una sesión de calistenia sale con 0 de tonelaje. Añadir `bwFactor` por ejercicio (flexión ≈ 0,65, dominada ≈ 1,0, pistol ≈ 0,8) para el tonelaje y una e1RM aproximada. Récords por nivel: "primer straddle", "más segundos en pino". |
| P1 | **Criterio para avanzar de nivel** | Cada nivel con su objetivo (p. ej. 3×12 s antes de pasar a Straddle), mostrado en la ficha con la escalera, el nivel actual y el siguiente. |
| P1 | **Retroceder de nivel** | Si fallas 2 sesiones seguidas en un nivel, bajar uno. Hoy solo sube (§7). |
| P1 | **Asistido como niveles** | Banda gruesa → Banda fina → Negativas → Completa, como niveles inferiores de palanca. No hace falta un modo nuevo. |
| P2 | **Habilidades separadas de la fuerza** | `Exercise.kind: 'skill' \| 'fuerza' \| 'accesorio'`. Las habilidades van en el bloque A, frescas, y cuentan como medio set para MEV/MAV. |
| P2 | **Formatos EMOM y circuito por tiempo** | Solo cambian el temporizador. Después, AMRAP y escaleras. |
| P2 | **Modo isométrico en el reloj** | Cuenta atrás y vibración al cumplir el objetivo, en vez de contar repeticiones. Requiere QR nuevo. |
| P2 | **Rutinas plantilla compartidas** | Programas base: principiante full-body 3×semana, empuje/tracción/pierna en parque, ruta hacia el pino. Viven en el catálogo compartido (§5); el usuario las copia a "Mis rutinas". |
| P2 | **IA consciente del lugar** | "Armar rutina con IA" recibe el equipamiento y la disciplina. |

Ejercicios a añadir al catálogo:
- **Tracción:** remo australiano, chin-up, muscle-up.
- **Empuje:** fondos en banco, flexión diamante, flexión pseudo-planche.
- **Habilidades:** progresión a plancha, back lever, dragon flag.
- **Pierna:** shrimp squat, búlgara sin peso.
- **Core:** hollow hold, arch hold, elevación de piernas colgado.

**Archivos:** `src/domain/types.ts`, `src/domain/catalog.ts`, `src/domain/technique.ts`, `src/engines/progression.ts`, `src/engines/generator.ts`, `src/engines/focus.ts` (con tests) y `ExerciseDetailScreen`.

---

## 7. Sobrecarga progresiva

### 7.1 Cómo funciona hoy

**Por ejercicio:** progresión doble en `suggestNext()` (`src/engines/progression.ts:36`). Mira solo la **última sesión** con ese ejercicio: la carga máxima, y con esa carga las repeticiones mínimas y la RPE media.

| Modo | Tope del rango en todas las series y RPE media ≤ 8,5 | RPE media ≥ 9,5 | Si no |
|---|---|---|---|
| `peso` / `lastre` | +`step` kg y vuelve al mínimo del rango | Repite | Misma carga, +1 rep |
| `palanca` | Siguiente nivel y vuelve al mínimo | Repite | +1 rep (+5 s) |
| `corporal` / `tiempo` | — | Repite | +1 rep (+5 s / +2 min), sin tope salvo en cardio |

- **Primera vez:** usa `defaultLoad` y `defaultReps`.
- **Durante la sesión:** cada serie se precarga con la serie anterior (`src/session.tsx:60`).
- **Medida de progreso:** 1RM estimado con Epley, con el peso corporal en el modo `lastre`. Se muestra con la comparación semanal en la ficha.

**Por músculo:**
- Cuenta las series duras (RPE ≥ 7) por semana.
- El objetivo es MEV + 4, entre MEV y MAV.
- El Coach recorta de 2 a 4 series si detecta fatiga: series por encima del MAV, HRR-60 bajando, pérdida de velocidad o RPE subiendo.

**Descarga:**
- El Coach la propone (`src/engines/coachRules.ts:175`) a partir de 4 semanas si la fuerza no sube o hay 2 o más músculos fatigados.
- Una vez aceptada: 2 rondas en vez de 3, cargas al 90 % y repeticiones en el mínimo.

### 7.2 Mejoras

| Prioridad | Problema | Mejora |
|---|---|---|
| P1 | **Mira solo la última sesión**: un mal día hace que repitas | Usar las 2–3 últimas sesiones o la tendencia del 1RM estimado. Cruzar con la recuperación del día: si es baja, mantener en vez de subir. |
| P1 | **Depende de la RPE, que por defecto es 8** | Si no se toca, "RPE ≤ 8,5" siempre se cumple y la app sube carga solo por repeticiones. Marcar la RPE como "sin indicar" y no usarla. Avisar si nunca se cambia. Estimarla con el reloj (pérdida de velocidad, HRR). |
| P1 | **Nunca retrocede** | Estancamiento de 3 sesiones con la misma carga: bajar un 5–10 % y volver a construir. Fallo de 2 sesiones en un nivel de palanca: bajar un nivel. |
| P1 | **Sin tope en `corporal`** | Al llegar al tope del rango, proponer pasar a lastre o a la siguiente variante (enlaza con §6). |
| P2 | **Incremento fijo** | +2,5 kg es mucho en laterales y poco en peso muerto. Usar un incremento relativo (≈ 2–5 % del 1RM estimado), redondeado a los discos disponibles, con micro-incrementos opcionales. |
| P2 | **Sin ajuste dentro de la sesión** | Si una serie sale a RPE 10 por debajo del mínimo de repeticiones, proponer bajar la carga en la siguiente. Si sale a RPE ≤ 6, proponer subirla. |

**Archivos:** `src/engines/progression.ts` (con tests en `__tests__/`), `src/session.tsx` para el ajuste dentro de la sesión, y `src/engines/coachRules.ts` para avisar de estancamientos.

---

## 8. Otras mejoras
- **Kcal activas de Apple Health en el TDEE** (`src/engines/energy.ts`). Hoy el NEAT se estima.
- **Fase 3 de [`MEJORAS.md`](MEJORAS.md):** pulso minuto a minuto, Coach con plan de la semana siguiente y repeticiones con giroscopio.
- **Código de emparejamiento desde el reloj:** lo resuelve §4.4.
- **Health Connect en Android:** fuera de alcance mientras no se compile Android.

---

## 9. Orden global sugerido
1. **SideStore:** copia de seguridad (§1.1) → IPA (§1.2) → Apple Health (§1.3).
2. **Robustez:** pantalla de error, migraciones, relay y test de fecha (§2); probar lo 🧪.
3. **Sobrecarga progresiva P1** (§7.2): son motores puros, rápidos de hacer y con impacto diario.
4. **Calistenia P1** (§6.2): equipamiento, catálogo, `bwFactor`, criterios y retroceso de nivel.
5. **Separar el catálogo del estado personal** (§5.4, paso 2).
6. **Usuarios de prueba:** IA separada del reloj con códigos de invitación (§3.2) y caminos sin reloj (§3.3).
7. **Login + Supabase** (§4.6) y sincronización (§5).
8. **P2** de calistenia y progresión, y TestFlight con Sign in with Apple.
