---
type: module
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
---

# Panel de autorizaciones (`/admin/authorizations`)

Pedido explícito del usuario: *"Esta panel de autorizacion tiene que existir todas las
peticiones ordenadas segun de que modulo vengan"*. Muestra viajes en `pending_authorization`
(ver [[gestion-por-excepcion]]), **agrupados por el módulo que originó la solicitud**.

Hoy solo existe un módulo generador: **"Inspección diaria"**. La arquitectura (una sección por
módulo en la página) está pensada para sumar módulos futuros sin rediseño — se confirmó con el
usuario que por ahora alcanza con inspección diaria.

## Qué muestra por solicitud

Vehículo, conductor, categoría de la novedad, descripción (si la hay), foto de evidencia (URL
firmada del bucket privado `evidence` vía `getEvidencePhotoSignedUrl`), odómetro inicial.

## Acciones

- **Autorizar Excepción** — `trips.status → 'inspected'`. El conductor puede continuar su viaje.
- **Denegar y Enviar a Mantenimiento** — `trips.status → 'cancelled'` y
  `vehicles.status → 'maintenance'`.

Ambas se ejecutan client-side con el cliente normal de Supabase (el admin ya tiene permisos RLS
de `UPDATE` sobre `trips`/`vehicles`) — no requieren una ruta `service_role`.

## Visibilidad

El dashboard de [[panel-admin]] muestra un banner rojo cuando hay solicitudes pendientes,
enlazando aquí.

## Archivos clave

`app/admin/authorizations/page.tsx`, `app/admin/authorizations/AuthorizationCard.tsx`.

## Fuentes

- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
