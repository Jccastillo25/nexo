---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# `drivers`

Conductores de una empresa. Tabla independiente de [[admins]] (ver
[[modelo-de-roles-y-aislamiento]]). `id` es el mismo id de `auth.users`, pero **sin
contraseña** — la cuenta se crea sin `password`; el único login soportado es usuario + PIN (ver
[[autenticacion]]).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `company_id` | uuid FK → `companies.id`, NOT NULL | |
| `email` | varchar, unique | Dato de contacto — **no** se usa para login |
| `first_name` / `last_name` | varchar, NOT NULL | |
| `full_name` | varchar, NOT NULL | `first_name + ' ' + last_name`, mantenido en cada escritura |
| `username` | varchar, NOT NULL, **único en toda la plataforma** (case-insensitive) | Login por PIN — único global porque el login no conoce la empresa todavía cuando busca |
| `pin_code` | varchar(4), `CHECK` 4 dígitos, único **por empresa** | Autogenerado (`lib/generate-pin.ts`), el admin puede verlo y regenerarlo |
| `national_id` | varchar, NOT NULL | No. de identificación |
| `license_number`, `license_type` | varchar, nullable | |
| `license_expiry` | date, NOT NULL | |
| `is_active` | boolean, default `true` | |
| `created_at` | timestamptz | |

Categorías de licencia asignadas vía `driver_license_categories` (M:N contra
`license_categories`, catálogo por empresa) — ver [[fleet]].

## RLS

SELECT: admin de la misma empresa, o el propio conductor (solo su fila, para su header).
INSERT/UPDATE/DELETE: **solo admin** — un conductor no puede escribir ni su propia fila. Antes
del rediseño de `0012` (tabla `users` compartida) un conductor sí podía auto-editarse vía RLS;
se cerró como efecto colateral positivo.

## Cupo

Independiente de `admins` vía `companies.max_drivers` — ver [[companies]].

## Dónde se gestiona

`/admin/drivers` (alta con todos los campos, filtros, edición, panel de PIN) — ver
[[panel-admin]]. Login del conductor en `/login` (modo PIN) — ver [[driver-app]].

## Fuentes

- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
