---
type: source
date: 2026-08-22
kind: migration
ref: ../../supabase/migrations/0015_editable_anomaly_categories.sql
---

# Migraciones 0014–0015 — inspección por excepción, categorías de novedad editables, panel de autorización

Rediseño de la pantalla de inspección diaria del conductor, a pedido explícito del usuario
(especificación tipo Principal Software Engineer): reemplazar el checklist largo por accesorio
por una **certificación de un toque** — botón verde "Todo en Orden - Iniciar Turno" vs. botón
rojo outline "Reportar Novedad / Daño".

## Regla de negocio (clave, dada por el usuario)

*"si la falla es mecanica directamente que imposibilite mover la unidad tiene que reportarlo y
bloquear sino, si es estetica o de algun extra que no afecte el libre movimiento dde la unidad
no se deberia de bloquear"*. Luego escalado a: *"Me gustaria que existiera la opcion de agregar
mas incidencias, poder marcar si bloquean o no, y de igualmanera que todo lo que se pueda
agregar sea editable"*.

## Qué cambió (0014)

- `trip_status` (enum) gana el valor `pending_authorization`.
- (Versión inicial, luego reemplazada por 0015) tabla `trip_anomalies` + enum estático de
  categorías.

## Qué cambió (0015) — reemplaza el enum estático

- **`anomaly_categories`**: catálogo editable por empresa (`name`, `blocks_trip`). Seed inicial
  con 5 categorías clasificadas según la regla de negocio del usuario: **"Llantas y pernos"** y
  **"Frenos y fugas"** bloquean el viaje; "Sujeción de carga", "Luces" y "Documentos" no
  bloquean. Administrable en `/admin/incident-categories`.
- `trip_anomalies.category_id` → FK a `anomaly_categories` (se elimina la columna/enum
  estático anterior).
- `trip_anomalies` es log inmutable (solo SELECT + INSERT, igual que `trip_events`).

## Flujo resultante

Si el conductor reporta una novedad con `blocks_trip = true`: el viaje pasa a
`pending_authorization` y queda bloqueado hasta que un admin lo autorice o lo deniegue desde
`/admin/authorizations` (denegar además marca el vehículo en `maintenance`). Si
`blocks_trip = false`: el viaje sigue normalmente (`inspected`), la novedad queda registrada
como evidencia pero no bloquea.

Fotos de evidencia comprimidas en cliente antes de subir (`browser-image-compression`, objetivo
<100KB) — integrado en el componente compartido `PhotoCaptureInput`, así que aplica a **todo**
punto de captura de foto de la app, no solo esta pantalla.

## Otros cambios de la misma sesión

- Panel `/admin/authorizations`: lista viajes `pending_authorization` agrupados por módulo de
  origen (hoy solo "Inspección diaria" — arquitectura pensada para sumar módulos futuros sin
  rediseño). Banner de alerta en el dashboard cuando hay pendientes.
- `AdminSidebar` reorganizado en grupos desplegables (Flota, Conductores, Configuración) a
  pedido del usuario, para reducir botones visibles — Dashboard y Autorizaciones quedan fijos.

## Páginas que actualiza

- [[gestion-por-excepcion]]
- [[trips]]
- [[panel-autorizaciones]]
- [[panel-admin]]
- [[driver-app]]
- [[roadmap]]
