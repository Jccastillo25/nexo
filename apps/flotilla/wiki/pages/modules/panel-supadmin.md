---
type: module
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]]
---

# Panel Super Admin (`/supadmin`)

No estaba en el documento original ([[2026-08-22-mvp-spec-pdf]]) — se agregó a pedido del
usuario como un nivel por encima de las empresas. Completamente aislado del panel de empresa:
tabla propia ([[platform|`platform_admins`]]), login propio (`/supadmin/login`), rama de gate
separada en `proxy.ts` que **nunca** consulta `admins` ni `drivers`.

## Páginas

- **Dashboard** — KPIs de toda la plataforma.
- **`/supadmin/companies`** — listado de empresas con conteo de usuarios/conductores, alta de
  empresa + su primer admin (`/supadmin/companies/new`), edición de perfil (igual a la de
  empresa, más cupos `max_users`/`max_drivers` e `is_active`) — ver [[companies]].
- **`/supadmin/settings`** — configuración de plataforma: nombre de producto, logo, copyright —
  dinámico en toda la app (título de pestaña, manifest PWA, pantallas de login), no hardcodeado
  — ver [[platform|`platform_settings`]].

## Garantía clave

Desactivar una empresa (`companies.is_active = false`) corta el acceso de **todos** sus usuarios
de inmediato, verificado a nivel de RLS (vía `auth_company_id()`/`auth_role()`), no solo de UI —
ver [[modelo-de-roles-y-aislamiento]].

## Archivos clave

`app/supadmin/**`, `app/api/supadmin/**`, `lib/supadmin.ts`, `lib/platform-settings.ts`.

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
