# 2026-10-18 — Metas y Presupuesto integrados en el CRM

- **Decisión del usuario:** "Integra Metas y Presupuesto dentro de la app CRM, como un solo módulo de ventas" (la idea: no saltar entre apps). Matriz de permisos `crm.*` aprobada: "Si".
- **Estado anterior → nuevo:** app suelta `apps/metas` (zona `/metas`, activada ese mismo día) → todo vive en `apps/crm` (`/crm`); la app `metas` deja de existir en el catálogo y en el Launcher. El schema `metas` (tablas, particiones, 13 RPC) se queda: son los datos del CRM.
- **Migración:** [`20261018184849_metas_dentro_de_crm.sql`](../../supabase/migrations/20261018184849_metas_dentro_de_crm.sql) (escrita como `20261018190000_…`, renombrada a la versión remota).
- **Commit:** pendiente (todo en local).

## Base de datos (aplicada en `nexo-core`)

1. 8 permisos `crm.*` de 4 segmentos que reemplazan a los `metas.*`:

   | Antes | Ahora |
   |---|---|
   | `metas.dashboard.propio.ver` | `crm.metas.avance_propio.ver` |
   | `metas.dashboard.equipo.ver` | `crm.metas.avance_equipo.ver` |
   | `metas.ventas.mis_facturas.ver` | `crm.ventas.factura_propia.ver` |
   | `metas.ventas.factura.ver` | `crm.ventas.factura.ver` |
   | `metas.ventas.factura.importar` | `crm.ventas.factura.importar` |
   | `metas.presupuesto.vendedor.gestionar` | `crm.metas.meta_vendedor.gestionar` |
   | `metas.presupuesto.empresa.gestionar` | `crm.metas.presupuesto.gestionar` |
   | `metas.configuracion.vendedor.gestionar` | `crm.configuracion.vendedor.gestionar` |
   | `metas.ver_modulo` | `crm.ver_modulo` (ya existía) |

2. Primeras plantillas del CRM: **Vendedor** (4: módulo, ver clientes, mi avance, mis facturas), **Gerente de ventas** (10: todo menos eliminar clientes, presupuesto y vendedores), **Administrador de ventas** (13).
3. Las 13 funciones (`public.metas_*` + helpers `metas.*`) se reescribieron desde su definición actual cambiando solo los literales de código; los grants se conservan. Las acciones de auditoría (`metas.presupuesto.guardar`, etc.) no cambian.
4. Se borraron las plantillas, los permisos y la app `metas` (con su `company_apps`). Precheck: ningún rol de empresa ni usuario tenía permisos `metas.*` y no había datos.

**Prueba en transacción revertida antes de aplicar:** 13 funciones reescritas; plantillas 4/10/13; `authenticated` ejecuta y `anon` no; Launcher del owner sin `metas` (con `crm`); owner: mi avance (sin vínculo), equipo, presupuesto e importación en vista previa responden; un usuario con la plantilla Vendedor ve su avance y sus facturas y tiene denegados equipo (con el código nuevo en el mensaje), vendedores e importar.

**Postcheck en remoto:** versión `20261018184849`; 13 permisos `crm`; 0 filas de la app `metas`; plantillas 4/10/13; 13 RPC `public.metas_*`.

## Código

- Pantallas movidas a `apps/crm/src/app/(app)`: **`/metas`** (Mi avance / Avance del equipo), **`/metas/por-vendedor`**, `/presupuesto`, `/facturas`, `/importar`, `/configuracion/vendedores`. Lógica en `src/lib/metas/` (permisos, errores, formato, periodo, tipos, importacion + prueba, cliente Supabase sin el tipo `Database` porque todo pasa por RPC), componentes en `src/components/metas/`, validador en `apps/crm/scripts/validar-excel.mjs`.
- Menú del CRM (`lib/nav.ts` → `crmNav(permisos)`): Dashboard · Ventas (Clientes, Facturas/Mis facturas, Importar del ERP, Leads… "Pronto") · Metas (Mi avance/Avance del equipo, Metas por vendedor, Presupuesto anual) · Análisis (Histórico "Pronto") · Configuración (Vendedores y usuarios). El layout lee los permisos una vez por solicitud (`sesionActual`, `React.cache`).
- `apps/crm`: `read-excel-file` 9.3.10 y `write-excel-file` 4.1.1 fijados, `bodySizeLimit: 4mb` + `allowedOrigins` en `next.config.ts`, `allowImportingTsExtensions` en `tsconfig`, scripts `test` y `validar-excel`. `pnpm test:metas` ahora filtra el CRM.
- **Deuda de lint del CRM corregida** (`DeleteClienteButton` sin `setState` en efecto, parámetro sin usar, `eslint-disable` sobrante): el CRM pasa de `deuda` a `gate` en `scripts/lint-apps.mjs`.
- Retirado: `apps/metas`, el rewrite `/metas` y `METAS_APP_URL` (panel, `turbo.json`, `.env.local`), el servidor `metas` de `.claude/launch.json` y el icono `target` del Launcher.

## Pruebas

| Prueba | Resultado |
|---|---|
| `pnpm --filter materiales-jcastillo-crm lint` | ✅ (antes fallaba por deuda previa) |
| `pnpm --filter materiales-jcastillo-crm typecheck` | ✅ |
| `pnpm --filter materiales-jcastillo-crm test` | ✅ 9/9 |
| `pnpm --filter materiales-jcastillo-crm build` | ✅ 14 rutas |
| `pnpm --filter nexo-panel typecheck` | ✅ |
| `pnpm lint:plan` / `lint:gate` | ✅ gate 7 (incluye el CRM), deuda 1 (`transporte-app`); 7/7 tareas |
| Validador con el Excel real (desde el CRM) | 47 301 facturas, totales por año idénticos |
| Local sin sesión | `localhost:3000/crm/metas` y `/crm/importar` → 307 al login |

## No verificado

- Recorrido con sesión real en local (lo hace el usuario: no se ingresan contraseñas).
- Importación real del Excel y vista móvil.
- El CRM de producción no tiene todavía estas pantallas: llegan con el próximo deploy de `apps/crm`.

## Pendiente

1. Recorrer `/crm/metas` con sesión; recibir el Excel en bruto, `pnpm --filter materiales-jcastillo-crm validar-excel -- "archivo.xlsx"`, importar.
2. Presupuesto 2026, vincular vendedores, asignar plantillas del CRM a roles de empresa.
3. Commit/PR y deploy de `apps/crm` (sin proyecto Vercel nuevo).
