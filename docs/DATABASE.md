# Base de datos de Nexo

Estado: **proyecto provisionado y schema `core` aplicado (2026-08-30).**
Los schemas por módulo (`rrhh`, `flotilla`, `crm`) todavía no existen — se
crean cuando se migren los datos de cada módulo en su fase correspondiente.

## Proyecto

- Nombre: `nexo-core`
- Project ref: `yrbjlmiqhkyxtlcerowh`
- Organización: `Grupo CT` (`uahxpcssvfzlfxcvtvhu`)
- Región: `us-east-1` (misma que Ruta360 y el CRM)
- Plan: gratuito ($0/mes)

## Schemas

| Schema | Contenido | Origen | Estado |
|---|---|---|---|
| `core` | Compañías, catálogo de apps, catálogo de permisos, permisos efectivos, auditoría, mapa de migración | Nuevo | ✅ Aplicado (2026-08-30) |
| `rrhh` | Empleados, asistencia, horarios, nómina | Migrado de Gestor360 (`ofeuzkwjhmfsazqfyutu`) | ⏳ Pendiente |
| `flotilla` | Flota, viajes, conductores, evidencias | Migrado de Ruta360 | ⏳ Pendiente |
| `crm` | Clientes, oportunidades | Migrado de materiales-jcastillo (`arzadwxsifnaolvfcvqk`) | ⏳ Pendiente |

## Tablas de `core` (aplicadas)

- `core.companies` — vacía, se llena en la Fase 5-6 al migrar datos reales
- `core.apps` — sembrada con los 4 módulos (`nexo`, `rrhh`, `flotilla`, `crm`)
- `core.company_apps` — vacía
- `core.permissions_catalog` — 4 filas, creadas automáticamente por el
  trigger `trg_seed_module_permission` al sembrar `core.apps` (ver
  [PERMISSIONS.md](PERMISSIONS.md))
- `core.user_permissions`, `core.audit_log`, `core.migration_map` — vacías

Migraciones aplicadas: [`supabase/migrations/20260830000001_core_schema.sql`](../supabase/migrations/20260830000001_core_schema.sql),
[`supabase/migrations/20260830000002_core_seed_apps.sql`](../supabase/migrations/20260830000002_core_seed_apps.sql).

## RLS — estado actual (provisional)

RLS habilitado en las 7 tablas de `core`. `core.apps` y
`core.permissions_catalog` son de lectura pública para `authenticated`
(el panel necesita leerlas). El resto (`companies`, `company_apps`,
`user_permissions`, `audit_log`, `migration_map`) **no tienen ninguna
policy todavía** — con RLS activo eso significa denegado para todo el
mundo excepto `service_role`, a propósito, hasta que se definan las
políticas reales de membresía por empresa en la Fase 3+. Confirmado sin
alertas de seguridad más allá de ese "RLS sin policy" esperado
(`get_advisors`, 2026-08-30).

## Estado de la migración

| Módulo | Schema destino | Estado |
|---|---|---|
| RRHH | `rrhh` | No iniciado (código ya importado en `apps/rrhh`) |
| Flotilla | `flotilla` | No iniciado (código ya importado en `apps/flotilla`) |
| CRM | `crm` | No iniciado (código ya importado en `apps/crm`) |

Ver bitácora en [MIGRATION_LOG.md](MIGRATION_LOG.md).
