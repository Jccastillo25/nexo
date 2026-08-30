# CRM — módulo Nexo

Panel de clientes de Materiales J Castillo. Módulo de Nexo servido bajo
`nexo.materialesjcastillo.com/crm` (ver `basePath` en `next.config.ts` y
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) del monorepo).

## Estado (Fase 3, 2026-08-30)

- ✅ Adaptado a `nexo-core`: los datos viven en el schema `crm` (tabla
  `crm.clientes`), no en el proyecto original `materiales-jcastillo-crm`.
- ✅ `basePath: "/crm"` configurado para Multi-Zones.
- ✅ Los 3 permisos de escritura (`crm.clientes.crear/editar/eliminar`)
  están conectados con `requirePermission()` de `@nexo/permissions`, y
  reforzados con RLS real en `crm.clientes` (`core.has_permission()`).
- ⚠️ **Paso manual pendiente antes de poder correr esto de verdad**: exponer
  el schema `crm` en el dashboard de Supabase del proyecto `nexo-core`
  (Settings → API → Data API → Exposed schemas → agregar `crm`). Sin esto,
  toda query a `crm.clientes` falla.
- ⚠️ Datos reales de clientes (del proyecto original, pausado) **no se
  copiaron todavía** — ver `docs/MIGRATION_LOG.md` del monorepo.
- ⚠️ Sin verificar en un dev server real todavía: `proxy.ts`/`middleware.ts`
  usan `request.nextUrl.pathname` para decidir redirects a `/login`; falta
  confirmar que el comportamiento es correcto con `basePath` activo (Fase 4,
  cuando exista `apps/nexo` para probar Multi-Zones de punta a punta).

## Variables de entorno

Ver `.env.local.example`.

## Desarrollo

```bash
pnpm install
pnpm --filter materiales-jcastillo-crm dev
```
