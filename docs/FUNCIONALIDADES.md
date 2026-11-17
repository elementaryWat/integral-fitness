# Wrep — funcionalidades

Lista viva de lo que hace la app, para ir marcando qué está hecho, qué falta probar y qué falta construir.
El detalle técnico y el estado de despliegue están en [`PROGRESO.md`](PROGRESO.md).

**Leyenda:** ✅ hecho y probado en el iPhone · 🧪 hecho, falta probar en el iPhone · ⏳ pendiente · 💡 idea

Cuando cambie algo, actualiza la marca y la fecha de la última columna (`AAAA-MM-DD`).

---

## 1. Inicio y perfil

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Onboarding en varios pasos | Nombre, sexo, edad, altura, peso, % grasa, objetivo, experiencia | |
| ✅ | Editar perfil | Pantalla `ProfileEdit` | |
| ✅ | Nombre propio en toda la app | Sin nombres fijos de ejemplo | |
| ✅ | Datos de ejemplo para probar | Opción del onboarding | |
| 🧪 | Editar perfil muestra la última pesada (no la media) | La media de 7 días aparece debajo | 2026-11-14 |
| 🧪 | Masa muscular esquelética en el perfil | Opcional, 10–80 kg | 2026-11-14 |

## 2. Hoy

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| 🧪 | Recuperación sin HRV: FC reposo + estrés nocturno + sueño vs 7 días | Provisional los 3 primeros días | 2026-11-14 |
| 🧪 | Recomendación del día (fuerte / normal / suave / descanso) | Cruza recuperación con la fatiga de cada músculo | 2026-11-14 |
| 🧪 | Sueño total con % profundo, pasos con objetivo 8.000 y PAI | | 2026-11-14 |
| 🧪 | Detalle de recuperación (tocar la tarjeta) | 7 días por métrica con media y tendencia | 2026-11-14 |
| 🧪 | Apple Health rellena FC en reposo y sueño por fases | Sin abrir el reloj | 2026-11-14 |
| ✅ | Resumen del día (sesión, macros, energía) | | |
| ✅ | Tarjeta de recuperación con métricas del reloj | Pasos, sueño profundo, FC en reposo | |
| 🧪 | HRV nocturno desde Apple Health | Permiso dado; falta confirmar que aparece | |
| ✅ | Puntuación de recuperación | Necesita 3 días de base | |
| ✅ | Registro manual de actividad | `ActivityEntryScreen` | |
| ✅ | Indicador de conexión con el reloj | Abre la pantalla Reloj | |
| 🧪 | Aviso 80/20 solo si te sales del rango | La tarjeta completa pasó a Coach | 2026-11-14 |

## 3. Entreno

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Elegir grupos musculares del día | Bíceps y tríceps por separado | |
| ✅ | Grupos relacionados recomendados | | |
| ✅ | Sesión generada según volumen semanal y déficit | Ajusta por nivel de experiencia y descarga | |
| ✅ | Superseries por bloques con rondas | | |
| ✅ | Progresión de cargas según historial | | |
| ✅ | Editor de sesión | Cambiar, añadir, quitar, mover, separar, unir bloques; rondas −/+ | |
| ✅ | Buscador de ejercicios con recomendados arriba | Alternativas por similitud, antagonistas, músculos con déficit | |
| ✅ | Mis rutinas: guardar y cargar | Pulsación larga para borrar | |
| 🧪 | Armar rutina con IA | Respeta los grupos elegidos y los minutos | |
| ✅ | Croquis de músculos trabajados (oculto por defecto) | Frente y espalda, series por músculo | |
| ✅ | Sesión en curso con registro de series y descanso | | |
| ✅ | Historial de sesiones | | |
| 🧪 | Racha de semanas cumplidas y de días del plan | Descansar no rompe; un día extra recupera un fallo | 2026-11-13 |
| 🧪 | Semana actual en la cabecera de Entreno (L–D) | Toca un día entrenado para ver su sesión | 2026-11-13 |
| 🧪 | Cronómetro de sesión y progreso (9/24 series) | Tarjeta del reloj en Entreno | 2026-11-14 |
| 🧪 | Ejercicio actual resaltado ("AHORA") y bloques hechos ✓ | Usa el ejercicio que marca el reloj si está emparejado | 2026-11-14 |
| 🧪 | Carga exacta en el móvil | Toca el número de carga para escribirlo (66, 102,5) | 2026-11-14 |
| 🧪 | Omitir serie, resto del ejercicio o superserie (móvil y reloj) | No cuentan como trabajo ni se guardan en el historial | 2026-11-14 |
| 🧪 | Cambiar, añadir o quitar ejercicios con la sesión empezada | Menú ⋯; lo registrado se conserva y el reloj recarga la sesión | 2026-11-14 |
| 🧪 | Resumen al terminar la sesión | Duración, tonelaje, pulso, ejercicios con cada serie (carga × reps · RPE), récords, músculos, racha; también desde historial y cabecera | 2026-11-14 |
| 🧪 | Descansos reales en el resumen | Medio, más largo, transiciones; ↺ antes de cada serie | 2026-11-14 |
| 🧪 | Tiempo por ejercicio, serie y bloque (superserie) | En el resumen | 2026-11-14 |
| 🧪 | ¿Cómo te sientes? al terminar (1–5 + etiquetas) | Se guarda en la sesión | 2026-11-14 |
| 🧪 | % de sesión restante y minutos (móvil) | Ritmo real tras 2 series; antes, estimación del plan | 2026-11-14 |

## 4. Biblioteca de ejercicios

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Biblioteca organizada por grupo muscular | | |
| ✅ | Catálogo amplio (gimnasio, peso corporal, cardio) | | |
| ✅ | Búsqueda por nombre o músculo | | |
| ✅ | Crear y editar ejercicios propios | | |
| 🧪 | Rellenar ejercicio con IA a partir de una descripción | Ahora también escribe la técnica | 2026-11-13 |
| 🧪 | Detalle de ejercicio con croquis (principal / secundario) | Desde Biblioteca, Entreno (ⓘ) y buscador | 2026-11-13 |
| 🧪 | Técnica de los 73 ejercicios del catálogo | Preparación, ejecución, respiración, errores, dónde sentirlo | 2026-11-13 |
| 🧪 | Vídeo de técnica (búsqueda en YouTube) | | 2026-11-13 |
| 🧪 | Historial por ejercicio: última vez, mejor marca, 1RM 8 semanas | | 2026-11-13 |
| 🧪 | Croquis en vivo al editar músculos | | 2026-11-13 |

## 5. Nutrición

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Objetivos de macros y kcal según objetivo y TDEE | | |
| ✅ | Añadir alimentos a mano | | |
| 🧪 | Escanear plato con IA | Añade a hoy | |
| 🧪 | Escanear etiqueta nutricional con IA | Añade a hoy o guarda en la despensa | |
| 🧪 | Escanear ticket del súper con IA | Guarda productos en la despensa | |
| 🧪 | Despensa: añadir producto eligiendo gramos | Macros por 100 g | |
| 🧪 | Selector de porción (−/+ y ½ · 1 · 1½ · 2 de lo detectado) | Recalcula macros; "Corregir macros" para editarlos | 2026-11-13 |
| 🧪 | Comidas de otro día: tira semanal en Nutrición (‹ › por semana, kcal por día) | Añadir, escanear o escribir con IA van al día elegido; aviso si no es hoy; "Copiar a hoy" | 2026-11-15 |
| 🧪 | Comida del día: desayuno, almuerzo, snack, cena | Lista agrupada con subtotal; tocar un alimento para moverlo o borrarlo | 2026-11-13 |
| 🧪 | Añadir alimento por texto con IA | "200 g de pollo con arroz" → lista editable; requiere desplegar el servidor | 2026-11-14 |

## 6. Cuerpo

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| 🧪 | Medidas de cualquier día (‹ ›) | Corrige peso, grasa, masa muscular y perímetros de días anteriores; tocar las tarjetas abre el editor | 2026-11-14 |
| 🧪 | Lista de pesajes con corregir y borrar | El pesaje del día de inicio es el peso inicial del perfil y se sincroniza | 2026-11-14 |
| ✅ | Registro de peso, grasa y medidas | `BodyEntryScreen` | |
| ✅ | Gráficas de tendencia | | |
| ✅ | Fotos de progreso (se quedan en el móvil) | | |

## 7. Coach

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Revisión semanal con reglas (señales y propuestas) | `coachRules` | |
| 🧪 | Revisión con IA en lenguaje natural | Se guarda por semana; botón Regenerar y aviso cuando tus datos cambiaron | 2026-11-14 |
| 🧪 | Lectura de fotos con IA (con aviso) | Última serie (frente, perfil, espalda) + frente anterior, cruzada con peso, báscula, volumen, proteína y señales; grasa estimada a la vista; no se guardan en el servidor | 2026-11-14 |
| 🧪 | Motor 80/20 semanal | Movido desde Hoy | 2026-11-14 |

## 8. Reloj (Amazfit Bip 6)

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Mini-app Wrep en el reloj | appId 1136058 | |
| ✅ | El reloj recibe la sesión del teléfono | Vía servidor en Railway; funciona en el gimnasio | |
| ✅ | Registrar series desde el reloj y temporizador de descanso | | |
| 🧪 | Descanso: el pulso solo lo termina tras máx(60 s, 60 %) | Antes cortaba a los 20 s | 2026-11-14 |
| 🧪 | Estado "LISTO": la serie no empieza sola | Empieza al tocar EMPEZAR; recordatorio a +1 min | 2026-11-14 |
| 🧪 | "+30 s" en el descanso (reloj y móvil) | | 2026-11-14 |
| 🧪 | Paso fino de carga en el reloj | Toca la carga: pasa a 1 kg (o 0,5) y la cabecera dice FINO | 2026-11-14 |
| 🧪 | Menú ⋯ en el reloj: omitir serie / ejercicio / superserie | | 2026-11-14 |
| 🧪 | Tiempo de sesión en la cabecera del reloj | | 2026-11-14 |
| 🧪 | % restante en el reloj | Serie: "QUEDA 38%"; descanso: tiempo · % · ~min | 2026-11-14 |
| 🧪 | Reloj envía estrés (día y noche), fases de sueño, puntuación de sueño y PAI | Estrés y PAI de 7 días al abrir la app | 2026-11-14 |
| ✅ | Frecuencia cardíaca en vivo | | |
| ✅ | Pasos, sueño y FC en reposo al teléfono | | |
| 🧪 | Icono nuevo de tres barras en el reloj | Instalar el último QR | |
| ⏳ | Introducir el código de emparejamiento desde el reloj | Ahora va grabado en el código | |
| ✅ | Mostrar en el teléfono el descanso real del reloj | El tiempo en LISTO cuenta como descanso | 2026-11-14 |

## 9. Servidor e infraestructura

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Servidor puente en Railway | Sesión, series, en vivo, métricas diarias | |
| ✅ | IA con OpenAI en el servidor (la key nunca va en la app) | Escaneo, ejercicio, coach, rutina | |
| ✅ | Control de gasto: códigos autorizados y cuota diaria | `AI_ACCESS_CODES`, `AI_DAILY_LIMIT` | |

## 10. Marca

| Estado | Funcionalidad | Notas | Últ. cambio |
|---|---|---|---|
| ✅ | Logo de tres barras (iOS, Android, reloj) | | |
| 🧪 | Nombre "Wrep" en el iPhone, el reloj y la IA | Antes "Recomp"; bundle id y appId del reloj sin cambios | 2026-11-14 |
| 🧪 | Splash screen con el logotipo WREP · FITNESS | `assets/brand/make_icons.py` genera iconos y splash | 2026-11-14 |
| 🧪 | Landing web con lista de espera (encuesta de 4 preguntas + email) y analítica con PostHog | `landing/`, servicio propio en Railway; falta desplegar, montar un Volume y poner `POSTHOG_KEY` | 2026-11-17 |

---

## Pendiente y próximas ideas

Las mejoras de entreno priorizadas (descanso, peso exacto, resumen, omitir, etc.) están en [`MEJORAS.md`](MEJORAS.md).
La hoja de ruta general (SideStore, usuarios de prueba, login, datos multiusuario, modo calistenia y sobrecarga progresiva) está en [`ROADMAP.md`](ROADMAP.md).

| Estado | Funcionalidad | Notas |
|---|---|---|
| ⏳ | Health Connect en Android | HRV, pasos y sueño como en iOS |
| ⏳ | Kcal activas de Apple Health en el TDEE | Hoy el NEAT se estima |
| ⏳ | Firma de pago de Apple | La versión gratuita caduca cada 7 días |
| 💡 | Copia de seguridad o sincronización de datos | Hoy todo vive solo en el móvil |
| 💡 | Subir la rama y abrir PR en GitHub | |
