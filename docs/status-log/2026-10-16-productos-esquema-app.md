# 2026-10-16 — Productos: esquema, RPC y `apps/productos`

- **Subfase / entregable:** modelo de datos de Productos (plan 14 §4) + app `apps/productos` para probar en local.
- **Estado anterior → nuevo:** Paso Cero aplicado, sin tablas ni app → schema `productos` y 12 RPC aplicados en `nexo-core`; `apps/productos` implementada y compilada en local. App **inactiva**, sin empresa habilitada, sin datos, sin proyecto Vercel.
- **Migración:** [`20261016214634_productos_esquema.sql`](../../supabase/migrations/20261016214634_productos_esquema.sql).
- **Commit:** pendiente (decisión del usuario: probar todo en local antes de subir).

## Decisiones del usuario incorporadas (2026-10-16)

Ver la tabla de decisiones de [plan 14 §6](../plan/14-productos.md#6-decisiones-y-pendientes): código
automático `CCTTKK-NNN` editable; numeración por padre, propuesta y editable
al crear; códigos del ERP conservados; ID único e inmutable; ID del ERP como
ID de Nexo en los importados; costo real tomado del Consolidado; aprobación del
modelo tras ver el [prototipo](https://claude.ai/artifact/M8riTuGoqsZzNd41Tu2vTU)
("Me gusta").

## Base de datos

12 tablas de catálogo en el schema `productos` (cerrado a la API) y 12 RPC
`public.productos_*`. Detalle en [DATABASE.md](../DATABASE.md#schema-productos-2026-10-16-20261016214634).

Pruebas en transacción revertida contra `nexo-core` (con la app activada y un
permiso de consulta concedidos **solo dentro de la transacción**):

| # | Prueba | Resultado |
|---|---|---|
| 1 | Sugerir código de una categoría nueva | `010102-001` |
| 2–3 | Crear dos productos sin código en la misma categoría | `010102-001` (ID 1), `010102-002` (ID 2) |
| 4–5 | Editar el código; repetir un código existente (otra capitalización) | Cambia; el repetido se rechaza: "Ese código ya lo usa otro producto." |
| 6 | Cambiar el número de una clase con productos | Rechazado: "El número 01 ya lo usan productos" |
| 7–8 | Importación en vista previa con una fila sin código | 3 creados + 1 error informado; después de la vista previa la base sigue con 2 productos |
| 9–11 | Importación confirmada con IDs del ERP 1465 y 800 + una fila sin ID | IDs 1465, 800 y **1466**; el siguiente creado a mano recibe **1467** |
| 12–13 | Resumen y ficha | Correctos; categoría `2` normalizada a `02` |
| 14–15 | Usuario con solo `producto.ver` | `costo_visible = false`, costo `null`; crear: "No tenés permiso…" |
| 16–17 | `update numero_id` / `delete` directos | "El ID del producto no se puede modificar." / "Los productos no se borran; se descontinúan." |
| 18–28 | Segunda tanda (después de aplicar) | Marca fuera de su clase, servicio con clase y cuenta de tipo equivocado rechazados; descontinuar; código manual `010101-005` hace que se sugiera `-006`; importación con proveedor existente (mayúsculas distintas) y centro de costo; exportación y catálogos |

Advisors de seguridad: solo los esperados del patrón (RLS sin políticas ×12
INFO; RPC security definer ejecutables por `authenticated` ×12 WARN, igual que
Atención). Nada ejecutable por `anon`.

## App `apps/productos`

- Zona `/productos` (`basePath`), puerto local 3005, `NexoShell`, login único,
  Speed Insights + Analytics. Rutas: `/dashboard` (KPIs reales), `/catalogo`
  (listado con búsqueda y filtros), `/catalogo/nuevo` y `/catalogo/[id]` (ficha
  con pestañas General, Clasificación, Fiscal y contable, Costo, Inventario,
  Características; ID con candado, código generado/editable), `/clasificacion`
  (árbol con números), `/configuracion` (marcas con clases permitidas,
  unidades, proveedores, características, cuentas contables, centros de costo),
  `/importar` (dos Excel → vista previa → confirmar; exportar al formato del ERP).
- Cada Server Action llama `requirePermission` y la UI oculta o deshabilita
  según los permisos; la RPC vuelve a verificar por grupo de campos.
- Dependencias nuevas fijadas: `read-excel-file` 9.3.10 y `write-excel-file`
  4.1.1 (lockfile actualizado).
- Monorepo: `scripts/lint-apps.mjs` (gate), `turbo.json` (`PRODUCTOS_APP_URL`),
  `.claude/launch.json` (`productos`, 3005), `apps/nexo/next.config.ts`
  (rewrite si existe `PRODUCTOS_APP_URL`), `apps/nexo/src/proxy.ts` (excluye
  `/productos`).
- Verificación local: `typecheck`, `lint` y `next build` de `nexo-productos`
  sin errores.
- Lector de Excel probado en Node con los archivos reales del ERP: 699
  productos, todos con ID del ERP (máximo 1508), sin códigos, IDs ni códigos
  de barras repetidos; 9 clases, 57 tipos, 114 categorías; 691 costos del
  Consolidado (8 productos no están en él); 36 sin costo real; 222 sin
  clasificación completa; 8 servicios; JSON de ~620 KB (límite 4 MB).

## Activación para probar en local (mismo día)

Pedido del usuario: "levántalo en local". Migración
[`20261016220935_productos_activar`](../../supabase/migrations/20261016220935_productos_activar.sql)
(app activa + habilitada para Materiales J Castillo; verificado). `apps/productos`
corriendo en `http://localhost:3005` (pestaña de terminal del usuario, con
`npx.cmd` porque PowerShell bloquea `npx.ps1`). Comprobado: sin sesión,
`/productos/dashboard` redirige a `http://localhost:3000/login?next=%2Fproductos%2Fdashboard`.
El panel local de :3000 lo corre otra sesión y arrancó antes del rewrite de
`/productos`: después de iniciar sesión hay que abrir
`http://localhost:3005/productos/dashboard` a mano (la cookie de sesión es de
`localhost` y vale para los dos puertos).

## Ajuste visual al prototipo (mismo día)

Observación del usuario: "el prototipo no se parece al implementado" (captura
del dashboard vacío). La diferencia principal es que la base todavía no tiene
productos y el prototipo mostraba datos de muestra. Cambios, sin datos mock:

- Dashboard: siempre muestra los 4 KPIs del prototipo (activos, sin
  clasificación, con código de barras, descontinuados), un aviso "Primer paso:
  importar" cuando está vacío, la tarjeta "Para revisar" con conteos reales
  (sin clasificar, sin costo si el rol lo ve, sin código de barras) y "Cómo se
  arma el código" con los números en pastillas.
- Sidebar: "Listas de precios" deshabilitado con "Pronto".
- Listado: estado "Sin clasificar" / "Sin costo" en la columna Estado; listado
  vacío con enlace a Importar.
- Ficha nueva: pastillas clase/tipo/categoría + consecutivo bajo el código.
- Importar: tabla de limpieza con ejemplos reales antes de elegir archivos.
- `typecheck` y `lint` de `nexo-productos` sin errores. Sin recorrido visual
  propio (el navegador de la sesión no tiene sesión iniciada).

Segunda observación (captura del menú del prototipo): "El menú lateral tiene
iconos [y] está ordenado". Cambios:

- `packages/ui` (aditivo, sin efecto en otros módulos): `NexoNavItem.section`
  para encabezados de sección en `NexoSidebar`; iconos `box`, `upload`,
  `tree`, `tag`, `ruler`, `book`, `price`.
- Menú de Productos como el prototipo: **Productos** (Dashboard, Productos,
  Importar y exportar) · **Configuración** (Clasificación, Marcas, Unidades de
  medida, Proveedores, Características, Cuentas contables) · **Siguiente
  módulo** (Listas de precios, "Pronto"). Cada entrada sigue filtrada por su
  permiso.
- Catálogos separados en una ruta cada uno, `/configuracion/[catalogo]`
  (`marcas`, `unidades`, `proveedores`, `caracteristicas`, `cuentas`, esta
  última con centros de costo); `/configuracion` redirige al primero
  permitido.
- `pnpm verify` completo sin errores (8 apps).

## Pendiente

- Recorrido en local con sesión real (lo hace el usuario).
- Importación real de los 699 productos (datos reales, no `PRUEBA`).
- Commit + PR, proyecto Vercel `nexo-productos`, `PRODUCTOS_APP_URL` en
  `nexocore`, merge y prueba en producción.
- Mostrar las acciones `productos.*` en la pantalla de Auditoría del panel.
- La unidad `VARIILA` viene escrita así del ERP; se importa tal cual.
