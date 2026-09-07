# Documentación de Nexo — índice

## Fuentes operativas principales

| Documento | Contenido |
|---|---|
| [PLAN_MAESTRO_IMPLEMENTACION_NEXO.md](PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) | **Fuente de verdad del objetivo y orden de implementación.** Incluye Fase 1 RRHH, separación Expediente General/Laboral, PIN exclusivamente contractual, CRM, Transporte, Inventario, Fabricación y estrategia Nexo Mobile Android/iOS. |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | **Tracker vivo del estado real.** Claude debe comparar este archivo contra `main`, Supabase y Vercel antes y después de cada subfase y actualizarlo con commit/migraciones/pruebas. |

## Arquitectura y documentación viva

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, monorepo, Multi-Zones, modelo de despliegue, SSO |
| [DATABASE.md](DATABASE.md) | Proyecto `nexo-core`, schemas por módulo, RLS, convenciones |
| [MODULES.md](MODULES.md) | Catálogo de módulos, estado (activo/en migración/planeado) |
| [PERMISSIONS.md](PERMISSIONS.md) | Norma de permisos v3.0, cómo registrar permisos y roles |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Shell compartido, tokens de `packages/ui`, navegación y checklist por módulo |
| [MIGRATION_LOG.md](MIGRATION_LOG.md) | Bitácora fecha a fecha de migraciones, cambios y rollback notes |
| [ROADMAP.md](ROADMAP.md) | Roadmap histórico/operativo de fases; actualizar cuando cambie el estado global |
| [RRHH_MVP.md](RRHH_MVP.md) | Documento previo del MVP de RRHH. **Debe leerse junto al Plan Maestro:** el modelo de expediente/contrato/PIN definido el 2026-09-06 en el Plan Maestro prevalece donde exista contradicción y RRHH_MVP debe actualizarse durante F1.0/F1.1. |

## Planeación y decisiones históricas

| Documento | Contenido |
|---|---|
| [planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md) | Plan original de unificación: arquitectura, migración de BD, cronograma |
| [planning/ARQUITECTURA_MVP_ESCALABLE.md](planning/ARQUITECTURA_MVP_ESCALABLE.md) | Particionamiento, pooling/read replicas, RBAC, atomicidad inter-módulo, playbook de app nueva, dark/glass |
| [planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md) | Naming, rutas, íconos y catálogo de módulos investigado en Odoo/SAP/Oracle |
| [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md) | Estudio de SAP Fiori y Odoo detrás del sistema visual |
| [planning/NORMA_DISENO_UNIVERSAL.md](planning/NORMA_DISENO_UNIVERSAL.md) | Norma de diseño completa: App Shell, launcher, Torre de Control, PWA, kiosko y reglas anti-fragmentación |

## Regla de lectura para implementación

Antes de programar una subfase, Claude debe leer en este orden:

1. `CLAUDE.md`;
2. `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`;
3. `docs/IMPLEMENTATION_STATUS.md`;
4. documentación específica del módulo;
5. estado remoto real cuando la tarea dependa de Supabase/Vercel.

La documentación de `planning/` conserva decisiones y propuestas históricas. Las fuentes vivas y el estado remoto prevalecen sobre una descripción histórica desactualizada.
