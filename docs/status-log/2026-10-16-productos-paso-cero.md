# 2026-10-16 — Paso Cero del módulo Productos

- **Subfase / entregable:** Paso Cero (matriz de permisos y plantillas) del módulo `productos`, catálogo maestro de productos.
- **Estado anterior → nuevo:** inexistente → app registrada **inactiva** con su catálogo de permisos y plantillas.
- **Migración:** [`20261016203638_productos_paso_cero.sql`](../../supabase/migrations/20261016203638_productos_paso_cero.sql) (aplicada a `nexo-core`; versión remota `20261016203638`).
- **Diseño:** [`plan/14-productos.md`](../plan/14-productos.md).
- **Commit:** pendiente.

## Origen

Pedido del usuario: "Necesitamos primero el módulo de productos para luego
pasar a elaborar el módulo de listas de precios". El usuario entregó las dos
plantillas de importación de su ERP actual
(`Importacion_de_productos_datos_16-10-2026.xlsx`, ~700 productos, y
`Plantilla_de_productos_con_multiprecio_con_datos_16-10-2026.xlsx`). Su
análisis (columnas, clasificación Clase→Tipo→Categoría, marca↔clase,
cuentas contables, multiprecios y precios por clasificación de cliente) está
en el plan 14 §1. Los archivos no se copiaron al repositorio.

Adelanta el catálogo de productos respecto al orden del Plan Maestro (antes
dentro de FASE 5 — Inventario), por decisión del usuario.

## Decisiones del usuario

1. Matriz y 4 plantillas aprobadas tal como se presentaron.
2. **Nexo es el maestro de productos**; el ERP se alimenta con la exportación en su formato.
3. Listas de precios debe comunicarse con Productos (llamar productos, comparativa, listas oficiales); app aparte o sección: **sin decidir**.

## Verificación remota previa (solo lectura)

`core.apps` sin `productos`; ningún código `productos.*`/`inventario.*`/`precios.*`
ni con "producto"/"precio" en `core.permissions_catalog`; ninguna plantilla en
`core.app_roles`; ninguna tabla de productos/precios en ningún schema.

## Verificación posterior

| Comprobación | Resultado |
|---|---|
| `core.apps` `productos` | existe, `active = false`, categoría "Cadena de suministro" |
| Permisos `module_slug = 'productos'` | 17 (16 + `productos.ver_modulo` creado por el trigger) |
| Plantilla `consulta` / `editor` / `contabilidad` / `administrador` | 3 / 7 / 8 / 17 permisos |
| `core.company_apps` para `productos` | 0 filas (ninguna empresa la tiene habilitada) |
| `supabase_migrations.schema_migrations` | `20261016203638 productos_paso_cero` |

## Pruebas

Solo catálogo; no hay código ni tablas que probar. `pnpm verify` se corre
antes del PR (la migración no cambia ninguna app).

## Pendiente

- Aprobar el modelo de datos (plan 14 §4) y aplicarlo.
- Decidir si Listas de precios es app aparte o sección de Productos.
- Importación de la plantilla del ERP, `apps/productos`, proyecto Vercel, rewrite en `apps/nexo/next.config.ts`, activación.
