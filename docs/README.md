# Documentación de Nexo — índice

## Fuentes operativas principales

| Documento | Contenido |
|---|---|
| [PLAN_MAESTRO_IMPLEMENTACION_NEXO.md](PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) | **Índice de la fuente de verdad del objetivo y orden de implementación.** Decisiones vigentes, orden definitivo, Definition of Done universal y protocolo — el contenido temático completo (objetivo, arquitectura, reglas de dominio, cada fase) vive en [`plan/`](plan/), leer solo el archivo que aplica a la tarea. |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | **Dashboard corto del estado real.** Claude debe compararlo contra `main`, Supabase y Vercel y actualizarlo con commit/migraciones/pruebas. El detalle narrativo de cada subfase vive en [`status-log/`](status-log/), enlazado desde la tabla de la sección 0. |
| [DRIVER_ACCESS_AND_KIOSK.md](DRIVER_ACCESS_AND_KIOSK.md) | **Regla específica de acceso operativo.** PIN exclusivamente para asistencia; usuario+contraseña para Web/Mobile; habilitación de conductor, Supabase Auth, finalización de contrato y separación Kiosko/Panel Conductor. |

## Contenido temático y log detallado (leer solo lo que aplica a la tarea)

| Carpeta | Contenido |
|---|---|
| [plan/](plan/) | 14 archivos que desagregan `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` por objetivo/arquitectura, estrategia móvil, dominio RRHH, cada fase (1 a 8), la administración de usuarios y roles (`12-…`), el módulo Atención (`13-…`) y el módulo Productos (`14-…`). Ver la tabla del índice para saber cuál leer. |
| [status-log/](status-log/) | Una entrada por subfase/bloque ya cerrado, con el detalle completo de auditoría, migraciones y verificación. Ver la tabla de la sección 0 de `IMPLEMENTATION_STATUS.md` para saber cuál leer. |

## Arquitectura y documentación viva

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Monorepo, Multi-Zones, Supabase, identidad digital, kiosko, Panel Conductor y estrategia Mobile. |
| [DATABASE.md](DATABASE.md) | Estado real de `nexo-core`, schemas, tablas, RLS y convenciones. No confundir estado actual con el modelo objetivo pendiente. |
| [MODULES.md](MODULES.md) | Catálogo de módulos y estado funcional. |
| [status-log/2026-10-14-agencia-independiente.md](status-log/2026-10-14-agencia-independiente.md) | Agencia digital independiente: matriz aprobada, app/proyecto, pruebas y activación pendiente. |
| [PERMISSIONS.md](PERMISSIONS.md) | Norma de permisos y roles. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Shell compartido, tokens y navegación Web. |
| [MIGRATION_LOG.md](MIGRATION_LOG.md) | Historial de migraciones y verificaciones. |
| [CI_CHECKS.md](CI_CHECKS.md) | Puerta de calidad: una orden local (`pnpm verify`), checks de GitHub Actions, qué bloquea el merge (cinco checks obligatorios; `lint-deuda` no bloquea), límites de cobertura y protección de `main` activa y verificada. |
| [ROADMAP.md](ROADMAP.md) | Orden macro vigente de implementación. |
| [RRHH_PAQUETE_OPERADOR.md](RRHH_PAQUETE_OPERADOR.md) | Entrega P2–P6: migraciones, postchecks, rollback, pruebas y recorrido P7; no aplicado ni autorizado. |
| [RRHH_MVP.md](RRHH_MVP.md) | Definition of Done de RRHH: expediente, contrato, PIN de asistencia, jornada, consolidación, planilla y E2E. |
| [RRHH_PILOTO_MVP_OPERATIVO.md](RRHH_PILOTO_MVP_OPERATIVO.md) | Corte aprobado 2026-10-15: piloto supervisado de un par/día y MVP operativo con corrección auditada; reglas, funciones, pantallas y tickets P1–P7/M1–M4. No es implementación validada. |

## Planeación y decisiones históricas

| Documento | Contenido |
|---|---|
| [planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md) | Plan original de unificación. |
| [planning/ARQUITECTURA_MVP_ESCALABLE.md](planning/ARQUITECTURA_MVP_ESCALABLE.md) | Particionamiento, RBAC, atomicidad inter-módulo y playbook. |
| [planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md) | Naming y catálogo original de módulos. |
| [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md) | Investigación UX/UI histórica. |
| [planning/NORMA_DISENO_UNIVERSAL.md](planning/NORMA_DISENO_UNIVERSAL.md) | Norma de diseño y reglas anti-fragmentación. |

## Regla de lectura para implementación

Antes de programar una subfase, Claude debe leer:

1. `CLAUDE.md`;
2. `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` (índice) + el/los archivo(s) de `docs/plan/` que aplican a la tarea (ver tabla del índice);
3. `docs/IMPLEMENTATION_STATUS.md` (dashboard) + la entrada de `docs/status-log/` correspondiente si se necesita el detalle de verificación de una subfase ya cerrada;
4. `docs/README.md`;
5. documentación específica del módulo;
6. `docs/DRIVER_ACCESS_AND_KIOSK.md` obligatoriamente cuando la tarea toque RRHH, kiosko, autenticación operativa, conductor, Transporte o Mobile;
7. estado remoto real cuando dependa de Supabase/Vercel.

## Jerarquía

Las decisiones funcionales vigentes y el Plan Maestro prevalecen sobre documentos históricos.

`DATABASE.md` describe lo que existe; no debe modificarse para fingir que una migración objetivo ya fue aplicada.

La documentación de `planning/` conserva contexto histórico, pero no prevalece sobre una decisión aprobada posterior.
