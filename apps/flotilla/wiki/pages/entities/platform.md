---
type: entity
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]]
---

# `platform_admins` / `platform_settings`

## `platform_admins`

Operadores de la plataforma (Super Admin). Tabla independiente de [[admins]]/[[drivers]] desde
el diseño inicial (migración `0008`) — el precedente que luego se extendió al resto del sistema
en `0012` (ver [[modelo-de-roles-y-aislamiento]]). Solo `user_id` (FK → `auth.users.id`) y
`created_at`. El alta se hace manualmente por SQL — no hay flujo de auto-registro.

RLS: SELECT solo de la propia fila; no hay INSERT vía RLS (alta manual).

## `platform_settings`

Configuración de Ruta360 como producto — singleton (una única fila, `id = 1` forzado por
`CHECK`). `product_name`, `logo_url` (bucket `platform-assets`), `copyright_text`. Lectura
**pública** (hasta las pantallas de login sin sesión la necesitan, para mostrar el branding
correcto); escritura solo vía `PATCH /api/supadmin/settings` con `service_role`.

Editable en `/supadmin/settings` — ver [[panel-supadmin]].

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
