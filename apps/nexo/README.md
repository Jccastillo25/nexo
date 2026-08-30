# Nexo — panel central

Zona raíz de [Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones).
Posee el dominio `nexo.materialesjcastillo.com`: login único + grilla de
módulos en `/`, y cose cada módulo adaptado bajo su ruta vía `rewrites` en
`next.config.ts`.

## Estado (Fase 4, 2026-08-30)

- ✅ Login contra `nexo-core` (Supabase Auth), sesión protegida por
  `proxy.ts` (middleware).
- ✅ `/` lee `public.get_visible_apps(companyId)` — nunca hardcodea qué
  módulos mostrar. Cruza `core.company_apps` (contratado) y
  `core.has_permission` (autorizado).
- ✅ Rewrite de Multi-Zones hacia `/crm` (el único módulo ya adaptado).
  `/rrhh` y `/flotilla` se agregan cuando les toque su fase — **no antes**,
  agregar el rewrite sin que el módulo tenga su `basePath` configurado lo
  rompe.
- ⚠️ **Sin correr todavía**: nunca se ejecutó `pnpm install` en el
  monorepo ni se levantó un dev server real. Todo lo de arriba está escrito
  y debería funcionar, pero no está *verificado en vivo*.
- ⚠️ **Para ver módulos en la grilla hace falta un usuario real con
  membresía**: recién creado, `core.company_memberships` está vacío — sin
  eso, `core.has_permission` deniega para todo el mundo (DENY BY DEFAULT
  funcionando correctamente, no es un bug). Pasos para probar:
  1. Crear un usuario en Supabase Auth (dashboard de `nexo-core`, o
     flujo de sign-up si se agrega uno).
  2. Insertar una fila en `core.company_memberships`:
     `(user_id, company_id = '2b8525bd-a01a-4b55-a32c-ffe70761d96d', role = 'owner')`.
  3. Con eso, el bypass owner/admin de `core.has_permission` deja ver
     `nexo` y `crm` (los dos módulos que tiene habilitados
     `materiales-jcastillo` en `core.company_apps`).

## Variables de entorno

Ver `.env.local.example`. `CRM_APP_URL` es el deploy real de `apps/crm`
(en local, otro puerto; en producción, la URL del proyecto Vercel de esa
app).

## Desarrollo

```bash
pnpm install
# en una terminal:
pnpm --filter materiales-jcastillo-crm dev -- -p 3001
# en otra:
pnpm --filter nexo-panel dev
```
