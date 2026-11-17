# Wrep — mejoras priorizadas (2026-11-14)

Lista de lo que salió entrenando con el reloj, ordenada por impacto. Cada fase se puede entregar por separado.
Cuando algo se termine, márcalo aquí y en [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md).

**Estado 2026-11-14:** Fases 1 y 2 implementadas (🧪 = falta probar en el gimnasio). El Motor 80/20 pasó a Coach. La comida por texto necesita desplegar el servidor. Pendiente: la Fase 3.

**Prioridad:** P0 rompe datos o el flujo en el gimnasio · P1 mejora mucho el uso · P2 valor a medio plazo · ❓ falta información

---

## Fase 1 — Que la sesión en el gimnasio no falle (P0)

### 1.1 El descanso largo termina antes y la serie arranca sola ✅ 🧪
*Puntos: "no se termina el descanso largo y empieza serie", "más tiempo de descanso por esperar la barra".*

**Causa** (en `watch/shared/logic.js` → `restEnd`): la regla de pulso termina el descanso en cuanto el pulso baja de 112 lpm, a partir de los **20 s**. En un descanso de 3 min con el pulso bajo, el descanso se corta casi enseguida. Después `endRest()` llama a `startSet()` sin esperarte, así que el cronómetro de la serie empieza aunque estés esperando la barra.

**Cambio:**
- **Pulso con mínimo real:** la regla de pulso solo puede terminar el descanso a partir del 60 % del tiempo objetivo (mínimo 60 s). Antes de eso solo cuenta el tiempo.
- **Estado nuevo "LISTO":** al acabar el descanso, el reloj vibra y muestra "LISTO · A1 Press banca 80 kg × 8", pero no empieza la serie. La serie empieza:
  - al tocar EMPEZAR;
  - o, opcionalmente, al detectar la primera repetición.
  
  Así el tiempo de espera no cuenta como serie. *(Implementado solo con toque; la detección por primera repetición queda para la Fase 3.3.)*
- **"+30 s"** en el reloj y en el móvil durante el descanso.
- El descanso real (fin de serie → empezar) se guarda en la serie para la densidad y el Coach.
- **Archivos:**
  - `watch/shared/logic.js` (+ tests)
  - `watch/page/index.js`
  - `src/session.tsx` (simulador del teléfono)
  - QR nuevo del reloj

### 1.2 Peso exacto (66 en vez de 65) y pesos de más de 100 ✅ 🧪 (el "límite de 100" era la media de 7 días mostrada en el campo; corregido)
- **Móvil:** tocar el número de carga en "Registro en el móvil" abre un teclado numérico para escribir el peso exacto. Los botones −/+ siguen usando el incremento del ejercicio.
- **Reloj:** mantener pulsado −/+ cambia a incremento fino (1 kg o 0,5 kg) mientras dure la serie.
- **Más de 100:** ❓ no encuentro en el código ningún límite de 100. Necesito saber dónde pasa (¿reloj, registro en el móvil, editor de ejercicio, peso corporal?) y qué ocurre (no deja escribir, se corta o vuelve a 100). Una captura bastaría.

### 1.3 Ver bien la sesión en curso ✅ 🧪
*Puntos: "resaltar ejercicio actual", "tiempo entrenado no se ve".*
- **Cronómetro de sesión** grande en la tarjeta del reloj de Entreno (y en el reloj, en la cabecera), por ejemplo "23:41 · 9/24 series".
- El **ejercicio actual** del plan se resalta con borde lima y "AHORA". Las series hechas se marcan con ✓ y el bloque siguiente se atenúa.

### 1.4 Pantalla de resumen al terminar ✅ 🧪
- Al guardar la sesión se abre un **resumen**:
  - duración, series, toneladas, densidad;
  - pulso medio y máximo, HRR-60 medio;
  - récords (mejor 1RM estimado del ejercicio);
  - músculos trabajados (croquis);
  - racha de la semana.
- Botón "Listo". También se abre desde el historial y la tira de días de la cabecera.
- Reutiliza `sessionMetrics`, `exerciseHistory`, `musclesWorked`, `weekStreak` y `BodyMap`.

---

## Fase 2 — Flexibilidad durante la sesión (P1)

### 2.1 Omitir en el reloj ✅ 🧪
- En la pantalla de serie, deslizar arriba abre un menú con **Omitir serie** y **Omitir ejercicio** (todas sus series restantes).
- Las series omitidas no cuentan como hechas ni para la racha; el teléfono las ve como omitidas.

### 2.2 Cambiar o añadir ejercicios con la sesión empezada ✅ 🧪
- Hoy el editor solo funciona antes de empezar. Con la sesión en curso, en el móvil se podrá:
  - **cambiar** un ejercicio pendiente;
  - **añadir** un ejercicio o un bloque;
  - **quitar** lo que no se haya empezado.
- Se recalcula la cola sin tocar las series ya registradas. El reloj recibe la sesión nueva con el reenvío automático que ya existe.
- **Archivos:**
  - `src/engines/planEdit.ts` (`rebuildQueue` que conserva `qi` registrados, con tests)
  - `src/store/index.ts` (`updateActiveSession`)
  - `EntrenoScreen` (menú ⋯ activo durante la sesión)

### 2.3 Añadir alimento por texto con IA ✅ 🧪
- En "Añadir alimento" se escribe por ejemplo "200 g de pollo a la plancha con arroz" y se pulsa **Completar con IA**.
- La IA rellena la lista editable igual que el escaneo, con selector de porción y comida.
- **Servidor:** acción nueva `food-text` con el mismo esquema `FOOD_SCAN`, sin imagen. Requiere desplegar en Railway.

---

## Fase 3 — Más datos y mejor Coach (P2)

### 3.1 Más datos del reloj
- **Pulso minuto a minuto del día** (`HeartRate.getToday`): curva de pulso de la sesión y FC media real.
- **Estrés** (`Stress.getToday`) y **PAI**: señal extra de recuperación en Hoy.
- **Sueño por fases** si el Bip 6 lo expone, más detalle que solo "profundo".
- Se envía con el `daily` que ya existe. Hace falta comprobar en el reloj qué devuelve cada API y añadir permisos.

### 3.2 Mejorar la sección Coach ❓
- **Propuesta:** un **plan de la semana siguiente** con:
  - grupos a priorizar según el déficit;
  - si toca descarga;
  - ajuste de kcal;
  - 3 acciones concretas.
  
  Además, un resumen visual de la semana (racha, adherencia, récords, peso) y una pregunta libre al Coach con IA sobre tus datos.
- **Falta saber:** qué echas en falta hoy del Coach, para priorizar.

### 3.3 Repeticiones con giroscopio (experimental)
- Hoy se cuentan con el acelerómetro. Combinarlo con el giroscopio (que el Bip 6 tiene) mejoraría los movimientos con rotación (curl, elevaciones) y la pérdida de velocidad.
- Antes hay que grabar datos reales de varios ejercicios para ajustar el detector, así que es un proyecto aparte.

---

## Preguntas abiertas

### ¿Es importante el Motor 80/20?
Mide qué parte de tus series de los últimos 7 días son de tren superior + core frente a tren inferior. El objetivo es ~80/20 para una recomposición centrada en el torso, con la pierna en mantenimiento. También muestra el equilibrio empuje/tracción.
- Es útil como control semanal, pero **no hace falta mirarlo a diario**.
- **Propuesta:** quitarlo de Hoy y llevarlo al Coach como parte del resumen semanal. En Hoy solo aparecería un aviso si te sales del rango.

---

## Orden sugerido
1. **Fase 1.1 + 1.3:** descanso, "LISTO", cronómetro y resaltado. Arreglan lo que más molesta en el gimnasio y comparten QR.
2. **Fase 1.4 + 1.2:** resumen al terminar y peso exacto.
3. **Fase 2.1 + 2.2:** omitir y cambiar sobre la marcha.
4. **Fase 2.3:** comida por texto con IA (junto con el despliegue pendiente del servidor).
5. **Fase 3,** cuando estén resueltas las preguntas abiertas.
