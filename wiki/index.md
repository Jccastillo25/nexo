---
type: index
updated: 2026-08-22
---

# Índice — wiki de Ruta360

Catálogo de todo lo que hay en `wiki/pages/`. Ver `wiki/CLAUDE.md` para las convenciones de esta
wiki (cómo se ingiere, se consulta y se mantiene).

## Overview y roadmap

- [[overview]] — punto de entrada: los tres niveles del sistema, stack, mapa completo.
- [[roadmap]] — qué se construyó, en qué orden, qué falta. _(actualizado 2026-08-22)_

## Conceptos

- [[modelo-de-roles-y-aislamiento]] — por qué `platform_admins`/`admins`/`drivers` son tablas
  físicamente separadas. _(2026-08-22)_
- [[autenticacion]] — contraseña vs. usuario+PIN, magic link, el bug de `verifyOtp`.
  _(2026-08-22)_
- [[offline-first]] — cola de eventos IndexedDB, sync, Service Worker. _(2026-08-22)_
- [[gestion-por-excepcion]] — certificación de un toque, categorías de novedad editables,
  bloqueo/autorización. _(2026-08-22)_

## Entidades

- [[companies]] — el tenant, cupos independientes de admins/drivers. _(2026-08-22)_
- [[admins]] — administradores de empresa. _(2026-08-22)_
- [[drivers]] — conductores, perfil ampliado, login por PIN. _(2026-08-22)_
- [[fleet]] — vehículos, accesorios, categorías de licencia. _(2026-08-22)_
- [[trips]] — ciclo de viaje, eventos, inspecciones, novedades. _(2026-08-22)_
- [[platform]] — `platform_admins`, `platform_settings`. _(2026-08-22)_

## Módulos

- [[driver-app]] — `/driver`, flujo completo del conductor. _(2026-08-22)_
- [[panel-admin]] — `/admin`, sidebar por grupos desplegables, CRUD de la empresa.
  _(2026-08-22)_
- [[panel-supadmin]] — `/supadmin`, gestión de empresas y plataforma. _(2026-08-22)_
- [[panel-autorizaciones]] — `/admin/authorizations`, resolución de novedades bloqueantes.
  _(2026-08-22)_

## Fuentes ingeridas

- [[2026-08-22-mvp-spec-pdf]]
- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]

## Hallazgos de lint abiertos

- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ROADMAP.md` no reflejan la extensión de
  gestión por excepción (`anomaly_categories`, `pending_authorization`,
  `/admin/authorizations`, sidebar por grupos). Ver nota en [[roadmap]].
- `docs/01_Requisitos/*` (ej. `03_Autenticacion_Roles.md`) sigue describiendo login de
  conductor por correo+PIN y un rol único `admin`/`driver` — desactualizado respecto a
  [[autenticacion]] y [[modelo-de-roles-y-aislamiento]]. Es contenido pre-wiki, no se tocó en
  este ingest.
