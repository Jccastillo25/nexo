---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]], [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# `companies`

Un tenant por fila. Base de todo el aislamiento multi-tenant — ver
[[modelo-de-roles-y-aislamiento]].

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name`, `ruc`, `address`, `phone`, `email` | varchar/text | Datos fiscales/contacto de la empresa (no del admin) |
| `logo_url` | varchar | Bucket público `company-logos` |
| `max_users` | int, nullable | Cupo de [[admins|administradores]]. `NULL` = sin límite. Editable **solo** por Super Admin (columna bloqueada para `authenticated`) |
| `max_drivers` | int, nullable | Cupo de [[drivers|conductores]], independiente del anterior desde la migración `0013`. Editable **solo** por Super Admin |
| `is_active` | boolean, default `true` | Editable **solo** por Super Admin. `false` corta el acceso de **todos** sus usuarios vía `auth_company_id()`/`auth_role()` |
| `created_at` | timestamptz | |

## RLS

Un admin de la propia empresa puede editar nombre/RUC/dirección/teléfono/correo/logo por RLS
normal. **No puede** auto-ampliar su cupo ni reactivar su empresa así manipule la petición HTTP
directamente — `max_users`, `max_drivers` e `is_active` tienen privilegios de columna revocados
para `authenticated` y solo re-otorgados a nivel de Postgres para Super Admin. El bloqueo es de
base de datos, no de la UI.

## Quién la gestiona

- Alta y cupos: Super Admin, ver [[panel-supadmin]].
- Edición del perfil de empresa (datos no bloqueados): admin de empresa, ver [[panel-admin]].

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
