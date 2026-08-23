# Ruta360 — Documentación del sistema

Ruta360 es un SaaS multi-tenant de control operativo de transporte: cada empresa cliente (tenant) gestiona su propia flota, conductores y viajes, con evidencia auditable (GPS, fotos, timestamps de servidor) en cada paso.

Este directorio contiene la documentación técnica del sistema. Para el avance del proyecto por fases, ver [ROADMAP.md](./ROADMAP.md).

## Índice

- **[ROADMAP.md](./ROADMAP.md)** — Blueprint de avance por fases: qué se construyó, cuándo, y qué falta.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Stack técnico, modelo de tres niveles (Super Admin / Empresa / Conductor), flujos de autenticación, estrategia offline-first, modelo de seguridad.
- **[DATABASE.md](./DATABASE.md)** — Referencia completa del esquema: tablas, RLS, funciones, triggers, buckets de Storage.

> **Wiki viva:** además de estos documentos (reescritos a mano en cada actualización), el
> proyecto mantiene una wiki auto-mantenida por Claude en [`../wiki/`](../wiki/index.md) —
> páginas interlinkadas por entidad/concepto/módulo, con historial de fuentes y un log
> cronológico. Ver [`wiki/CLAUDE.md`](../wiki/CLAUDE.md) para las convenciones.

## Los tres niveles del sistema

```
Super Admin (plataforma Ruta360)
  └─ opera /supadmin — crea y administra empresas, no pertenece a ninguna
     │
     ├─ Empresa A (ej. "Grupo CT")
     │    ├─ Admin de empresa — opera /admin — gestiona flota, conductores, viajes de SU empresa
     │    └─ Conductor(es) — opera /driver — ejecuta el ciclo de viaje
     │
     └─ Empresa B, C, ... (mismo patrón, datos completamente aislados entre sí)
```

Los tres niveles están **aislados por diseño**, cada uno en su propia tabla de identidad (`platform_admins`, `admins`, `drivers`) que nunca se mezcla con las otras: un Super Admin no pertenece a ninguna empresa, y ningún usuario de empresa puede convertirse en Super Admin sin una inserción manual en `platform_admins`. Ver [ARCHITECTURE.md](./ARCHITECTURE.md#modelo-de-roles) para el detalle.

## Quick start (desarrollo local)

```bash
npm install
cp .env.local.example .env.local   # completar con tus credenciales de Supabase
npm run dev
```

Requiere `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta última solo en el servidor, nunca en el cliente).

## Producción

- **App:** https://transporte.materialesjcastillo.com
- **Panel Super Admin:** https://transporte.materialesjcastillo.com/supadmin/login
- **Repositorio:** https://github.com/Jccastillo25/transporte-saas
- **Hosting:** Vercel (proyecto `transporte-saas`)
- **Base de datos:** Supabase (proyecto `transporte-saas`, ref `nqfkbbvzkhssxnfaiwhm`)
