# Base de datos de Nexo

Estado: **pendiente de provisionar.** El proyecto Supabase `nexo-core`
todavía no existe — este documento describe el diseño objetivo (ver
[planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md)
sección 4-5) y se actualiza con datos reales (project ref, fechas de
migración) a medida que se ejecuta cada fase.

## Proyecto

- Nombre: `nexo-core`
- Project ref: *(pendiente)*
- Región: *(pendiente — usar la misma que Gestor360 (`us-east-1`) si es posible, para minimizar latencia con los usuarios actuales)*

## Schemas

| Schema | Contenido | Origen |
|---|---|---|
| `core` | Compañías, catálogo de apps, permisos unificados, auditoría, mapa de migración | Nuevo |
| `rrhh` | Empleados, asistencia, horarios, nómina | Migrado de Gestor360 (`ofeuzkwjhmfsazqfyutu`) |
| `flotilla` | Flota, viajes, conductores, evidencias | Migrado de Ruta360 |
| `crm` | Clientes, oportunidades | Migrado de materiales-jcastillo (`arzadwxsifnaolvfcvqk`) |

## Tablas de `core` (mínimas para que el panel funcione)

- `core.companies`
- `core.apps` — sincronizada desde el `manifest.json` de cada módulo
- `core.company_apps`
- `core.user_permissions` (extiende la tabla de Gestor360 con `module_id`)
- `core.audit_log`
- `core.migration_map`

## Estado de la migración

| Módulo | Schema destino | Estado |
|---|---|---|
| RRHH | `rrhh` | No iniciado |
| Flotilla | `flotilla` | No iniciado |
| CRM | `crm` | No iniciado |

Ver bitácora en [MIGRATION_LOG.md](MIGRATION_LOG.md).
