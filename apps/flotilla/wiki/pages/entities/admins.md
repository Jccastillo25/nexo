---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# `admins`

Administradores de una empresa. Tabla independiente de [[drivers]] — nunca comparten fila ni
tabla (ver [[modelo-de-roles-y-aislamiento]]). Reemplazó, junto con `drivers`, a la vieja tabla
única `users` en la migración `0012`.

`id` **es** el mismo id de `auth.users` (relación 1:1).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `company_id` | uuid FK → `companies.id`, NOT NULL | |
| `email` | varchar, unique (case-insensitive) | Login por contraseña — ver [[autenticacion]] |
| `full_name` | varchar | |
| `is_active` | boolean, default `true` | |
| `created_at` | timestamptz | |

## RLS

SELECT: admins de la misma empresa. INSERT/UPDATE/DELETE: admin de la empresa. El alta real
ocurre vía Route Handler con `service_role` (`app/api/admin/admins/route.ts`), porque crear una
fila en `auth.users` requiere privilegios que RLS no otorga a un cliente normal.

## Cupo

Contado y limitado independientemente de `drivers` vía `companies.max_users` — ver
[[companies]].

## Dónde se gestiona

`/admin/admins` (alta, edición, reseteo de contraseña) — ver [[panel-admin]].

## Fuentes

- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
