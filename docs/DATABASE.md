# Base de datos

Proyecto Supabase: `transporte-saas` (ref `nqfkbbvzkhssxnfaiwhm`). Todas las migraciones están versionadas en [`supabase/migrations/`](../supabase/migrations/), en orden de aplicación.

## Tablas

### `companies` — un tenant por fila

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | |
| `ruc` | varchar | Identificación fiscal |
| `address` | text | |
| `phone` | varchar | |
| `email` | varchar | Contacto de la empresa (no del admin) |
| `logo_url` | varchar | URL pública en bucket `company-logos` |
| `max_users` | int, nullable | `NULL` = sin límite. Editable **solo** por Super Admin (columna bloqueada para `authenticated`) |
| `is_active` | boolean, default `true` | Editable **solo** por Super Admin. `false` corta el acceso de todos sus usuarios |
| `created_at` | timestamptz | |

### `users` — admins y conductores de una empresa

`id` **es** el mismo id de `auth.users` (relación 1:1, no se guarda password propio — Supabase Auth ya lo gestiona).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `company_id` | uuid FK → `companies.id`, NOT NULL | |
| `email` | varchar unique | |
| `full_name` | varchar | |
| `role` | enum `user_role` (`admin`, `driver`) | |
| `pin_code` | varchar(10), nullable | Login rápido por PIN |
| `is_active` | boolean, default `true` | |
| `created_at` | timestamptz | |

### `vehicles`

`company_id`, `license_plate` (único por empresa), `brand`, `model`, `current_odometer` (actualizado automáticamente al completar un viaje — ver [trigger](#trigger-sync_vehicle_odometer)), `status` (enum `active`/`maintenance`/`inactive`).

### `accessories` — catálogo de accesorios de checklist, por empresa

`company_id`, `name`.

### `vehicle_accessories` — qué accesorios aplican a qué vehículo

PK compuesta (`vehicle_id`, `accessory_id`).

### `trips` — cabecera del viaje

| Columna | Notas |
|---|---|
| `status` | enum `trip_status`: `created` → `inspected` → `in_transit` → `at_destination` → `unloading` → `unloading_completed` → `completed` (o `cancelled`) |
| `start_odometer` / `end_odometer` | `CHECK (end_odometer >= start_odometer)` |
| `start_odometer_photo_url` (NOT NULL) / `end_odometer_photo_url` | Evidencia fotográfica obligatoria en el bucket `evidence` |
| `completed_at` | |

### `trip_events` — log inmutable, append-only

Un evento por hito del viaje (`start_trip`, `arrival_destination`, `start_unloading`, `end_unloading`, `finish_trip`), con `latitude`/`longitude`/`gps_accuracy` y `synced_offline`. **Sin políticas UPDATE ni DELETE** — la inmutabilidad es una garantía de RLS, no solo una convención de la app.

### `trip_inspections` — checklist de inspección previa

Un registro por accesorio revisado en el check-in: `is_present`, `has_damage`, `issue_description`, `issue_photo_url`. Igual que `trip_events`, sin UPDATE/DELETE.

### `platform_admins` — operadores de la plataforma (Super Admin)

Tabla independiente de `users` (ver justificación en [ARCHITECTURE.md](./ARCHITECTURE.md#modelo-de-roles)). Solo `user_id` (FK → `auth.users.id`) y `created_at`. El alta se hace manualmente por SQL — no hay flujo de auto-registro.

### `platform_settings` — configuración de Ruta360 (singleton)

Una única fila (`id = 1`, forzado por `CHECK`). `product_name`, `logo_url` (bucket `platform-assets`), `copyright_text`. Lectura pública (hasta las pantallas de login sin sesión la necesitan); escritura solo vía `PATCH /api/supadmin/settings`.

## Funciones

### `auth_company_id()` / `auth_role()`

`SECURITY DEFINER`, `STABLE`. Resuelven `company_id`/`role` del usuario autenticado actual **exigiendo `companies.is_active = true`**. Son la base de prácticamente todas las policies RLS del sistema. `EXECUTE` revocado para `anon`/`PUBLIC`, otorgado solo a `authenticated` (no son invocables como RPC pública).

### `sync_vehicle_odometer_on_trip_completion()` {#trigger-sync_vehicle_odometer}

Trigger `AFTER UPDATE ON trips`. Cuando `status` pasa a `completed` con `end_odometer` definido, actualiza `vehicles.current_odometer`. `SECURITY DEFINER` porque quien completa el viaje normalmente es el conductor, que no tiene permiso de `UPDATE` sobre `vehicles`.

## Row Level Security — resumen por tabla

| Tabla | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `companies` | Propia empresa | Solo nombre/RUC/dirección/teléfono/correo/logo (admin propio); `max_users`/`is_active` solo Super Admin (columna bloqueada) | — |
| `users` | Miembros de la empresa | Admin de la empresa (alta vía Route Handler con `service_role`) | Admin de la empresa |
| `vehicles`, `accessories`, `vehicle_accessories` | Toda la empresa | Solo admin | Solo admin |
| `trips` | Toda la empresa | Conductor dueño o admin | — (se cancela vía `status`, no se borra) |
| `trip_events`, `trip_inspections` | Toda la empresa | Conductor dueño del viaje o admin | — (inmutable) |
| `platform_admins` | Solo la propia fila | — (alta manual) | — |
| `platform_settings` | Pública | — (solo vía Route Handler `service_role`) | — |

## Storage

| Bucket | Público | Ruta | Quién escribe |
|---|---|---|---|
| `evidence` | No | `{company_id}/{trip_id}/{archivo}` | Conductor/admin de esa empresa |
| `company-logos` | Sí | `{company_id}/logo.{ext}` | Admin de esa empresa, o cualquier Super Admin (cualquier carpeta) |
| `platform-assets` | Sí | `logo.{ext}` | Solo Super Admin |

## Historial de migraciones

| # | Descripción |
|---|---|
| 0001 | Esquema inicial (DDL de Sección 4), roles, RLS base |
| 0002 | Bucket `evidence` |
| 0003 | Hardening: revoca `EXECUTE` público de `auth_company_id`/`auth_role` |
| 0004 | Trigger de sincronización de odómetro (Fase 3) |
| 0005 | Campos fiscales + `logo_url` en `companies` |
| 0006 | Bucket `company-logos` |
| 0007 | Policy SELECT faltante en `company-logos` |
| 0008 | `platform_admins`, `companies.max_users`/`is_active`, `auth_company_id`/`auth_role` exigen empresa activa |
| 0009 | Fix de privilegios de columna (REVOKE de tabla + GRANT de columnas específicas) |
| 0010 | Policy de `company-logos` para bypass de Super Admin |
| 0011 | `platform_settings` + bucket `platform-assets` |
