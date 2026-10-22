# 2026-10-20 — Retiro del CRM y arranque de la réplica de AG Negocio

## Pedido del usuario

- "Tengo un problema muy grande con esto del CRM que aplicamos aquí. No entendiste lo que requiero."
- "abre esta pagina es el ERP que tenemos actualmente necesito que lo copies y lo implementes en su totalidad para luego mejorarlo." (https://www.agnegocio.net/jcastillo/)
- "una vez termines de analizar todo el sistema, borra todo lo de CRM que tenemos actualmente y genera el codigo para copiar todo lo nuevo basado en Ag negocio."
- Respuesta a la pregunta de alcance: "Borra todo el CRM: el código de apps/crm con respaldo en una rama local, la app del Launcher y los esquemas crm y metas con sus permisos en nexo-core. Deja fuera el bloque académico."

## Estado anterior → estado nuevo

| Pieza | Antes | Ahora |
|---|---|---|
| `apps/crm` | Clientes (en producción), embudo comercial a medias y Metas/Presupuesto en local, sin commit | **Borrada.** Respaldo en la rama local `respaldo/crm-2026-10-20` (`569db40`), que es una foto completa del árbol de trabajo |
| App `crm` en `core.apps` | Activa y habilitada; aparecía en el Launcher | **Borrada**, con sus 34 permisos, sus 3 plantillas (78 filas de permisos de plantilla) y su `company_apps` |
| Esquema `crm` | 12 tablas y 36 particiones, 32 funciones, 48 RPC `public.crm_*` | **Vacío y sin GRANT.** Se conserva solo porque sigue en "Exposed schemas" de la Data API |
| Esquema `metas` | 6 tablas y 155 particiones, 9 funciones, 13 RPC `public.metas_*` | **Borrado** |
| `core.tablas_particionadas` | 5 filas de crm y metas | Sin filas de crm ni metas |
| Rewrite `/crm` del panel | `CRM_APP_URL` → deploy del CRM | **Retirado** (`apps/nexo/next.config.ts`, `proxy.ts`, `.env.local.example`, `turbo.json`) |
| Launcher, mosaicos "Próximamente" | Punto de venta, Facturación, Inventario, Compras, Contabilidad y Bancos por separado | Un solo mosaico **ERP** (decisión del 2026-10-20: una sola app) |
| Datos | 0 clientes, 0 leads, 0 facturas y 0 metas | Nada que perder: el prechequeo de la migración exige tablas vacías |

## Migración

`20261020143821_retirar_crm_y_metas.sql`

1. **Prechequeo:** aborta si alguna tabla de datos de `crm` o `metas` tiene filas (solo quedan exentos los catálogos semilla del embudo). También aborta si hay permisos `crm.*` en otro módulo o usuarios y roles de empresa con permisos `crm.*`.
2. **Retiro:**
   - Borra las RPC `public.crm_*` y `public.metas_*`.
   - Quita `crm` y `metas` del mantenimiento de particiones.
   - Hace `drop schema metas cascade`.
   - Hace `drop schema crm cascade` y luego `create schema crm` vacío, con `revoke all`.
   - Borra los permisos de plantilla, las plantillas, el catálogo de permisos y la app.
3. **Poscheque:** confirma cada punto y que `anon` y `authenticated` no tengan USAGE sobre el `crm` vacío.

Verificación previa:
- Fuera de `crm` y `metas` no depende nada de sus objetos: ni llaves foráneas, ni funciones, ni vistas, ni políticas, ni tareas de `pg_cron`.
- Se ensayó completa en una transacción revertida: todos los poscheques pasaron y luego se confirmó que el remoto seguía igual.

Verificación después de aplicar:
- `core.apps` quedó con agencia, asistencia, atencion, erp (inactiva), flotilla, nexo, precios (inactiva), productos y rrhh.
- Quedan 184 permisos y 25 plantillas.
- `metas` ya no existe y `crm` tiene 0 objetos.
- La API de Supabase sigue sirviendo: una RPC pública devolvió 200 después del cambio.

**Rollback:** volver a aplicar las migraciones del CRM y de Metas. Siguen en `supabase/migrations/` porque forman parte del historial remoto, y también están en la rama de respaldo.

## Código y configuración

- Se borró `apps/crm/`.
- Se sacó el CRM de:
  - `apps/nexo/next.config.ts` (rewrite) y `apps/nexo/src/proxy.ts` (matcher);
  - `apps/nexo/.env.local.example`, `turbo.json` (`CRM_APP_URL`) y `.claude/launch.json`;
  - `package.json` (`test:metas` y su paso en `verify`) y `.github/workflows/ci.yml` (job `test-metas-importacion`);
  - `scripts/lint-apps.mjs` (registro del gate);
  - `packages/supabase/package.json`, `.claude/agents/ui-frontend.md` y `.codex/agents/ui-frontend.toml`;
  - la skill `nexo-security` (`.claude/skills` y `.agents/skills`), que ahora apunta al middleware de `apps/productos`.
- Se conservaron, por ser genéricos, los cambios a `packages/ui`: iconos `funnel`, `phone` y `mail`, y la accesibilidad de `ConfirmDialog`.
- Los comentarios de otras apps que dicen "mismo patrón que apps/crm" quedan como referencia histórica. El archivo citado está en la rama de respaldo.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm install` / `pnpm install --frozen-lockfile` | OK; el lockfile ya no tiene el importer `apps/crm` |
| `pnpm typecheck` | 7/7 |
| `pnpm lint:plan` | 7 apps (gate 6, deuda 1) |
| `pnpm lint:self-test` | OK |
| `pnpm lint:gate` | 6/6 |
| `pnpm test:db` | Verde (fail 0) |
| `pnpm test:agencia:access` | OK |
| `pnpm build` | 7/7 |
| Navegador local | `localhost:3000/crm/dashboard` ya no se reenvía: el panel lo manda a su login |

## Inventario de AG Negocio

- Recorrido de solo lectura, con la sesión que el usuario abrió en el navegador integrado: 144 pantallas en 11 grupos, más el POS y el dashboard.
- Se leyeron solo la estructura (columnas, filtros, campos y acciones) y los contadores de las listas. No se guardó ni se modificó nada.
- AG Negocio es software propietario de AG Software, S.A. (Rails, nombre interno `rubyledger`), no de código abierto.
- Detalle en [plan 18](../plan/18-replica-ag-negocio.md).

## Pendiente

- **El usuario** debe quitar `crm` de Settings → API → Data API → Exposed schemas. Después se borra el esquema vacío con una migración.
- **El usuario** decide qué hacer con el proyecto del CRM en Vercel, que quedó sin tocar: su último deploy sigue publicado, pero ya no tiene tablas ni mosaico en el Launcher.
- Paso Cero de la réplica (etapas R1 y R2 del plan 18), que debe aprobar el usuario antes de crear tablas.
- Probar el Launcher con sesión real en local: el mosaico del CRM ya no debe aparecer y debe verse "ERP" en Próximamente.
- No hay commit; el commit y el merge los decide el usuario.
