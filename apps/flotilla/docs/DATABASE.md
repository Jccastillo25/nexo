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
| `max_users` | int, nullable | Cupo de **administradores** (tabla `admins`). `NULL` = sin límite. Editable **solo** por Super Admin (columna bloqueada para `authenticated`) |
| `max_drivers` | int, nullable | Cupo de **conductores** (tabla `drivers`), independiente del anterior. `NULL` = sin límite. Editable **solo** por Super Admin |
| `is_active` | boolean, default `true` | Editable **solo** por Super Admin. `false` corta el acceso de todos sus usuarios |
| `created_at` | timestamptz | |

### `admins` — administradores de una empresa

`id` **es** el mismo id de `auth.users` (relación 1:1). Tabla independiente de `drivers` (ver [ARCHITECTURE.md](./ARCHITECTURE.md#modelo-de-roles)) — nunca comparten fila ni tabla.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `company_id` | uuid FK → `companies.id`, NOT NULL | |
| `email` | varchar, unique (case-insensitive) | Login por contraseña |
| `full_name` | varchar | |
| `is_active` | boolean, default `true` | |
| `created_at` | timestamptz | |

### `drivers` — conductores de una empresa

`id` **es** el mismo id de `auth.users`. No tienen contraseña — la cuenta de `auth.users` se crea sin `password`; el único login soportado es usuario + PIN.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK, FK → `auth.users.id` | |
| `company_id` | uuid FK → `companies.id`, NOT NULL | |
| `email` | varchar, unique (case-insensitive) | Dato de contacto, no se usa para login |
| `first_name` / `last_name` | varchar, NOT NULL | |
| `full_name` | varchar, NOT NULL | `first_name + ' ' + last_name`, mantenido en cada escritura para no tocar el resto de la app que ya lee `full_name` |
| `username` | varchar, NOT NULL, **único en toda la plataforma** (case-insensitive) | Identificador para login por PIN — debe ser global porque el login no conoce todavía la empresa cuando se busca |
| `pin_code` | varchar(4), NOT NULL, `CHECK` de 4 dígitos, único **por empresa** | Autogenerado al crear el conductor (`lib/generate-pin.ts`); el admin puede verlo y regenerarlo |
| `national_id` | varchar, NOT NULL | No. de identificación |
| `license_number` | varchar, nullable | |
| `license_type` | varchar, nullable | |
| `license_expiry` | date, NOT NULL | |
| `is_active` | boolean, default `true` | |
| `created_at` | timestamptz | |

### `license_categories` — catálogo de categorías de licencia, por empresa

`company_id`, `name`. Mismo patrón que `accessories`: el admin las administra en `/admin/license-categories`, luego se seleccionan al crear/editar un conductor.

### `driver_license_categories` — categorías asignadas a cada conductor

PK compuesta (`driver_id`, `category_id`), ambas `ON DELETE CASCADE`.

### `vehicles`

`company_id`, `license_plate` (único por empresa), `brand`, `model`, `current_odometer` (actualizado automáticamente al completar un viaje — ver [trigger](#trigger-sync_vehicle_odometer)), `status` (enum `active`/`maintenance`/`inactive`).

### `accessories` — catálogo de accesorios de checklist, por empresa

`company_id`, `name`.

### `vehicle_accessories` — qué accesorios aplican a qué vehículo

PK compuesta (`vehicle_id`, `accessory_id`).

### `trips` — cabecera del viaje

| Columna | Notas |
|---|---|
| `status` | enum `trip_status`: `created` → `inspected` → `in_transit` → `at_destination` → `unloading` → `unloading_completed` → `completed` (o `cancelled`). Rama lateral: desde `created`, si la inspección reporta una novedad bloqueante, pasa a `pending_authorization` en vez de `inspected` — ver [gestión por excepción](./ARCHITECTURE.md#gestión-por-excepción-inspección-diaria) |
| `start_odometer` / `end_odometer` | `CHECK (end_odometer >= start_odometer)` |
| `start_odometer_photo_url` (NOT NULL) / `end_odometer_photo_url` | Evidencia fotográfica obligatoria en el bucket `evidence` |
| `completed_at` | |

### `trip_events` — log inmutable, append-only

Un evento por hito del viaje (`start_trip`, `arrival_destination`, `start_unloading`, `end_unloading`, `finish_trip`), con `latitude`/`longitude`/`gps_accuracy` y `synced_offline`. **Sin políticas UPDATE ni DELETE** — la inmutabilidad es una garantía de RLS, no solo una convención de la app.

### `trip_inspections` — checklist de inspección previa

Un registro por accesorio revisado en el check-in: `is_present`, `has_damage`, `issue_description`, `issue_photo_url`. Igual que `trip_events`, sin UPDATE/DELETE. Coexiste con `trip_anomalies`: el checklist de accesorios no desapareció, dejó de ser el gate obligatorio de la pantalla principal de inspección (ver gestión por excepción abajo).

### `trip_anomalies` — reportes de novedad (gestión por excepción)

Agregada en la migración `0014` con un enum fijo de categorías; la `0015` lo reemplaza por FK al catálogo editable. Log inmutable — solo `SELECT`/`INSERT`, sin `UPDATE`/`DELETE`, mismo patrón que `trip_events`.

| Columna | Notas |
|---|---|
| `trip_id` | FK → `trips.id`, `ON DELETE CASCADE` |
| `category_id` | FK → `anomaly_categories.id` |
| `description` | Nullable |
| `photo_url` | Bucket `evidence`, requiere URL firmada para mostrarse (`getEvidencePhotoSignedUrl`) |

### `anomaly_categories` — catálogo editable de categorías de novedad

Migración `0015`. Por empresa, mismo patrón que `license_categories`/`accessories`: cada empresa administra su propio catálogo desde `/admin/incident-categories`.

| Columna | Notas |
|---|---|
| `company_id` | FK → `companies.id` |
| `name` | |
| `blocks_trip` | boolean, default `true`. Si es `true`, reportar esta categoría en la inspección lleva el viaje a `pending_authorization` en vez de `inspected` |

Seed inicial (una fila por empresa existente al migrar): "Llantas y pernos" y "Frenos y fugas" con `blocks_trip = true`; "Sujeción de carga (eslingas/toldo)", "Luces" y "Documentos" con `blocks_trip = false`.

### `platform_admins` — operadores de la plataforma (Super Admin)

Tabla independiente de `admins`/`drivers` (ver justificación en [ARCHITECTURE.md](./ARCHITECTURE.md#modelo-de-roles)). Solo `user_id` (FK → `auth.users.id`) y `created_at`. El alta se hace manualmente por SQL — no hay flujo de auto-registro.

### `platform_settings` — configuración de Ruta360 (singleton)

Una única fila (`id = 1`, forzado por `CHECK`). `product_name`, `logo_url` (bucket `platform-assets`), `copyright_text`. Lectura pública (hasta las pantallas de login sin sesión la necesitan); escritura solo vía `PATCH /api/supadmin/settings`.

## Funciones

### `auth_company_id()` / `auth_role()`

`SECURITY DEFINER`, `STABLE`. Resuelven `company_id`/`role` del usuario autenticado actual probando primero `admins` y luego `drivers` (una fila de `auth.users` solo puede existir en una de las dos), **exigiendo `companies.is_active = true`**. Son la base de prácticamente todas las policies RLS del sistema. `EXECUTE` revocado para `anon`/`PUBLIC`, otorgado solo a `authenticated` (no son invocables como RPC pública).

### `generateUniquePin()` (`lib/generate-pin.ts`, no es una función SQL)

Genera un PIN de 4 dígitos reintentando hasta encontrar uno no usado dentro de la empresa (`drivers.company_id + pin_code`), respaldado por el índice único `drivers_pin_per_company_idx`. Se usa al crear un conductor y al regenerar su PIN.

### `sync_vehicle_odometer_on_trip_completion()` {#trigger-sync_vehicle_odometer}

Trigger `AFTER UPDATE ON trips`. Cuando `status` pasa a `completed` con `end_odometer` definido, actualiza `vehicles.current_odometer`. `SECURITY DEFINER` porque quien completa el viaje normalmente es el conductor, que no tiene permiso de `UPDATE` sobre `vehicles`.

## Row Level Security — resumen por tabla

| Tabla | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `companies` | Propia empresa | Solo nombre/RUC/dirección/teléfono/correo/logo (admin propio); `max_users`/`max_drivers`/`is_active` solo Super Admin (columna bloqueada) | — |
| `admins` | Admins de la misma empresa | Admin de la empresa (alta vía Route Handler con `service_role`) | Admin de la empresa |
| `drivers` | Admin de la misma empresa, o el propio conductor (solo su fila) | **Solo admin** — un conductor no puede escribir ni su propia fila | Admin de la empresa |
| `license_categories`, `driver_license_categories` | Solo admin de la empresa | Solo admin | Solo admin |
| `vehicles`, `accessories`, `vehicle_accessories` | Toda la empresa | Solo admin | Solo admin |
| `trips` | Toda la empresa | Conductor dueño o admin | — (se cancela vía `status`, no se borra) |
| `trip_events`, `trip_inspections`, `trip_anomalies` | Toda la empresa | Conductor dueño del viaje o admin | — (inmutable) |
| `anomaly_categories` | Toda la empresa | Solo admin | Solo admin (`UPDATE`; no hay `DELETE`) |
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
| 0012 | Separa `users` en `admins` + `drivers` (tablas independientes); agrega `license_categories`/`driver_license_categories`; `trips.driver_id` ahora referencia `drivers`; reescribe `auth_company_id`/`auth_role` |
| 0013 | `companies.max_drivers`: cupo de conductores independiente del cupo de administradores (`max_users`) |
| 0014 | `trips.status` agrega `pending_authorization`; tabla `trip_anomalies` (novedades de inspección, categoría fija por enum) |
| 0015 | `anomaly_categories`: catálogo editable por empresa (reemplaza el enum de `trip_anomalies.category`), con seed de las 5 categorías originales |
