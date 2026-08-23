# Log — wiki de Ruta360

Registro cronológico de ingests, queries y pasadas de lint. Formato del encabezado:
`## [AAAA-MM-DD] tipo | título` — ver `wiki/CLAUDE.md`.

## [2026-08-22] setup | Bootstrap de la wiki

Se crea la estructura `wiki/` (schema en `wiki/CLAUDE.md`, `sources/`, `pages/`, `index.md`,
`log.md`) a pedido del usuario, para documentar técnicamente el propio proyecto con el patrón
LLM Wiki. Domain: documentación técnica de Ruta360. Ubicación: carpeta raíz `wiki/`, separada de
`docs/`.

## [2026-08-22] ingest | Documento MVP original (PDF)

Fuente: [[2026-08-22-mvp-spec-pdf]]. Extracción de texto no disponible en el entorno (falta
`poppler-utils`); registrado con lo ya conocido vía `docs/ROADMAP.md`. Tocó: [[overview]],
[[roadmap]].

## [2026-08-22] ingest | Baseline — migraciones 0001–0011

Fuente: [[2026-08-22-baseline-migraciones-0001-0011]]. Esquema base pre-split
admins/drivers: `users` con columna `role`, `platform_admins` ya separado desde `0008`. Tocó:
[[modelo-de-roles-y-aislamiento]], [[companies]], [[platform]], [[roadmap]].

## [2026-08-22] ingest | Migraciones 0012–0013 — split admins/drivers

Fuente: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]. Tablas `admins`/`drivers`
independientes, perfil de conductor ampliado, login por usuario+PIN, cupos independientes, fix
del bug de `verifyOtp`. Tocó: [[modelo-de-roles-y-aislamiento]], [[autenticacion]], [[admins]],
[[drivers]], [[fleet]], [[roadmap]].

## [2026-08-22] ingest | Migraciones 0014–0015 — gestión por excepción

Fuente: [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]. Inspección de un toque,
`anomaly_categories` editable, `pending_authorization`, panel de autorizaciones, sidebar por
grupos. Tocó: [[gestion-por-excepcion]], [[trips]], [[panel-autorizaciones]], [[panel-admin]],
[[driver-app]], [[roadmap]].

## [2026-08-22] lint | Chequeo inicial post-bootstrap

Hallazgos: `docs/ARCHITECTURE.md`/`DATABASE.md`/`ROADMAP.md` desactualizados respecto a la
extensión de gestión por excepción; `docs/01_Requisitos/*` desactualizado respecto al modelo de
roles y autenticación actual (login por correo, rol único). No se corrigió `docs/` en este
paso — queda anotado en [[roadmap]] e [[index]] a la espera de decisión del usuario. Ver
`wiki/CLAUDE.md` sobre la relación entre `wiki/` y `docs/`.
