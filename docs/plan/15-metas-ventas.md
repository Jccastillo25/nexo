# Plan 15 — Metas de ventas y Presupuesto (dentro del CRM)

> **RETIRADO el 2026-10-20.** El usuario pidió borrar el CRM y replicar AG Negocio, su ERP actual ([plan 18](18-replica-ag-negocio.md)). Las pantallas, los esquemas `crm`/`metas` y sus permisos se borraron sin datos (`20261020143821`). El código está en la rama local `respaldo/crm-2026-10-20`. Este documento queda solo como historia.

Convierte el Excel `PPTO 2026 JCastillo.xlsx` (ventas por factura 2023–2026,
compras y presupuesto +32%) en una parte del **CRM** (`apps/crm`, `/crm`) donde
**cada vendedor ve su progreso contra su meta personal mensual** y gerencia ve
al equipo y al presupuesto de la empresa.

Desde 2026-10-18 (decisión del usuario) **no es una app aparte**: el CRM es el
módulo único de ventas (Clientes + Metas + Presupuesto + facturas importadas
del ERP). La app suelta `metas` que existió unas horas se retiró del catálogo.

Estado: esquema, RPC y permisos `crm.*` **aplicados** en `nexo-core`;
pantallas implementadas en local dentro de `apps/crm`; sin datos, sin sesión
real, sin commit. Detalle:
[esquema](../status-log/2026-10-18-metas-paso-cero-esquema.md) ·
[app e importador](../status-log/2026-10-18-metas-app-importador.md) ·
[integración en el CRM](../status-log/2026-10-18-metas-dentro-de-crm.md).

## 1. Origen y análisis del Excel

El archivo del usuario (no se copió al repositorio) tiene:

| Hoja | Contenido | Uso |
|---|---|---|
| `2023`, `2024`, `2025`, `2026` | Una fila por factura: fecha, vencimiento, número, cliente, anulada, total C$, total US$, vendedor (`001-Edith  Saballo`). 2026 agrega abono y saldo | **Fuente de ventas reales** (importación) |
| `PPTO +32%` | Venta bruta 2025 (US$ 3,093,113) × 1.32 = US$ 4,082,909, repartida por % mensual | **Presupuesto de la empresa** |
| `Dashboard` | Resúmenes, cumplimiento, ventas por vendedor | Lo reemplazan los dashboards |
| `compras` | Facturas de proveedores y saldo | Fuera de alcance (posible fase/app de Compras) |

Hallazgo que cambió el diseño: hay **rotación de vendedores**. Milagro
Carrillo tuvo el 41% de septiembre 2025 y no vende desde junio 2026;
Bianka Briones y Alvaro Vega no existían en 2025. Repartir la meta por el
peso del año anterior asignaría meta a quien ya no está.

Otro hallazgo: la celda "Cumplimiento PPTO 2026 = 97%" del Excel compara la
venta acumulada contra el presupuesto **anual**; contra el acumulado a la
fecha (ene–sep) el cumplimiento real es 127%. El dashboard muestra los dos.

## 2. Decisiones del usuario

| Fecha | Decisión |
|---|---|
| 2026-10-17 | Ventas reales: **importar el Excel del ERP** (mismas columnas), sin duplicar al volver a subirlo |
| 2026-10-17 | Meta personal: **reparto sugerido + ajuste manual** del gerente |
| 2026-10-17 | Moneda: **US$** con C$ de referencia |
| 2026-10-17 | Visibilidad: **el vendedor ve solo lo suyo**; gerencia ve equipo, ranking y empresa |
| 2026-10-18 | Matriz de permisos aprobada ("Autorizado") tras ver la [maqueta](https://claude.ai/artifact/AYKqKdMSQSaVuE2pPVqMrx) |
| 2026-10-18 | Reparto sugerido por lo vendido por cada vendedor **activo en los 3 meses anteriores** |
| 2026-10-18 | El Excel llegará **en bruto, sin depurar**: el importador lo limpia (ver §5) |
| 2026-10-18 | **Integrar Metas y Presupuesto dentro del CRM, como un solo módulo de ventas**; matriz `crm.*` aprobada ("Si") |

## 3. Permisos (aplicados, `20261018184849`)

Reemplazan a los `metas.*` del Paso Cero original (`20261018133816`, retirados).

| Código | Vendedor | Gerente de ventas | Administrador de ventas |
|---|:-:|:-:|:-:|
| `crm.ver_modulo` | ✅ | ✅ | ✅ |
| `crm.clientes.ver` | ✅ | ✅ | ✅ |
| `crm.clientes.crear` / `.editar` | | ✅ | ✅ |
| `crm.clientes.eliminar` | | | ✅ |
| `crm.metas.avance_propio.ver` | ✅ | ✅ | ✅ |
| `crm.ventas.factura_propia.ver` | ✅ | ✅ | ✅ |
| `crm.metas.avance_equipo.ver` | | ✅ | ✅ |
| `crm.ventas.factura.ver` | | ✅ | ✅ |
| `crm.ventas.factura.importar` | | ✅ | ✅ |
| `crm.metas.meta_vendedor.gestionar` | | ✅ | ✅ |
| `crm.metas.presupuesto.gestionar` | | | ✅ |
| `crm.configuracion.vendedor.gestionar` | | | ✅ |

Plantillas `core.app_roles` del CRM: `vendedor` (4), `gerente` (10),
`administrador` (13). Los permisos de Clientes son de 3 segmentos por ser
anteriores a la norma; los nuevos son de 4. No se asignó nada a roles de empresa.

## 4. Modelo de datos (aplicado, `20261018135152`)

Schema `metas` (nombre técnico; pertenece al CRM) cerrado a la API (RLS sin
políticas, `revoke all`): todo por RPC `public.metas_*` (`security definer` +
`core.fn_exigir_permiso` con los códigos `crm.*`), reutilizable por Web y Mobile.

| Tabla | Tipo | Contenido |
|---|---|---|
| `vendedores` | catálogo | Código del ERP (`001`), nombre, `user_id` opcional (un usuario = un vendedor por empresa), activo. Se crean solos al importar |
| `facturas` | hechos, **particionada por mes** (`fecha`) | Número (en mayúsculas), cliente, anulada, total C$, total US$, vendedor, importación. Identidad de negocio `(empresa, número)`; si el ERP cambia la fecha, se reemplaza |
| `importaciones` | log, **particionada por mes** | Archivo, usuario, filas, nuevas, actualizadas, errores, rango de fechas |
| `presupuestos` + `presupuesto_meses` | catálogo | Venta base, % crecimiento, total; % y monto por mes (los % suman 100) |
| `metas_vendedor` | catálogo | Vendedor × año × mes, monto US$, origen `sugerida`/`ajustada` |

Reglas:

- **"Lo propio"** = vendedor cuyo `user_id` es el usuario que llama. Sin
  vínculo, las RPC propias devuelven `vinculado = false` y ningún dato.
- **Anuladas** no suman a ventas.
- **C$ de referencia** de una meta = meta US$ × tipo de cambio implícito de
  las facturas del mes (sum C$ / sum US$).
- **Meta sugerida** del mes = meta de la empresa del mes × peso de cada
  vendedor activo en los 3 meses anteriores. Las metas `ajustada` no se
  pisan al regenerar, salvo que se pida.
- Importación por lotes (la RPC acepta hasta 5000; la pantalla manda 1000,
  ~0.9 s medido); `confirmar = false` es vista previa sin escribir; los lotes
  del mismo archivo comparten `importacion_id`.
- Cada escritura deja su fila en `core.audit_log` (acciones `metas.*`).

RPC: `metas_mi_avance`, `metas_mis_facturas`, `metas_equipo`,
`metas_facturas`, `metas_vendedores`, `metas_usuarios_vinculables`,
`metas_presupuesto` (incluye venta del año anterior y su reparto como
sugerencia), `metas_metas_mes`, `metas_importar_facturas`,
`metas_guardar_vendedor`, `metas_guardar_presupuesto`,
`metas_generar_sugeridas`, `metas_ajustar_meta`.

## 5. Pantallas (en `apps/crm`)

Menú del CRM (`apps/crm/src/lib/nav.ts`, `crmNav(permisos)`):

```text
Dashboard                                  /dashboard           (el del CRM)
Ventas
  ├─ Clientes                              /clientes
  ├─ Facturas | Mis facturas               /facturas
  ├─ Importar del ERP                      /importar
  └─ Leads, Oportunidades, Actividades, Cotizaciones   (Pronto)
Metas
  ├─ Mi avance | Avance del equipo         /metas
  ├─ Metas por vendedor                    /metas/por-vendedor
  └─ Presupuesto anual                     /presupuesto
Análisis
  └─ Histórico                             (Pronto)
Configuración
  └─ Vendedores y usuarios                 /configuracion/vendedores
```

Cada ítem de Metas/Facturas aparece solo con su permiso; un grupo sin hijos
no se muestra. Decisiones sobre la especificación: lote de 1000 facturas;
tipo de cambio por defecto 36.6243 editable; anuladas sin total se guardan en
0; la suma de metas vs. meta de la empresa solo se informa; sin prorrateo por
días; mensajes de la base con voseo se pasan a "tú" en el cliente; vendedores
nuevos y duplicados se calculan en el cliente; sin historial de importaciones.

**Lector del Excel en bruto** (`apps/crm/src/lib/metas/importacion.ts`, 9
pruebas en `pnpm test:metas`): todas las hojas, encabezado buscado debajo de
títulos con sinónimos, hojas que no son de facturas ignoradas con motivo,
filas de totales/subtotales/encabezados repetidos fuera, fechas y montos en
texto, duplicados entre hojas, US$ calculado si falta. Validador sin tocar la
base: `pnpm --filter materiales-jcastillo-crm validar-excel -- "archivo.xlsx"`.
Con el Excel actual: 47 301 facturas que cuadran con su Dashboard.

Referencia visual: [maqueta](https://claude.ai/artifact/AYKqKdMSQSaVuE2pPVqMrx).

## 6. Pendiente

1. Recorrer `/crm/metas` con sesión real en local.
2. Recibir el Excel en bruto, correr el validador, revisar con el usuario e
   importar desde **Ventas → Importar del ERP**. Cargar el presupuesto 2026.
3. Vincular vendedores con usuarios y asignar las plantillas del CRM a roles de empresa.
4. Commit/PR y deploy de `apps/crm` (proyecto Vercel existente; sin rewrite nuevo).
5. Fuera de alcance por ahora: compras, cuentas por pagar y cartera.
