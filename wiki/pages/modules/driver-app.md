---
type: module
updated: 2026-08-22
sources: [[2026-08-22-mvp-spec-pdf]], [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
---

# Driver App (`/driver`)

App móvil del conductor. Login por usuario/contraseña o usuario+PIN (ver [[autenticacion]]).

## Flujo

1. **Selección de vehículo** — asignado o disponible.
2. **Inspección previa** — odómetro + foto obligatoria, certificación de un toque
   ("gestión por excepción", ver [[gestion-por-excepcion]]). Si reporta novedad bloqueante, el
   viaje queda en `pending_authorization` y el conductor ve una pantalla bloqueante hasta que un
   admin resuelva en [[panel-autorizaciones]].
3. **Ciclo de viaje** — 5 botones de estado (Iniciar Viaje, Llegada a Destino, Iniciar
   Descarga, Fin de Descarga, Finalizar Viaje), cada uno con GPS + hora real capturados en el
   momento del click (ver [[offline-first]]).
4. **Checkout** — odómetro final + foto.

## Características transversales

- Offline-first: cola de eventos en IndexedDB, sync automático — ver [[offline-first]].
- PWA instalable (manifest, Service Worker de app-shell).
- UI mobile-first (390px), alto contraste — pensada para uso en campo con guantes/sol directo.
- Fotos comprimidas en cliente (<100KB) antes de subir, en todo punto de captura
  (`PhotoCaptureInput`).

## Archivos clave

`app/driver/**`, `lib/trip-events.ts`, `lib/offline/**`, `lib/geolocation.ts`,
`lib/image-compression.ts`, `components/PhotoCaptureInput.tsx`.

## Entidades que toca

[[trips]], [[drivers]].

## Fuentes

- [[2026-08-22-mvp-spec-pdf]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
