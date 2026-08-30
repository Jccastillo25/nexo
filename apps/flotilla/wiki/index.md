---
type: index
updated: 2026-08-23
---

# Índice — wiki de Ruta360

Catálogo de todo lo que hay en `wiki/pages/`. Ver `wiki/CLAUDE.md` para las convenciones de esta
wiki (cómo se ingiere, se consulta y se mantiene).

## Overview y roadmap

- [[overview]] — punto de entrada: los tres niveles del sistema, stack, mapa completo.
- [[roadmap]] — qué se construyó, en qué orden, qué falta. _(actualizado 2026-08-23)_

## Conceptos

- [[modelo-de-roles-y-aislamiento]] — por qué `platform_admins`/`admins`/`drivers` son tablas
  físicamente separadas. _(2026-08-22)_
- [[autenticacion]] — contraseña vs. usuario+PIN, magic link, el bug de `verifyOtp`.
  _(2026-08-22)_
- [[offline-first]] — cola de eventos IndexedDB, sync, Service Worker. _(2026-08-22)_
- [[gestion-por-excepcion]] — certificación de un toque, categorías de novedad editables,
  bloqueo/autorización. _(2026-08-22)_
- [[liquidaciones]] — comisión, gastos, anticipos, sellado inmutable, recibo en PDF.
  _(2026-08-23)_

## Entidades

- [[companies]] — el tenant, cupos independientes de admins/drivers. _(2026-08-22)_
- [[admins]] — administradores de empresa. _(2026-08-22)_
- [[drivers]] — conductores, perfil ampliado, login por PIN, comisión, vehículo asignado.
  _(2026-08-23)_
- [[fleet]] — vehículos, accesorios, categorías de licencia. _(2026-08-22)_
- [[trips]] — ciclo de viaje, eventos, inspecciones, novedades, datos financieros. _(2026-08-23)_
- [[platform]] — `platform_admins`, `platform_settings`. _(2026-08-22)_
- [[settlements]] — `settlements`, `driver_advances`. _(2026-08-23)_

## Módulos

- [[driver-app]] — `/driver`, Dashboard Central, ciclo de viaje de 3 taps. _(2026-08-23)_
- [[panel-admin]] — `/admin`, sidebar por grupos desplegables, CRUD de la empresa, Liquidaciones,
  alertas en tiempo real. _(2026-08-23)_
- [[panel-supadmin]] — `/supadmin`, gestión de empresas y plataforma. _(2026-08-22)_
- [[panel-autorizaciones]] — `/admin/authorizations`, resolución de novedades bloqueantes.
  _(2026-08-22)_

## Fuentes ingeridas

- [[2026-08-22-mvp-spec-pdf]]
- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]

## Hallazgos de lint abiertos

- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ROADMAP.md` no reflejan la extensión de
  Dashboard Central / ciclo de 3 taps / Liquidaciones (2026-08-23). Ver nota en [[roadmap]].

## Hallazgos de lint resueltos

- ~~`docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ROADMAP.md` no reflejan la extensión de
  gestión por excepción~~ — corregido 2026-08-22. Ver [[roadmap]].
- ~~`docs/01_Requisitos/*` (y `02_Arquitectura/`, `03_Agentes/`, `04_Tareas/`, `99_Recursos/`)
  desactualizado, intento previo a medio hacer~~ — eliminado del repo 2026-08-22 a pedido
  explícito del usuario ("elimina... toda la documentación basura"). Nunca estuvo versionado en
  git, así que no hubo nada que borrar en remoto.
