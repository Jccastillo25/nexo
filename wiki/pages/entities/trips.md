---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]], [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
---

# Ciclo de viaje — `trips`, `trip_events`, `trip_inspections`, `trip_anomalies`, `anomaly_categories`

## `trips` — cabecera del viaje

| Columna | Notas |
|---|---|
| `status` | enum `trip_status`: `created` → `inspected` → `in_transit` → `at_destination` → `unloading` → `unloading_completed` → `completed` (o `cancelled`). Rama lateral: `inspected` puede desviarse a `pending_authorization` si la inspección reporta una novedad bloqueante — ver [[gestion-por-excepcion]] |
| `start_odometer` / `end_odometer` | `CHECK (end_odometer >= start_odometer)` |
| `start_odometer_photo_url` (NOT NULL) / `end_odometer_photo_url` | Evidencia fotográfica obligatoria, bucket `evidence` |
| `driver_id` | FK → `drivers.id` (antes de la migración `0012`, → `users.id`) |
| `completed_at` | |

## `trip_events` — log inmutable, append-only

Un evento por hito del viaje (`start_trip`, `arrival_destination`, `start_unloading`,
`end_unloading`, `finish_trip`), con `latitude`/`longitude`/`gps_accuracy` y `synced_offline`
(ver [[offline-first]]). **Sin políticas UPDATE ni DELETE** — la inmutabilidad es una garantía
de RLS, no solo convención de la app.

## `trip_inspections` — checklist de inspección previa (accesorios)

Un registro por accesorio revisado en el check-in: `is_present`, `has_damage`,
`issue_description`, `issue_photo_url`. Igual que `trip_events`, sin UPDATE/DELETE. Coexiste con
el nuevo flujo de [[gestion-por-excepcion|gestión por excepción]] — el checklist de accesorios
no desapareció, dejó de ser el gate obligatorio de la pantalla principal de inspección.

## `trip_anomalies` — reportes de novedad (gestión por excepción)

Agregada en la migración `0014`, reemplazado su enum estático de categorías por FK en la `0015`.
Log inmutable (solo SELECT + INSERT): `trip_id`, `category_id` (FK →
`anomaly_categories`), `description` (nullable), `photo_url` (bucket `evidence`, requiere URL
firmada para mostrarse — `getEvidencePhotoSignedUrl`).

## `anomaly_categories` — catálogo editable de categorías de novedad

Por empresa: `name`, `blocks_trip` (boolean). Administrable en `/admin/incident-categories`.
Reemplazó un enum estático de 5 categorías fijas — ver [[gestion-por-excepcion]] para la regla
de negocio detrás de qué bloquea y qué no.

## Trigger {#trigger}

`sync_vehicle_odometer_on_trip_completion()` — `AFTER UPDATE ON trips`. Cuando `status` pasa a
`completed` con `end_odometer` definido, actualiza `vehicles.current_odometer`. `SECURITY
DEFINER` porque quien completa el viaje es normalmente el conductor, que no tiene permiso de
`UPDATE` sobre `vehicles`.

## RLS (resumen)

| Tabla | SELECT | INSERT | UPDATE/DELETE |
|---|---|---|---|
| `trips` | Toda la empresa | Conductor dueño o admin | Conductor dueño o admin (nunca DELETE — se cancela vía `status`) |
| `trip_events`, `trip_inspections`, `trip_anomalies` | Toda la empresa | Conductor dueño del viaje o admin | — (inmutables) |

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
