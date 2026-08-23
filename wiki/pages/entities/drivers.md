---
type: entity
updated: 2026-08-23
sources: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]], [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
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
| `commission_percentage` | numeric(5,2), `CHECK` 0–100, default `0` | Agregada en `0017` — base del cálculo de [[liquidaciones]] |
| `current_vehicle_id` | uuid, FK → `vehicles.id`, nullable | Agregada en `0016`. Vehículo asignado por el admin; el dashboard del conductor lo usa para saltarse la selección en el caso común (sigue siendo cambiable caso a caso) |

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

`/admin/drivers` (alta con todos los campos, filtros, edición, panel de PIN, comisión y vehículo
asignado) — ver [[panel-admin]]. Login del conductor en `/login` (modo PIN) — ver [[driver-app]].
Anticipos (`driver_advances`, ver [[settlements]]) se registran en la misma página de edición del
conductor.

## Fuentes

- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
