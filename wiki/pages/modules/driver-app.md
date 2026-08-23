---
type: module
updated: 2026-08-23
sources: [[2026-08-22-mvp-spec-pdf]], [[2026-08-22-migraciones-0014-0015-gestion-excepcion]], [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
---

# Driver App (`/driver`)

App móvil del conductor. Login por usuario/contraseña o usuario+PIN (ver [[autenticacion]]).

## Dashboard Central (`app/driver/DriverDashboard.tsx`)

Pantalla de entrada desde 2026-08-23, reemplaza el selector de vehículo como primer paso. A
pedido explícito del usuario ("son muchos pasos... hacerlo lo más fácil y simple posible"):

- Estado del conductor: "Disponible" (sin viaje activo — si lo hay, redirige directo al ciclo).
- **Vehículo asignado** (`drivers.current_vehicle_id`, lo define el admin) — si está activo,
  "Iniciar Nuevo Viaje" salta directo a la inspección sin pasar por el selector; con un
  "Cambiar vehículo" siempre disponible para el caso excepcional. Sin asignación (o vehículo no
  disponible), cae al selector de siempre.
- **Resumen del ciclo actual** — viajes completados sin liquidar (`settlement_id IS NULL`).
- **"Llenado Final de Tanque"** — cierra el ciclo (`lib/settlements.ts`), crea la liquidación en
  `draft` — ver [[liquidaciones]].

## Flujo del viaje

1. **Selección de vehículo** — asignada por defecto o manual (ver Dashboard Central arriba).
2. **Inspección previa** — odómetro + foto obligatoria, certificación de un toque
   ("gestión por excepción", ver [[gestion-por-excepcion]]). Si reporta novedad bloqueante, el
   viaje queda en `pending_authorization` y el conductor ve una pantalla bloqueante hasta que un
   admin resuelva en [[panel-autorizaciones]].
3. **Ciclo de viaje — 3 taps** (reducido de 4 el 2026-08-23): Iniciar Viaje → **Llegué / Iniciar
   Descarga** (fusiona "Llegada a Destino" e "Iniciar Descarga" en un solo tap: dos `trip_events`
   — `arrival_destination` y `start_unloading` — pero un único cambio de `status`, directo a
   `unloading`, sin pasar por `at_destination`) → Finalizar Descarga. Cada tap actualiza el
   estado local sin `router.refresh()` (evita la recarga completa de servidor por tap). Ver
   [[trips]] para la nota de compatibilidad con viajes que ya estaban en `at_destination`.
4. **Checkout** — odómetro final + foto (obligatorios), más **N° de factura y valor del viaje**
   (`invoice_number`/`trip_value`, agregados 2026-08-23, ambos **opcionales** para no bloquear al
   conductor en campo — ver [[liquidaciones]] sobre las alertas que dispara dejarlos vacíos).
   Al completar, redirige automáticamente a `/driver`.

## Características transversales

- Offline-first: cola de eventos en IndexedDB, sync automático — ver [[offline-first]].
- PWA instalable (manifest, Service Worker de app-shell).
- UI mobile-first (390px), alto contraste — pensada para uso en campo con guantes/sol directo.
- Fotos comprimidas en cliente (<100KB) antes de subir, en todo punto de captura
  (`PhotoCaptureInput`).

## Archivos clave

`app/driver/**` (incluye `DriverDashboard.tsx`), `lib/trip-events.ts`, `lib/settlements.ts`,
`lib/offline/**`, `lib/geolocation.ts`, `lib/image-compression.ts`,
`components/PhotoCaptureInput.tsx`.

## Entidades que toca

[[trips]], [[drivers]], [[settlements]].

## Fuentes

- [[2026-08-22-mvp-spec-pdf]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
