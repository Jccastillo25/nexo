---
type: roadmap
updated: 2026-08-23
sources: [[2026-08-22-mvp-spec-pdf]], [[2026-08-22-baseline-migraciones-0001-0011]], [[2026-08-22-migraciones-0012-0013-split-admins-drivers]], [[2026-08-22-migraciones-0014-0015-gestion-excepcion]], [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
---

# Roadmap — avance por fases

Plan original: 4 fases ([[2026-08-22-mvp-spec-pdf|documento MVP]]). El orden real se adelantó
(Fase 4 antes que Fase 3, a pedido explícito del usuario) y se agregaron dos capas completas no
contempladas en el documento original: el panel Super Admin y el rediseño de inspección por
excepción.

## ✅ Fase 1 — Base de datos y autenticación

DDL inicial (Sección 4 del PDF), roles conectados a Supabase Auth nativo, RLS de aislamiento por
`company_id`. Migración `0001`. Ver [[2026-08-22-baseline-migraciones-0001-0011]].

## ✅ Fase 2 — Web App Móvil Conductor

Flujo completo del conductor: login → selección de vehículo → inspección → ciclo de viaje (5
estados con GPS + hora) → checkout. Offline-first, PWA instalable. Ver [[driver-app]] y
[[offline-first]].

## ✅ Fase 4 — Panel Admin *(construida antes que la Fase 3, a pedido del usuario)*

Sidebar fijo, dashboard de KPIs + gráficas, CRUD de flota/accesorios/conductores/admins, perfil
de empresa. Ver [[panel-admin]].

## ✅ Fase 3 — Lógica de negocio

Trigger `sync_vehicle_odometer_on_trip_completion`: al completar un viaje, sincroniza
`vehicles.current_odometer` sin depender de qué pantalla lo completó. Migración `0004`.

## ✅ Extensión — Panel Super Admin (`/supadmin`)

No estaba en el documento original. Tabla `platform_admins` (independiente desde el diseño
inicial), login y sidebar propios, gestión de empresas y sus cupos, configuración de plataforma
dinámica (nombre, logo, copyright). Ver [[panel-supadmin]].

## ✅ Extensión — admins/drivers en tablas independientes, perfil de conductor ampliado

A pedido explícito: *"los usuarios administrativos del sistema y conductores... nunca se deben
de mezclar"*. Migración `0012` reemplaza `users` (con columna `role`) por `admins` y `drivers`
físicamente separadas; perfil de conductor ampliado (usuario, PIN, identificación, licencia);
login de conductor pasa a usuario+PIN; cupos independientes `max_users`/`max_drivers`
(migración `0013`). De paso corrige un bug de `verifyOtp` que era la causa real del login de
conductor fallando. Ver [[2026-08-22-migraciones-0012-0013-split-admins-drivers]] y
[[modelo-de-roles-y-aislamiento]].

## ✅ Extensión — inspección por excepción, categorías de novedad editables, panel de autorización

Rediseño de la inspección diaria: certificación de un toque en vez de checklist largo; reporte
de novedad con foto obligatoria + categoría; categorías editables por empresa con bandera
`blocks_trip`; viajes bloqueantes pasan a `pending_authorization` hasta que un admin los
autorice o deniegue desde `/admin/authorizations`. Sidebar del admin reorganizado en grupos
desplegables. Migraciones `0014`–`0015`. Ver
[[2026-08-22-migraciones-0014-0015-gestion-excepcion]], [[gestion-por-excepcion]] y
[[panel-autorizaciones]].

## ✅ Extensión — Dashboard Central del conductor, ciclo de viaje reducido, módulo de Liquidaciones

A pedido explícito: *"necesitamos hacerlo lo más fácil y simple posible"* (panel del conductor),
seguido de un documento completo de especificación que extendió el pedido a una capa financiera.
Migraciones `0016`–`0020`. Ver [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]],
[[liquidaciones]], [[settlements]].

- **Conductor:** Dashboard Central (vehículo asignado, resumen de ciclo, "Llenado Final de
  Tanque"); ciclo de viaje de 4 a 3 taps (fusiona "Llegada a Destino" + "Iniciar Descarga");
  cierre de viaje admite factura/valor opcionales. Ver [[driver-app]].
- **Admin:** comisión y vehículo asignado por conductor; anticipos; alertas en tiempo real
  (Supabase Realtime) de viajes sin datos financieros; filtro + edición inline en
  `/admin/fleet-trips`; módulo `/admin/settlements` completo con sellado inmutable (trigger de
  DB) y recibo en PDF (`@react-pdf/renderer`, única dependencia nueva). Ver [[panel-admin]].
- No se pudo probar el flujo autenticado de punta a punta por falta de credenciales de prueba en
  el entorno — `npm run build`, `tsc --noEmit` y `eslint` sí quedaron limpios antes de pushear.

## Pendiente / fuera de alcance

Ver [[overview#fuera-de-alcance-actual]].

## ✅ Nota de lint resuelta (2026-08-22)

`docs/ARCHITECTURE.md`, `docs/DATABASE.md` y `docs/ROADMAP.md` se actualizaron para reflejar la
extensión de inspección por excepción (`pending_authorization`, `trip_anomalies`,
`anomaly_categories`, panel de autorizaciones, sidebar reagrupado) — ya no están desfasados
respecto a esta página. El intento previo `docs/01_Requisitos/*` y carpetas hermanas, nunca
versionado y ya desactualizado, se eliminó del repo el mismo día a pedido del usuario. Ver
[[index]].

## ⚠️ Nota de lint (2026-08-23)

`docs/ARCHITECTURE.md`, `docs/DATABASE.md` y `docs/ROADMAP.md` no reflejan esta extensión
(Dashboard Central, ciclo de 3 taps, `settlements`/`driver_advances`, comisión, vehículo
asignado, alertas en tiempo real) — quedaron al día solo hasta la extensión de gestión por
excepción (2026-08-22). No se corrigió en este ingest porque no fue parte del pedido del
usuario; queda anotado en [[index]] a la espera de que lo pida, igual que se hizo con el
desfase anterior.

## Fuentes

- [[2026-08-22-mvp-spec-pdf]]
- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
