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
| `core` | Compañías, membresías/roles, catálogo de apps, catálogo de permisos, permisos efectivos, auditoría, mapa de migración | Nuevo | ✅ Aplicado (2026-08-30) |
| `crm` | `clientes` | Migrado de materiales-jcastillo (`arzadwxsifnaolvfcvqk`) | ✅ Completo (2026-08-30). Sin datos que copiar — el usuario confirmó que el proyecto original solo tenía datos de prueba |
| `rrhh` | Empleados, asistencia, horarios, nómina | Migrado de Gestor360 (`ofeuzkwjhmfsazqfyutu`) | ⏳ Pendiente |
| `flotilla` | Flota, viajes, conductores, evidencias | Migrado de Ruta360 | ⏳ Pendiente |

## ⚠️ Paso manual pendiente: exponer schemas en la API

`supabase-js` solo puede leer/escribir en schemas que Supabase expone via
PostgREST — por defecto solo `public`. Para que las apps puedan hacer
`.schema("crm").from("clientes")` hace falta, **una sola vez por schema**,
en el dashboard del proyecto `nexo-core`:

> Settings → API → Data API → Exposed schemas → agregar `crm`

Pendiente de hacer. No hay una herramienta MCP para este ajuste (es
configuración de plataforma, no SQL) — hay que hacerlo a mano en el
dashboard. Se repetirá para `rrhh` y `flotilla` cuando les toque su fase.

## Tablas de `core` (aplicadas)

- `core.companies` — 1 fila: `materiales-jcastillo`
- `core.company_memberships` — vacía (agregada en la Fase 3: sin esto,
  `core.has_permission()` no tenía de dónde sacar el rol owner/admin)
- `core.apps` — sembrada con los 4 módulos (`nexo`, `rrhh`, `flotilla`, `crm`)
- `core.company_apps` — `materiales-jcastillo` tiene `nexo` y `crm` activos
- `core.permissions_catalog` — 4 permisos de visibilidad (creados
  automáticamente por `trg_seed_module_permission`) + 4 permisos de
  `crm.clientes.*` (ver [PERMISSIONS.md](PERMISSIONS.md))
- `core.user_permissions`, `core.audit_log`, `core.migration_map` — vacías
- `core.has_permission()` / `public.has_permission()` — función única de la
  norma v3.0, RLS y apps la llaman por igual (ver PERMISSIONS.md)

Migraciones aplicadas, en orden: `20260830000001_core_schema` →
`20260830000002_core_seed_apps` → `20260830000003_crm_permissions_catalog` →
`20260830000004_seed_materiales_jcastillo` → `20260830000005_crm_schema` →
`20260830000006_fix_security_advisors` → `20260830000007_fix_has_permission_execute_grant`.
Todas en [`supabase/migrations/`](../supabase/migrations/).

Nota: `core_schema` se reseteó una vez completo (`drop schema core cascade`
+ recrear) durante la Fase 3, antes de tener datos reales — por pedido
explícito del usuario, confirmado como de bajo riesgo. Ver MIGRATION_LOG.md.

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
