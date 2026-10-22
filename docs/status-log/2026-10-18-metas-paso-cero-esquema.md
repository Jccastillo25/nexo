# 2026-10-18 — Metas de ventas: Paso Cero + esquema

- **Subfase / entregable:** app nueva `metas` (Metas de ventas): matriz de permisos, plantillas, schema y RPC.
- **Estado anterior → nuevo:** inexistente → app registrada **inactiva**, catálogo de permisos y plantillas, schema `metas` con 6 tablas y 13 RPC, **sin datos** y sin pantallas.
- **Migraciones (aplicadas en `nexo-core`):**
  - [`20261018133816_metas_paso_cero.sql`](../../supabase/migrations/20261018133816_metas_paso_cero.sql)
  - [`20261018135152_metas_esquema.sql`](../../supabase/migrations/20261018135152_metas_esquema.sql) (escrita como `20261018140000_…` y renombrada a la versión remota sin cambiar su SQL)
- **Diseño:** [`plan/15-metas-ventas.md`](../plan/15-metas-ventas.md).
- **Commit:** pendiente (todo en local por pedido del usuario).

## Origen

El usuario adjuntó `PPTO 2026 JCastillo.xlsx` y pidió convertirlo en una app
de Nexo donde "cada usuario pueda ver su progreso conforme a la meta personal
mensual". Decisiones (2026-10-17): importar el Excel del ERP, reparto sugerido
+ ajuste manual, US$ con C$ de referencia, vendedor ve solo lo suyo. Se le
mostró una [maqueta](https://claude.ai/artifact/AYKqKdMSQSaVuE2pPVqMrx) con
datos reales de septiembre 2026 y aprobó la matriz ("Autorizado", 2026-10-18)
junto con el reparto por los 3 meses anteriores (ver plan 15 §1 por qué).

## Verificación remota previa (solo lectura)

`core.apps` sin `metas`; ningún permiso, plantilla, tabla ni schema de
ventas/metas/presupuesto en `nexo-core`. Última migración remota antes de
esta sesión: `20261018014127`.

## Paso Cero — verificación posterior

| Comprobación | Resultado |
|---|---|
| `core.apps` `metas` | existe, `active = false`, categoría Ventas |
| Permisos `module_slug = 'metas'` | 9 (8 + `metas.ver_modulo` del trigger) |
| Plantillas vendedor / gerente / administrador | 3 / 7 / 9 permisos |
| `supabase_migrations` | `20261018133816 metas_paso_cero` |

## Esquema — pruebas en transacción revertida (antes de aplicar)

Migración + pruebas en un solo bloque que termina con `raise exception`
(se comprobó antes que el bloque revierte de verdad). Dentro de la
transacción, y solo ahí: app activada para la empresa y la plantilla
Vendedor concedida al rol de empresa "Prueba".

| # | Prueba | Resultado |
|---|---|---|
| T1 | Vista previa de 6 filas (1 sin fecha) | nuevas 5, errores 1, vendedores nuevos 2; **0 filas escritas** |
| T2 | Confirmar | 5 facturas, 1 error "Falta la fecha.", 5 con `importacion_id` |
| T2b | Parseo de vendedor | `001=Edith Saballo`, `003=Julio Castillo` (espacios dobles normalizados) |
| T3 | Reimportar el mismo lote | nuevas 0, actualizadas 5, siguen 5 facturas |
| T4 | Misma factura con otra fecha, como lote 2 de la importación | reemplazada (1 fila, fecha nueva); la importación acumula 7 filas |
| T5 | Presupuesto 2026 = 3,093,113.11 × 1.32 con los % de la hoja | total 4,082,909.31, septiembre 365,828.67 (igual al Excel) |
| T6 | % que suman 110% | rechazado con mensaje claro |
| T7 | Sugeridas sept (jun–ago: Edith 1000, Julio 3000) | 75% / 25% → 274,371.50 / 91,457.17 |
| T8 | Ajuste manual + regenerar | se conserva 19,377.00 `ajustada` |
| T9 | Owner sin vínculo | `vinculado = false` |
| T10–T12 | Vincular usuario; doble vínculo; usuario ajeno | ok; rechazado; rechazado |
| T13 | Equipo | anulada excluida (Edith 1,332.99), tipo de cambio 36.6245 |
| T14 | Vendedor: su avance | código 003, meta 19,377, vendido 43.82, serie de julio 3,000 |
| T15 | Vendedor: sus facturas | solo las 2 de Julio |
| T16 | Vendedor: equipo, facturas, importar, ajustar, vendedores | los 5 denegados (42501) |
| T17 | Sin sesión | denegado |
| T18 | Grants y estructura | `authenticated` ejecuta, `anon` no; sin `select` ni `usage` directos; RLS activo; 49 particiones de facturas (2023-01 a 2027-01), 4 de importaciones; 8 filas de auditoría |

## Esquema — verificación posterior

| Comprobación | Resultado |
|---|---|
| `supabase_migrations` | `20261018135152 metas_esquema` |
| Tablas / particiones de facturas / RPC `public.metas_*` | 6 / 49 / 13 |
| Filas en `metas.facturas` | 0 |
| App | sigue inactiva |

Advisors de seguridad: solo lo esperado. `rls_enabled_no_policy` en las
tablas de `metas` (cerradas a propósito, igual que `productos`) y
`authenticated_security_definer_function_executable` en las 13 RPC, que es
el patrón del repositorio. Ninguna función de `metas` es ejecutable por `anon`.

## Pruebas no ejecutadas

- Sin `apps/metas`: no hay typecheck/lint/build que correr. Las migraciones no
  cambian ninguna app; `pnpm verify` se corre antes del PR.
- Sin importación del histórico real ni prueba de volumen (13,600 facturas de 2026).
- Sin prueba de concurrencia de dos importaciones simultáneas.

## Pendiente

Ver [plan 15 §6](../plan/15-metas-ventas.md#6-pendiente).
