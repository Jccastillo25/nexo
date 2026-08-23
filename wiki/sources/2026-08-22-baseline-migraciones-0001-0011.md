---
type: source
date: 2026-08-22
kind: migration
ref: ../../supabase/migrations/
---

# Baseline — migraciones 0001 a 0011

Estado del esquema antes de la sesión que separó `admins`/`drivers` (migración 0012). Roles
manejados con una sola tabla `users` + columna `role` (`admin`/`driver`), conectada 1:1 a
`auth.users`.

| # | Qué agregó |
|---|---|
| 0001 | Esquema inicial (DDL Sección 4 del PDF), tabla `users` con `role`, RLS base |
| 0002 | Bucket de Storage `evidence` |
| 0003 | Revoca `EXECUTE` público de `auth_company_id`/`auth_role` (hardening) |
| 0004 | Trigger `sync_vehicle_odometer_on_trip_completion` (Fase 3) |
| 0005 | Campos fiscales (`ruc`, `address`, `phone`, `email`) + `logo_url` en `companies` |
| 0006 | Bucket `company-logos` |
| 0007 | Policy SELECT faltante en `company-logos` |
| 0008 | `platform_admins` (Super Admin, tabla independiente desde el día uno), `companies.max_users`/`is_active`, `auth_company_id`/`auth_role` exigen empresa activa |
| 0009 | Fix de privilegios de columna: `REVOKE` de tabla + `GRANT` de columnas específicas (protege `max_users`/`is_active` de auto-edición) |
| 0010 | Policy de `company-logos` para bypass de Super Admin |
| 0011 | `platform_settings` (singleton) + bucket `platform-assets` |

El patrón de `platform_admins` como tabla físicamente separada (no una fila más en `users` con
`role='platform_admin'`) es el precedente que luego se extendió a `admins`/`drivers` en 0012.

## Páginas que actualiza

- [[modelo-de-roles-y-aislamiento]]
- [[companies]]
- [[platform]]
- [[roadmap]]
