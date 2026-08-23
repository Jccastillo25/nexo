---
type: entity
updated: 2026-08-23
sources: [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
---

# `settlements`, `driver_advances`

Ver la lógica de negocio completa (fórmula, quién dispara qué) en [[liquidaciones]]. Esta página
es solo el esquema.

## `settlements`

| Columna | Notas |
|---|---|
| `driver_id` | FK → `drivers.id` |
| `start_date` / `end_date` | Rango del ciclo — `start_date` = `end_date` de la liquidación anterior de ese conductor (o `now()` si es la primera) |
| `status` | enum `settlement_status`: `draft` → `completed`. Nace siempre `draft` |
| `total_freight`, `fuel_cost`, `variable_expenses`, `total_advances`, `final_payout` | `NULL`/`0` hasta el sellado — recién ahí se persiste el snapshot final |
| `sealed_at` | `NULL` mientras está en `draft` |

## `driver_advances`

Anticipos en efectivo entregados a un conductor. `driver_id`, `amount` (`CHECK > 0`),
`description`, `settlement_id` (nullable — `NULL` = "suelto", todavía no liquidado).

## Trigger: enganche automático

`attach_loose_records_to_settlement()` — `AFTER INSERT ON settlements`, `SECURITY DEFINER`.
Cuando nace una liquidación (`draft`), engancha automáticamente (`settlement_id = NEW.id`) todo
lo que estaba suelto de ese conductor: `trips` con `status = 'completed' AND settlement_id IS
NULL`, y `driver_advances` con `settlement_id IS NULL`. `SECURITY DEFINER` porque el conductor
dispara este INSERT (política de abajo) pero no tiene permiso `UPDATE` directo sobre
`driver_advances` — el enganche es un efecto controlado, no un permiso general.

## Trigger: inmutabilidad

`prevent_update_on_settled_trip()` — `BEFORE UPDATE ON trips`. Si `OLD.settlement_id` apunta a
una liquidación `completed`, rechaza el `UPDATE`. Ver [[liquidaciones]].

## `trips.settlement_id`

Columna agregada en la `0018` (nullable, FK → `settlements.id`). No necesitó política RLS nueva:
la existente `trips_update_own_or_admin` (conductor dueño o admin) ya cubre cualquier columna,
incluida esta.

## RLS

| Tabla | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `settlements` | Admin de la empresa, o el propio conductor | Admin, o el propio conductor (solo naciendo en `draft`) | Solo admin (gastos, sellado) |
| `driver_advances` | Solo admin | Solo admin | Solo admin |

El conductor **no** puede ver ni crear `driver_advances` directamente — solo las recibe
enganchadas vía el trigger cuando cierra su ciclo.

## Dónde se gestiona

`/admin/settlements` (lista + detalle + sellado + PDF) y la sección "Anticipos" en
`/admin/drivers/[driverId]` — ver [[panel-admin]]. El conductor dispara el cierre desde su
dashboard — ver [[driver-app]].

## Fuentes

- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
