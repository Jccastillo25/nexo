---
type: concept
updated: 2026-08-22
sources: [[2026-08-22-mvp-spec-pdf]]
---

# Offline-first (Driver App)

Los botones de estado del ciclo de viaje ("Iniciar Viaje", "Llegada a Destino", etc.) capturan
GPS + timestamp **en el momento del click**, antes de intentar la escritura de red — así el dato
es correcto aunque la escritura falle o se demore.

## Cola de eventos

1. Si `navigator.onLine` es `false`, o la escritura falla por un error de transporte (sin
   `code` en la respuesta de PostgREST), el evento se encola en IndexedDB
   (`lib/offline/db.ts`).
2. Un hook (`lib/offline/useOfflineSync.ts`) reintenta el envío al detectar el evento `online`
   del navegador, y cada 20s mientras la app está en foreground. **No** se usa la Background
   Sync API porque Safari iOS no la soporta y el conductor opera desde el navegador móvil.
3. `trip_events.synced_offline` distingue el timestamp real del dispositivo de la confirmación
   en vivo del servidor.

## Service Worker

`public/sw.js` solo cachea el app-shell estático (íconos, manifest, página `/offline`) —
deliberadamente no cachea datos ni pantallas autenticadas, para no servir contenido stale de
otro tenant.

## Dónde vive

Ver [[driver-app]] para el flujo completo, y [[trips]] para el modelo de datos de
`trip_events`.

## Fuentes

- [[2026-08-22-mvp-spec-pdf]]
