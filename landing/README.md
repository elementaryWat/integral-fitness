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

## API

- `GET /api/waitlist` → `{ count }`
- `POST /api/waitlist` con `{ goal, phone, watch, need[], email, plan }` → `{ position, count, existing }`. Si el email ya existe, actualiza sus respuestas y mantiene su posición.
- `GET /api/waitlist/export[?format=csv]` con `Authorization: Bearer $ADMIN_TOKEN`

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://<dominio>/api/waitlist/export?format=csv" > waitlist.csv
```
