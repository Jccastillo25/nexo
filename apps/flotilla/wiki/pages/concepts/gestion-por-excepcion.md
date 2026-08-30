---
type: concept
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
---

# Gestión por excepción (inspección diaria)

Rediseño de la pantalla de inspección diaria del conductor: reemplaza un checklist largo por
accesorio por una **certificación de un toque**.

## UX

Un bloque estático (no interactivo) con un recordatorio numerado de puntos a revisar,
generado dinámicamente desde el catálogo de `anomaly_categories` (ver [[trips]]) de la empresa.
Dos acciones:

- **"Todo en Orden - Iniciar Turno"** (botón verde, `BigButton variant="success"`) — certifica y
  continúa directo.
- **"Reportar Novedad / Daño"** (botón rojo outline) — abre un modal: selección de categoría,
  descripción opcional, foto obligatoria (`<input capture="environment">`, comprimida en
  cliente a <100KB con `browser-image-compression` vía `PhotoCaptureInput`).

## Regla de negocio: qué bloquea el viaje

Dada explícitamente por el usuario: si la falla es **mecánica y le impide moverse a la unidad**,
debe bloquear; si es **estética o de un extra que no afecta el movimiento libre**, no debe
bloquear. Esto se implementó como un catálogo **editable por empresa**
(`anomaly_categories`, columna `blocks_trip`), no como una regla hardcodeada — a pedido
posterior del usuario de poder agregar más categorías y decidir cuáles bloquean, todo editable
en `/admin/incident-categories`.

Seed inicial: "Llantas y pernos" y "Frenos y fugas" bloquean; "Sujeción de carga", "Luces" y
"Documentos" no bloquean.

## Flujo cuando bloquea

1. El conductor reporta la novedad → se crea el viaje con `status = pending_authorization` en
   vez de `inspected`.
2. El conductor ve una pantalla bloqueante ("Novedad reportada. Esperando autorización...") — no
   puede iniciar el viaje.
3. Un admin revisa la evidencia (foto vía URL firmada, categoría, descripción, odómetro) en
   [[panel-autorizaciones]] y **Autoriza la excepción** (→ `inspected`, el conductor puede
   continuar) o **Deniega y envía a mantenimiento** (→ `cancelled` + vehículo a `maintenance`).

## Flujo cuando no bloquea

El viaje pasa normalmente a `inspected`; la novedad queda registrada en `trip_anomalies` como
evidencia, pero no interrumpe el flujo del conductor.

## Fuentes

- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
