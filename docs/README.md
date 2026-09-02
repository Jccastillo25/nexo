# Documentación de Nexo — índice

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, monorepo, Multi-Zones, modelo de despliegue, SSO |
| [DATABASE.md](DATABASE.md) | Proyecto `nexo-core`, schemas por módulo, RLS, convenciones |
| [MODULES.md](MODULES.md) | Catálogo de módulos, estado (activo/en migración/planeado) |
| [PERMISSIONS.md](PERMISSIONS.md) | Norma de permisos v3.0 (7 dominios), cómo registrar un permiso nuevo |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Shell compartido, tokens de `packages/ui`, regla de "volver al panel", checklist por módulo |
| [MIGRATION_LOG.md](MIGRATION_LOG.md) | Bitácora fecha a fecha de la migración, rollback notes |
| [ROADMAP.md](ROADMAP.md) | Fases del proyecto, próximos módulos |
| [planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md) | Plan original de unificación (arquitectura, migración de BD, cronograma) |
| [planning/ARQUITECTURA_MVP_ESCALABLE.md](planning/ARQUITECTURA_MVP_ESCALABLE.md) | Particionamiento, pooling/read replicas, RBAC de 3 capas (rol por app), atomicidad inter-módulo, playbook de app nueva, dark mode + glassmorphism |
| [planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md) | Naming, rutas, íconos y catálogo de módulos investigado en Odoo/SAP/Oracle |
| [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md) | Estudio de SAP Fiori y Odoo detrás de los tokens de DESIGN_SYSTEM.md |
| [planning/NORMA_DISENO_UNIVERSAL.md](planning/NORMA_DISENO_UNIVERSAL.md) | Norma de diseño completa: paleta agnóstica, App Shell (launcher/omnibar/notificaciones/sidebar), Torre de Control, PWA operativa, kiosko, reglas anti-fragmentación |

Los documentos de `planning/` son la propuesta original (fuente de verdad
histórica); ARCHITECTURE.md, DATABASE.md, MODULES.md, PERMISSIONS.md,
DESIGN_SYSTEM.md y ROADMAP.md son los documentos **vivos** que se
actualizan a medida que se implementa cada fase.
