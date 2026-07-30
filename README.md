# Ruta360

SaaS multi-tenant de control operativo de transporte: cada empresa cliente gestiona su propia flota, administradores y conductores, con evidencia auditable (GPS, fotos, timestamps de servidor) en cada viaje.

La documentación técnica completa vive en [`docs/`](./docs/README.md):

- **[docs/README.md](./docs/README.md)** — índice, quick start, producción.
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — stack, modelo de roles, autenticación, offline-first, seguridad.
- **[docs/DATABASE.md](./docs/DATABASE.md)** — esquema, RLS, funciones, storage, migraciones.
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — avance por fases.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # completar con credenciales de Supabase
npm run dev
```

Requiere `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta última solo en el servidor).

## Producción

- **App:** https://transporte.materialesjcastillo.com
- **Panel Super Admin:** https://transporte.materialesjcastillo.com/supadmin/login
- **Hosting:** Vercel · **Base de datos:** Supabase
