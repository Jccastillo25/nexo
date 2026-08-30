# Ruta360

SaaS multi-tenant de control operativo de transporte: cada empresa cliente gestiona su propia flota, administradores y conductores, con evidencia auditable (GPS, fotos, timestamps de servidor) en cada viaje.

La documentación técnica completa vive en [`docs/`](./docs/README.md):

- **[docs/README.md](./docs/README.md)** — índice, quick start, producción.
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — stack, modelo de roles, autenticación, offline-first, seguridad.
- **[docs/DATABASE.md](./docs/DATABASE.md)** — esquema, RLS, funciones, storage, migraciones.
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — avance por fases.

La wiki técnica viva del proyecto (mantenida por Claude, se actualiza sola con cada cambio) vive
en [`wiki/`](./wiki/index.md) — ver [wiki/index.md](./wiki/index.md) y las convenciones en
[wiki/CLAUDE.md](./wiki/CLAUDE.md).

## Quick start

```bash
npm install
cp .env.local.example .env.local   # completar con credenciales de Supabase
npm run dev
```

Requiere `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta última solo en el servidor).

## Nuevas mejoras

- **Flujo de conductor simplificado**: ahora el conductor ve un único botón que cambia de etiqueta según el estado del viaje y, al completar, es redirigido automáticamente al inicio para iniciar otro viaje sin pasos extra.
- Se removieron botones innecesarios y se optimizó la UI para una experiencia más fluida.

## Producción

- **App:** https://transporte.materialesjcastillo.com
- **Panel Super Admin:** https://transporte.materialesjcastillo.com/supadmin/login
- **Hosting:** Vercel · **Base de datos:** Supabase
