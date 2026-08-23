---
type: overview
updated: 2026-08-22
sources: [[2026-08-22-mvp-spec-pdf]]
---

# Ruta360 — overview

SaaS multi-tenant de control operativo de transporte: cada empresa cliente (tenant) gestiona su
propia flota, conductores y viajes, con evidencia auditable (GPS, fotos, timestamps de servidor)
en cada paso del ciclo de viaje.

## Los tres niveles

```
Super Admin (plataforma Ruta360) — tabla platform_admins
  └─ opera /supadmin — crea y administra empresas, no pertenece a ninguna
     │
     ├─ Empresa A
     │    ├─ Admin de empresa — tabla admins — opera /admin
     │    └─ Conductor(es) — tabla drivers — opera /driver
     │
     └─ Empresa B, C, ... (mismo patrón, datos completamente aislados entre sí)
```

Los tres niveles están aislados **estructuralmente**: cada uno vive en su propia tabla de
identidad que nunca se mezcla con las otras. Detalle y porqué en
[[modelo-de-roles-y-aislamiento]].

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS 4 |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth nativo — ver [[autenticacion]] |
| Storage | Supabase Storage (buckets `evidence`, `company-logos`, `platform-assets`) |
| Hosting | Vercel |
| Gateway de rutas | `proxy.ts` (reemplaza `middleware.ts` desde Next.js 16) |

Next.js 16 tiene cambios de convención respecto a versiones previas — antes de tocar
convenciones de archivo, revisar `node_modules/next/dist/docs/` (instrucción fija del repo, ver
`AGENTS.md` en la raíz).

## Mapa de la wiki

- [[roadmap]] — qué se construyó, en qué orden, qué falta.
- Conceptos: [[modelo-de-roles-y-aislamiento]] · [[autenticacion]] · [[offline-first]] ·
  [[gestion-por-excepcion]]
- Entidades: [[companies]] · [[admins]] · [[drivers]] · [[fleet]] · [[trips]] · [[platform]]
- Módulos: [[panel-admin]] · [[panel-supadmin]] · [[driver-app]] · [[panel-autorizaciones]]

## Fuera de alcance actual

- Leaked Password Protection de Supabase Auth (requiere plan Pro de pago) — evaluado y
  pausado a pedido explícito del usuario.
- Vista de "impersonar" empresa desde Super Admin — deliberadamente no se pidió.
- Exportes CSV/PDF de reportes — no forma parte del plan original ni se ha pedido.

## Fuentes

- [[2026-08-22-mvp-spec-pdf]]
