# Wrep · landing

Landing pública con lista de espera. Servidor Node sin dependencias: sirve `public/` y guarda las inscripciones en un JSON.

```bash
npm start   # http://localhost:3000
npm test
```

## Despliegue en Railway

1. En el mismo proyecto de Railway, **New → GitHub Repo** con este repositorio y crea un servicio nuevo (no el del `server/`).
2. **Settings → Root Directory:** `/landing`. Railway lee `railway.json` (arranque con `node src/server.js`, healthcheck en `/health`) y solo redespliega cuando cambia algo en `landing/`.
3. **Volume:** monta uno en el servicio (por ejemplo en `/data`). El servidor usa `RAILWAY_VOLUME_MOUNT_PATH` automáticamente y guarda en `waitlist.json`. **Sin volumen, la lista se borra en cada despliegue.**
4. **Networking → Generate Domain** (o añade tu dominio propio).

### Variables

| Variable | Para qué | Por defecto |
|---|---|---|
| `ADMIN_TOKEN` | Habilita la exportación de la lista. Sin ella, la exportación está cerrada | vacío |
| `WAITLIST_BASE_COUNT` | Número que se suma al contador público y a la posición | `0` |
| `WAITLIST_FILE` | Ruta del JSON (si no usas el volumen) | `data/waitlist.json` |
| `PORT` | La pone Railway | `3000` |
| `POSTHOG_KEY` | Project API key de PostHog (`phc_…`). Sin ella no se carga la analítica | vacío |
| `POSTHOG_HOST` | Región de PostHog: `https://eu.i.posthog.com` o `https://us.i.posthog.com` | EU |

## Analítica (PostHog)

- `analytics.js` carga posthog-js con el snippet oficial. La clave llega de `/config.js`, que la genera el servidor a partir de `POSTHOG_KEY`, así que no está en el repo.
- Los eventos van a `/ingest/*` en nuestro dominio y el servidor los reenvía a PostHog. Así los bloqueadores de anuncios no los cortan.
- `persistence: 'memory'`: sin cookies ni localStorage, así que no hace falta banner de consentimiento. A cambio, un visitante que vuelve otro día cuenta como nuevo.
- Nunca se envía el email.

| Evento | Propiedades |
|---|---|
| `$pageview`, `$pageleave` | automáticos (+ `utm_*` y `ref` de la URL) |
| `waitlist_opened` | `plan`, `source` (`cabecera`, `hero`, `plan_gratis`, `plan_premium`) |
| `waitlist_step_completed` | `plan`, `step`, `question`, `answer` |
| `waitlist_joined` | `plan`, `source`, `goal`, `phone`, `watch`, `need`, `existing` |
| `waitlist_abandoned` | `plan`, `source`, `step`, `question` (se cerró sin terminar) |
| `waitlist_error` | `plan`, `error` |
| `carousel_slide_selected` | `slide` |

En PostHog, un **Funnel** `waitlist_opened → waitlist_step_completed (step 1…4) → waitlist_joined`, desglosado por `source`, muestra dónde se cae la gente.

## API

- `GET /api/waitlist` → `{ count }`
- `POST /api/waitlist` con `{ goal, phone, watch, need[], email, plan }` → `{ position, count, existing }`. Si el email ya existe, actualiza sus respuestas y mantiene su posición.
- `GET /api/waitlist/export[?format=csv]` con `Authorization: Bearer $ADMIN_TOKEN`

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://<dominio>/api/waitlist/export?format=csv" > waitlist.csv
```
