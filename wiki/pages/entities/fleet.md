---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]], [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# Flota — `vehicles`, `accessories`, `license_categories`

## `vehicles`

`company_id`, `license_plate` (único por empresa), `brand`, `model`, `current_odometer`
(sincronizado automáticamente al completar un viaje, ver [[trips#trigger]]), `status` (enum
`active`/`maintenance`/`inactive`). Una novedad denegada en [[panel-autorizaciones]] pone el
vehículo en `maintenance` automáticamente.

## `accessories` / `vehicle_accessories`

Catálogo de accesorios de checklist por empresa (`accessories`: `company_id`, `name`) y qué
accesorios aplican a qué vehículo (`vehicle_accessories`, PK compuesta). Administrado en
`/admin/accessories` y al dar de alta un vehículo — ver [[panel-admin]].

## `license_categories` / `driver_license_categories`

Catálogo de categorías de licencia por empresa (mismo patrón que `accessories`), agregado en la
migración `0012` junto con el resto del perfil de conductor ampliado. `driver_license_categories`
es la asignación M:N a [[drivers]] (PK compuesta `driver_id`+`category_id`,
`ON DELETE CASCADE`). Administrado en `/admin/license-categories`.

## RLS

Todas: SELECT para toda la empresa, INSERT/UPDATE/DELETE solo admin.

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
