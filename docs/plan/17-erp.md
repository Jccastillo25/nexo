# Plan 17 — ERP de Materiales J Castillo dentro de Nexo

> **Estado: Paso Cero APROBADO y APLICADO** el 2026-10-20 (`20261020064732`; respuesta del usuario: "Sí, aplicar").
> - Apps `precios` y `erp` registradas e **inactivas**.
> - Catálogo: 11 permisos de precios y 52 del ERP.
> - 12 plantillas, con los conteos exactos.
> - Sin tablas.
> - Lo siguiente es la etapa E1, Listas de precios (§11).
>
> Referencia funcional: ERPNext (procesos de inventario, compras, ventas y
> contabilidad). Se toman sus procesos; no se instala ni se copia código.

## 1. Decisiones del usuario

| Fecha | Decisión |
|---|---|
| 2026-10-19 | El ERP/CRM se construye **dentro de Nexo**, con ERPNext y NextCRM solo como referencia. |
| 2026-10-20 | Nexo **reemplaza al ERP actual por etapas**. El ERP viejo se apaga cuando la última pieza esté validada. |
| 2026-10-20 | Nexo **emite las facturas fiscales**: la empresa ya tiene la autorización de facturación computarizada de la DGI. Faltan los datos de la resolución (§9). |
| 2026-10-20 | Inventario a **costo promedio ponderado**, con varias bodegas por sucursal. |
| 2026-10-20 | El **catálogo de cuentas se importa del ERP actual**. |
| 2026-10-20 | **Una sola app ERP** con menú propio (Inventario, Compras, Ventas y facturación, Caja y cobros, Pagos y bancos, Contabilidad). **Productos** y **Listas de precios** quedan como apps aparte (decisión del 17-10). |
| 2026-10-20 | **La contabilidad legal se lleva en C$.** La factura puede salir en C$ o en US$ al tipo de cambio oficial del BCN del día, que queda guardado en cada documento. |
| 2026-10-20 | "Tiene que estar completamente relacionado con Productos, ya que ahí se crean y cargan los productos. Precios es donde se maneja toda la lista de precios." Además: "Ten siempre en cuenta tomar medidas de seguridad cibernética." |

## 2. Arquitectura

```text
Productos (maestro: ficha, clasificación, unidad, cuentas, costo de referencia)
   │  productos.productos(id) ← lo referencian todos los módulos
   ▼
Listas de precios (app `precios`)
   │  precio vigente por producto y nivel, precio mínimo, descuento máximo
   ▼
CRM (lead → oportunidad → cotización con el precio de lista)
   │  la cotización aceptada pasa a pedido
   ▼
ERP (app `erp`, un solo despliegue `apps/erp`, ruta /erp)
   ├─ Ventas y facturación: pedido → reserva → factura fiscal DGI → despacho
   ├─ Caja y cobros (CxC): sesión de caja, cobros, crédito, notas de crédito
   ├─ Inventario: bodegas, existencias, kárdex, costo promedio, ajustes, traslados, conteos
   ├─ Compras (CxP): orden → recepción (entra a inventario y actualiza el costo) → factura de proveedor → pago
   ├─ Bancos: cuentas, movimientos, conciliación
   └─ Contabilidad: catálogo, asientos automáticos de cada documento, asientos manuales, períodos, estados financieros, IVA y retenciones
```

Reglas de integración:

- **Una sola fuente de verdad por dato.**
  - Productos y sus cuentas contables: **Productos**.
  - Precios: **Precios**.
  - Existencias y costo real: **Inventario**.
  - Saldos: **Contabilidad**.
  - Las cuentas que hoy viven en `productos.cuentas_contables` pasan a apuntar al catálogo de Contabilidad, sin duplicarlo.
- Ningún módulo escribe en las tablas de otro. Los cruces entre módulos van por RPC de servidor, igual que el resto de Nexo. Por ejemplo: emitir la factura llama a la salida de inventario y al asiento contable dentro de **la misma transacción**.
- Cada documento que mueve dinero o inventario genera su **asiento contable automático** en el momento de confirmarse. Las cuentas salen del producto, y si el producto no las tiene, de la configuración de integración.
- **Tablas de hechos particionadas por mes desde el primer día:**
  - kárdex;
  - facturas y sus líneas;
  - cobros;
  - compras;
  - asientos y sus líneas;
  - movimientos bancarios.
- Lógica en RPC `public.precios_*` y `public.erp_*`, que sirven a Web y a Nexo Mobile.
- Un despliegue para el ERP (`apps/erp`, proyecto Vercel `nexo-erp`) y otro para Precios (`apps/precios`), los dos con rewrite en el panel.

## 3. Orden de construcción (cada etapa se valida antes de seguir)

| Etapa | Qué incluye | Para apagar esa parte del ERP viejo |
|---|---|---|
| **E1 Listas de precios** | Niveles de precio por clasificación de cliente (Base, Ferretero, Exclusivo…); listas por moneda y vigencia (borrador → publicada); precio mínimo; descuento máximo; comparativa costo/margen; importar y exportar el Excel de multiprecios. El CRM pasa a cotizar con el precio de lista, lo que cierra el hueco P1. | Los precios oficiales salen de Nexo. |
| **E2 Contabilidad base** | Catálogo importado del ERP; períodos; tipo de cambio BCN; asientos manuales con aprobación; mayorización; balanza de comprobación; configuración de integración (cuentas automáticas). Va antes que los módulos operativos para que cada uno contabilice desde su primer día. | Se registran asientos en Nexo. |
| **E3 Inventario** | Bodegas por sucursal; saldo inicial desde el consolidado del ERP; kárdex; costo promedio ponderado; ajustes con aprobación; traslados con envío y recepción; conteo físico; existencias mínimas; asiento automático de ajustes. | El kárdex vive en Nexo. |
| **E4 Compras, CxP y Bancos** | Proveedores completos (RUC, plazo); orden de compra con aprobación; recepción (entra a inventario y recalcula el costo); factura de proveedor (crea la CxP, el IVA acreditable y las retenciones); pagos con aprobación; cuentas bancarias; conciliación. | Compras y pagos en Nexo. |
| **E5 Ventas, facturación, caja y CxC** | Pedido desde la cotización del CRM, con reserva de inventario; factura fiscal DGI (serie, rango y correlativo sin huecos, impresión con los datos de la resolución, C$ o US$); despacho (salida de inventario y costo de venta); caja (apertura, cobros, arqueo y cierre); crédito (límite y plazo); notas de crédito; anulación conservando el número. | La facturación fiscal en Nexo. |
| **E6 Cierre y corte** | Estados financieros (balance y resultados); libro diario y mayor; reportes de IVA y retenciones; saldos iniciales de CxC, CxP y contables; operación en paralelo con el ERP viejo durante un período; corte definitivo. | Se apaga el ERP viejo. |

## 4. Seguridad (aplica a todas las etapas)

**Base, ya probada en el CRM, Metas y Productos:**
- Las tablas están cerradas a la API: RLS sin políticas y sin GRANT.
- Todo pasa por RPC `security definer` con `search_path = ''`.
- Cada RPC valida el permiso con `core.has_permission` y la empresa.
- `anon` no ejecuta nada.
- Los montos se calculan en el servidor.
- Control de versión en cada edición.
- Mensajes de error sin SQL ni identificadores internos.

**Propio del ERP:**
- **Documentos inmutables.** Una factura emitida, un asiento aprobado o un movimiento de inventario no se editan ni se borran. Se corrigen con su documento inverso: nota de crédito, contra-asiento o ajuste. Esto lo garantizan las RPC; no existe ninguna vía de UPDATE ni DELETE.
- **Numeración fiscal sin huecos.**
  - El correlativo de la serie DGI se asigna con bloqueo de fila dentro de la misma transacción que emite.
  - Una factura anulada conserva su número.
  - La emisión se rechaza fuera del rango autorizado o con la resolución vencida.
- **Idempotencia.** Emitir una factura, registrar un cobro o registrar un pago llevan una clave de idempotencia, para que un doble clic o un reintento del celular no dupliquen el documento.
- **Separación de funciones.** Nadie aprueba lo propio: ajustes de inventario, órdenes de compra, pagos, asientos manuales, pedidos bajo el precio mínimo y créditos. La regla se aplica en la RPC, como la de cotizaciones.
- **Períodos cerrados.** No admiten movimientos con fecha dentro del período.
- **Inventario.** Existencias con bloqueo por producto y bodega, sin negativos salvo que la configuración lo permita de forma explícita.
- **Caja.** El cajero solo opera su propia sesión. El cierre con diferencia queda registrado y lo revisa el supervisor.
- **Auditoría.** Cada documento registra quién y cuándo lo creó, aprobó, anuló o exportó en `core.audit_log` y en sus eventos.
- **Datos sensibles.** Costos, márgenes, cartera y bancos solo se muestran con su permiso. Las exportaciones quedan auditadas.
- **Configuración que haces tú en el panel de Supabase** (yo no la cambio):
  1. Activar la protección de contraseñas filtradas. Hoy el aviso `auth_leaked_password_protection` está abierto.
  2. Exigir doble factor (MFA) a los usuarios con roles financieros.
  3. Confirmar que el plan tiene respaldo con recuperación a un punto en el tiempo (PITR).
- **Transversal:** cabeceras de seguridad (CSP, HSTS y protección contra *clickjacking*) en todas las apps Next, y revisión de seguridad (`nexo-security` + `reviewer`) en cada entrega.

## 5. Matriz de permisos — Listas de precios (app `precios`, 10 + `precios.ver_modulo`)

| Código | Qué permite |
|---|---|
| `precios.dashboard.resumen.ver` | Ver el resumen: listas vigentes, productos sin precio, márgenes bajos. |
| `precios.listas.lista.ver` | Ver listas y precios. |
| `precios.listas.lista.gestionar` | Crear y editar listas: nivel, moneda y vigencia. |
| `precios.listas.precio.editar` | Editar precios en borrador. |
| `precios.listas.precio.publicar` | Publicar una lista como oficial. Desde ese momento es la que usan el CRM y el ERP. |
| `precios.listas.precio.importar` | Importar el Excel de multiprecios. |
| `precios.listas.precio.exportar` | Exportar las listas (queda auditado). |
| `precios.listas.costo.ver` | Ver el costo y los márgenes en la comparativa. |
| `precios.clientes.clasificacion.gestionar` | Clasificaciones de cliente (Ferretero, Exclusivo…) y qué nivel de precio usa cada cliente. |
| `precios.reglas.politica.gestionar` | Precio mínimo, descuento máximo y automático, y comisión. |

Plantillas:

| Permiso | Consulta | Analista de precios | Administrador de precios |
|---|---|---|---|
| `ver_modulo` | ✓ | ✓ | ✓ |
| `dashboard.resumen.ver` | ✓ | ✓ | ✓ |
| `listas.lista.ver` | ✓ | ✓ | ✓ |
| `listas.precio.editar` | | ✓ | ✓ |
| `listas.precio.importar` | | ✓ | ✓ |
| `listas.precio.exportar` | | ✓ | ✓ |
| `listas.costo.ver` | | ✓ | ✓ |
| `listas.lista.gestionar` | | | ✓ |
| `listas.precio.publicar` | | | ✓ |
| `clientes.clasificacion.gestionar` | | | ✓ |
| `reglas.politica.gestionar` | | | ✓ |

Los vendedores del CRM **no necesitan** permisos de Precios. Las RPC `crm_*` leen el precio vigente con el permiso de cotizar, igual que ya pasa con los productos.

## 6. Matriz de permisos — ERP (app `erp`, 51 + `erp.ver_modulo`)

| Área | Código | Qué permite |
|---|---|---|
| General | `erp.dashboard.resumen.ver` | Ver el resumen del ERP según los permisos que tenga. |
| Inventario | `erp.inventario.existencia.ver` | Existencias por bodega y producto. |
| | `erp.inventario.costo.ver` | Costo promedio e inventario valorizado. |
| | `erp.inventario.movimiento.ver` | Kárdex. |
| | `erp.inventario.ajuste.registrar` | Registrar ajustes (merma, daño, sobrante). |
| | `erp.inventario.ajuste.aprobar` | Aprobar ajustes de otras personas. |
| | `erp.inventario.traslado.registrar` | Enviar mercadería entre bodegas. |
| | `erp.inventario.traslado.recibir` | Recibir un traslado. |
| | `erp.inventario.conteo.gestionar` | Conteo físico y su conciliación. |
| | `erp.inventario.bodega.gestionar` | Bodegas y sus parámetros. |
| Compras | `erp.compras.orden.ver` | Ver órdenes de compra. |
| | `erp.compras.orden.crear` | Crear y editar órdenes en borrador. |
| | `erp.compras.orden.aprobar` | Aprobar órdenes de otras personas. |
| | `erp.compras.orden.anular` | Anular una orden. |
| | `erp.compras.recepcion.registrar` | Recibir mercadería: entra al inventario y recalcula el costo. |
| | `erp.compras.factura.registrar` | Registrar la factura del proveedor: crea la CxP, el IVA acreditable y las retenciones. |
| | `erp.compras.proveedor.gestionar` | Proveedores: RUC, contacto y plazo. |
| | `erp.compras.devolucion.registrar` | Devolución a proveedor. |
| Ventas y facturación | `erp.ventas.pedido.ver` | Ver pedidos. |
| | `erp.ventas.pedido.crear` | Crear pedidos (o desde la cotización del CRM). Reserva inventario. |
| | `erp.ventas.pedido.aprobar` | Aprobar pedidos con precio bajo el mínimo o crédito excedido. |
| | `erp.ventas.factura.ver` | Ver facturas. |
| | `erp.ventas.factura.emitir` | Emitir la factura fiscal. |
| | `erp.ventas.factura.anular` | Anular una factura. Conserva el número y lleva motivo. |
| | `erp.ventas.nota_credito.emitir` | Emitir notas de crédito por devolución o descuento. |
| | `erp.ventas.precio.autorizar` | Autorizar en el momento un precio bajo el mínimo. |
| | `erp.ventas.despacho.registrar` | Entregar la mercadería: sale del inventario y se registra el costo de venta. |
| | `erp.ventas.serie.gestionar` | Series y rangos autorizados por la DGI. |
| Caja y cobros | `erp.caja.sesion.operar` | Abrir, operar y cerrar la caja propia. |
| | `erp.caja.sesion.supervisar` | Ver todas las cajas, hacer arqueos y cerrar cajas de otras personas. |
| | `erp.caja.cobro.registrar` | Registrar cobros y abonos. |
| | `erp.caja.cobro.anular` | Anular un cobro, con motivo. |
| | `erp.cxc.cartera.ver` | Cartera de clientes y estados de cuenta. |
| | `erp.cxc.credito.gestionar` | Límite y plazo de crédito por cliente. |
| Pagos y bancos | `erp.cxp.cartera.ver` | Cartera de proveedores. |
| | `erp.cxp.pago.registrar` | Preparar pagos a proveedores. |
| | `erp.cxp.pago.aprobar` | Aprobar pagos preparados por otras personas. |
| | `erp.bancos.cuenta.gestionar` | Cuentas bancarias y chequeras. |
| | `erp.bancos.movimiento.registrar` | Depósitos, transferencias y cargos. |
| | `erp.bancos.conciliacion.gestionar` | Conciliar contra el estado de cuenta. |
| Contabilidad | `erp.contabilidad.catalogo.ver` | Ver el catálogo de cuentas. |
| | `erp.contabilidad.catalogo.gestionar` | Crear, editar e importar cuentas. |
| | `erp.contabilidad.asiento.ver` | Ver asientos, el libro diario y el mayor. |
| | `erp.contabilidad.asiento.registrar` | Registrar asientos manuales en borrador. |
| | `erp.contabilidad.asiento.aprobar` | Aprobar y mayorizar asientos de otras personas. |
| | `erp.contabilidad.asiento.anular` | Anular con un contra-asiento. |
| | `erp.contabilidad.periodo.cerrar` | Cerrar y reabrir períodos. |
| | `erp.contabilidad.reporte.ver` | Balanza y estados financieros. |
| | `erp.contabilidad.integracion.gestionar` | Cuentas automáticas por documento y tipo de cambio BCN. |
| Fiscal | `erp.fiscal.reporte.ver` | Reportes de IVA y de retenciones (IR e IMI). |
| | `erp.fiscal.retencion.gestionar` | Tasas y reglas de retención. |

Plantillas (✓ = incluido; todas incluyen `erp.ver_modulo` y `erp.dashboard.resumen.ver`):

| Plantilla | Permisos |
|---|---|
| **Bodeguero** | inventario: existencia.ver, movimiento.ver, ajuste.registrar, traslado.registrar, traslado.recibir, conteo.gestionar · compras.recepcion.registrar · ventas.despacho.registrar |
| **Jefe de bodega** | Bodeguero + inventario: costo.ver, ajuste.aprobar, bodega.gestionar · compras.orden.ver · compras.devolucion.registrar |
| **Comprador** | inventario: existencia.ver, costo.ver, movimiento.ver · compras: orden.ver, orden.crear, orden.anular, proveedor.gestionar, devolucion.registrar · cxp.cartera.ver |
| **Cajero / facturador** | inventario.existencia.ver · ventas: pedido.ver, pedido.crear, factura.ver, factura.emitir · caja: sesion.operar, cobro.registrar · cxc.cartera.ver |
| **Supervisor de ventas y caja** | Cajero + ventas: pedido.aprobar, factura.anular, nota_credito.emitir, precio.autorizar, despacho.registrar · caja: sesion.supervisar, cobro.anular · cxc.credito.gestionar |
| **Auxiliar contable** | contabilidad: catalogo.ver, asiento.ver, asiento.registrar, reporte.ver · fiscal.reporte.ver · compras.factura.registrar · cxp: cartera.ver, pago.registrar · cxc.cartera.ver · bancos.movimiento.registrar · ventas.factura.ver · inventario: existencia.ver, costo.ver |
| **Contador** | Auxiliar + contabilidad: catalogo.gestionar, asiento.aprobar, asiento.anular, periodo.cerrar, integracion.gestionar · fiscal.retencion.gestionar · bancos: cuenta.gestionar, conciliacion.gestionar · inventario.movimiento.ver · compras.orden.ver |
| **Gerente financiero** | Todos los `*.ver` y `reporte.ver` + aprobaciones: compras.orden.aprobar, cxp.pago.aprobar, cxc.credito.gestionar, ventas.pedido.aprobar, ventas.precio.autorizar, inventario.ajuste.aprobar, caja.sesion.supervisar |
| **Administrador del ERP** | Los 51 |

Las plantillas no asignan a nadie. Los roles de empresa se arman en Configuración → Roles, como en las demás apps.

## 7. Modelo de datos (resumen; el detalle va en el plan de cada etapa)

**`precios`:**
- `niveles` (Base, Precio 2…), con la clasificación de cliente que los usa;
- `listas` (nivel, moneda, vigencia, estado borrador/publicada, versión);
- `lista_precios` (lista, producto, precio, precio mínimo, descuento máximo);
- `clasificaciones_cliente`;
- `cliente_clasificacion` (vínculo con `crm.clientes`);
- `politicas`.
- Una sola lista publicada y vigente por nivel y moneda.

**`erp` (un schema):**
- **Inventario:**
  - `bodegas` (por `core.sucursales`);
  - `existencias` (bodega + producto: cantidad, reservada y costo promedio);
  - `kardex` (**particionado**);
  - `ajustes`, `traslados` y `conteos` + sus líneas.
- **Compras:**
  - `proveedores`, que reemplaza a la lista simple de `productos.proveedores` con migración y sin duplicar;
  - `ordenes_compra`, `recepciones` y `facturas_proveedor` (**particionadas**), con sus líneas;
  - `pagos`.
- **Ventas:**
  - `pedidos`, ligados a la cotización del CRM;
  - `series_fiscales` (resolución, serie, rango, correlativo, sucursal o caja);
  - `facturas` + `factura_lineas` (**particionadas**);
  - `notas_credito`;
  - `despachos`.
- **Caja y CxC:** `cajas`, `sesiones_caja`, `cobros` (**particionada**), `cobro_aplicaciones` y `credito_clientes`.
- **Bancos:** `cuentas_bancarias`, `movimientos_bancarios` (**particionada**) y `conciliaciones`.
- **Contabilidad:**
  - `cuentas` (árbol del catálogo importado, naturaleza, tipo y si acepta movimiento);
  - `periodos`;
  - `tipos_cambio` (BCN diario);
  - `asientos` + `asiento_lineas` (**particionadas**; cuadre débito = crédito validado en el servidor);
  - `integracion_cuentas`;
  - `retenciones`.

## 8. Lo que no se toca sin aprobar su propia etapa

- El schema de cada etapa se presenta con su prueba en transacción revertida, como hicimos con el embudo.
- La facturación fiscal (E5) la valida tu contador antes de emitir la primera factura real.
- El corte del ERP viejo (E6) lo decides tú.

## 9. Datos que necesito de ti

1. **DGI:**
   - número y fecha de la resolución de facturación computarizada;
   - serie(s);
   - rango autorizado (desde–hasta) por sucursal o punto de emisión;
   - formato de impresión (carta, media carta o ticket);
   - leyendas obligatorias.
2. **Catálogo de cuentas** exportado del ERP (Excel). Lo necesito para E2.
3. Los Excel de productos del 16-10:
   - `Plantilla_de_productos_con_multiprecio…xlsx`, para E1;
   - `Productos_16-10-2026.xlsx` (consolidado con existencias y costo), para el saldo inicial de E3.
4. **Bodegas:** cuáles existen y en qué sucursal.
5. **Retenciones:** cuáles aplican hoy (por ejemplo, IR 2 % e IMI 1 %). Conviene confirmarlo con el contador.

## 10. SQL propuesto (Paso Cero, no aplicado)

Las dos apps se registran **inactivas**. El trigger `trg_seed_module_permission` crea `precios.ver_modulo` y `erp.ver_modulo`.

```sql
do $$
begin
  if exists (select 1 from core.apps where slug in ('precios', 'erp')) then
    raise exception 'precheck: precios o erp ya existen';
  end if;
  if exists (select 1 from core.permissions_catalog where code like 'precios.%' or code like 'erp.%') then
    raise exception 'precheck: ya hay permisos precios.* o erp.*';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active) values
  ('precios', 'Listas de precios', 'Cadena de suministro', 'tag', 'purple', '/precios', array['productos'], false),
  ('erp', 'ERP', 'Finanzas', 'calculator', 'green', '/erp', array['productos', 'precios'], false);

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('precios.dashboard.resumen.ver',             'precios', 'dashboard', 'Ver resumen de precios',         'Listas vigentes, productos sin precio y márgenes bajos.'),
  ('precios.listas.lista.ver',                  'precios', 'listas',    'Ver listas de precios',          'Ver listas y precios.'),
  ('precios.listas.lista.gestionar',            'precios', 'listas',    'Gestionar listas',               'Crear y editar listas: nivel, moneda y vigencia.'),
  ('precios.listas.precio.editar',              'precios', 'listas',    'Editar precios',                 'Editar precios en borrador.'),
  ('precios.listas.precio.publicar',            'precios', 'listas',    'Publicar listas',                'Publicar una lista como oficial (la usan CRM y ERP).'),
  ('precios.listas.precio.importar',            'precios', 'listas',    'Importar precios',               'Importar el Excel de multiprecios.'),
  ('precios.listas.precio.exportar',            'precios', 'listas',    'Exportar precios',               'Exportar listas (auditado).'),
  ('precios.listas.costo.ver',                  'precios', 'listas',    'Ver costos y márgenes',          'Costo y márgenes en la comparativa.'),
  ('precios.clientes.clasificacion.gestionar',  'precios', 'clientes',  'Gestionar clasificaciones',      'Clasificaciones de cliente y su nivel de precio.'),
  ('precios.reglas.politica.gestionar',         'precios', 'reglas',    'Gestionar políticas de precio',  'Precio mínimo, descuentos y comisión.'),
  ('erp.dashboard.resumen.ver',                 'erp', 'dashboard',    'Ver resumen del ERP',             'Resumen según los permisos.'),
  ('erp.inventario.existencia.ver',             'erp', 'inventario',   'Ver existencias',                 'Existencias por bodega y producto.'),
  ('erp.inventario.costo.ver',                  'erp', 'inventario',   'Ver costo de inventario',         'Costo promedio e inventario valorizado.'),
  ('erp.inventario.movimiento.ver',             'erp', 'inventario',   'Ver kárdex',                      'Movimientos de inventario.'),
  ('erp.inventario.ajuste.registrar',           'erp', 'inventario',   'Registrar ajustes',               'Merma, daño o sobrante.'),
  ('erp.inventario.ajuste.aprobar',             'erp', 'inventario',   'Aprobar ajustes',                 'Aprobar ajustes de otras personas.'),
  ('erp.inventario.traslado.registrar',         'erp', 'inventario',   'Enviar traslados',                'Enviar mercadería entre bodegas.'),
  ('erp.inventario.traslado.recibir',           'erp', 'inventario',   'Recibir traslados',               'Recibir un traslado.'),
  ('erp.inventario.conteo.gestionar',           'erp', 'inventario',   'Gestionar conteos',               'Conteo físico y su conciliación.'),
  ('erp.inventario.bodega.gestionar',           'erp', 'inventario',   'Gestionar bodegas',               'Bodegas y parámetros.'),
  ('erp.compras.orden.ver',                     'erp', 'compras',      'Ver órdenes de compra',           'Ver órdenes de compra.'),
  ('erp.compras.orden.crear',                   'erp', 'compras',      'Crear órdenes de compra',         'Crear y editar órdenes en borrador.'),
  ('erp.compras.orden.aprobar',                 'erp', 'compras',      'Aprobar órdenes de compra',       'Aprobar órdenes de otras personas.'),
  ('erp.compras.orden.anular',                  'erp', 'compras',      'Anular órdenes de compra',        'Anular una orden.'),
  ('erp.compras.recepcion.registrar',           'erp', 'compras',      'Recibir mercadería',              'Entrada a inventario y recálculo del costo.'),
  ('erp.compras.factura.registrar',             'erp', 'compras',      'Registrar facturas de proveedor', 'CxP, IVA acreditable y retenciones.'),
  ('erp.compras.proveedor.gestionar',           'erp', 'compras',      'Gestionar proveedores',           'RUC, contacto y plazo.'),
  ('erp.compras.devolucion.registrar',          'erp', 'compras',      'Devolver a proveedor',            'Devolución a proveedor.'),
  ('erp.ventas.pedido.ver',                     'erp', 'ventas',       'Ver pedidos',                     'Ver pedidos.'),
  ('erp.ventas.pedido.crear',                   'erp', 'ventas',       'Crear pedidos',                   'Crear pedidos (o desde la cotización del CRM); reserva inventario.'),
  ('erp.ventas.pedido.aprobar',                 'erp', 'ventas',       'Aprobar pedidos',                 'Precio bajo el mínimo o crédito excedido.'),
  ('erp.ventas.factura.ver',                    'erp', 'ventas',       'Ver facturas',                    'Ver facturas.'),
  ('erp.ventas.factura.emitir',                 'erp', 'ventas',       'Emitir facturas',                 'Emitir la factura fiscal.'),
  ('erp.ventas.factura.anular',                 'erp', 'ventas',       'Anular facturas',                 'Anular conservando el número, con motivo.'),
  ('erp.ventas.nota_credito.emitir',            'erp', 'ventas',       'Emitir notas de crédito',         'Devoluciones y descuentos.'),
  ('erp.ventas.precio.autorizar',               'erp', 'ventas',       'Autorizar precio bajo mínimo',    'Autorizar en el momento un precio bajo el mínimo.'),
  ('erp.ventas.despacho.registrar',             'erp', 'ventas',       'Despachar',                       'Salida de inventario y costo de venta.'),
  ('erp.ventas.serie.gestionar',                'erp', 'ventas',       'Gestionar series fiscales',       'Series y rangos autorizados por la DGI.'),
  ('erp.caja.sesion.operar',                    'erp', 'caja',         'Operar caja',                     'Abrir, operar y cerrar la caja propia.'),
  ('erp.caja.sesion.supervisar',                'erp', 'caja',         'Supervisar cajas',                'Ver todas, arqueos y cierres ajenos.'),
  ('erp.caja.cobro.registrar',                  'erp', 'caja',         'Registrar cobros',                'Cobros y abonos.'),
  ('erp.caja.cobro.anular',                     'erp', 'caja',         'Anular cobros',                   'Anular un cobro con motivo.'),
  ('erp.cxc.cartera.ver',                       'erp', 'cxc',          'Ver cartera de clientes',         'Cartera y estados de cuenta.'),
  ('erp.cxc.credito.gestionar',                 'erp', 'cxc',          'Gestionar crédito',               'Límite y plazo por cliente.'),
  ('erp.cxp.cartera.ver',                       'erp', 'cxp',          'Ver cartera de proveedores',      'Cartera de proveedores.'),
  ('erp.cxp.pago.registrar',                    'erp', 'cxp',          'Preparar pagos',                  'Preparar pagos a proveedores.'),
  ('erp.cxp.pago.aprobar',                      'erp', 'cxp',          'Aprobar pagos',                   'Aprobar pagos de otras personas.'),
  ('erp.bancos.cuenta.gestionar',               'erp', 'bancos',       'Gestionar cuentas bancarias',     'Cuentas y chequeras.'),
  ('erp.bancos.movimiento.registrar',           'erp', 'bancos',       'Registrar movimientos bancarios', 'Depósitos, transferencias y cargos.'),
  ('erp.bancos.conciliacion.gestionar',         'erp', 'bancos',       'Conciliar bancos',                'Conciliar contra el estado de cuenta.'),
  ('erp.contabilidad.catalogo.ver',             'erp', 'contabilidad', 'Ver catálogo de cuentas',         'Ver el catálogo.'),
  ('erp.contabilidad.catalogo.gestionar',       'erp', 'contabilidad', 'Gestionar catálogo de cuentas',   'Crear, editar e importar cuentas.'),
  ('erp.contabilidad.asiento.ver',              'erp', 'contabilidad', 'Ver asientos',                    'Asientos, diario y mayor.'),
  ('erp.contabilidad.asiento.registrar',        'erp', 'contabilidad', 'Registrar asientos',              'Asientos manuales en borrador.'),
  ('erp.contabilidad.asiento.aprobar',          'erp', 'contabilidad', 'Aprobar asientos',                'Aprobar y mayorizar asientos de otras personas.'),
  ('erp.contabilidad.asiento.anular',           'erp', 'contabilidad', 'Anular asientos',                 'Anular con contra-asiento.'),
  ('erp.contabilidad.periodo.cerrar',           'erp', 'contabilidad', 'Cerrar períodos',                 'Cerrar y reabrir períodos.'),
  ('erp.contabilidad.reporte.ver',              'erp', 'contabilidad', 'Ver reportes contables',          'Balanza y estados financieros.'),
  ('erp.contabilidad.integracion.gestionar',    'erp', 'contabilidad', 'Gestionar integración contable',  'Cuentas automáticas y tipo de cambio BCN.'),
  ('erp.fiscal.reporte.ver',                    'erp', 'fiscal',       'Ver reportes fiscales',           'IVA y retenciones.'),
  ('erp.fiscal.retencion.gestionar',            'erp', 'fiscal',       'Gestionar retenciones',           'Tasas y reglas de retención.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('precios', 'consulta',           'Consulta de precios',          'Ve listas y precios.'),
  ('precios', 'analista',           'Analista de precios',          'Edita precios en borrador, importa, exporta y ve márgenes.'),
  ('precios', 'administrador',      'Administrador de precios',     'Todo Listas de precios, incluido publicar.'),
  ('erp', 'bodeguero',              'Bodeguero',                    'Existencias, ajustes, traslados, conteos, recepciones y despachos.'),
  ('erp', 'jefe_bodega',            'Jefe de bodega',               'Bodeguero + costos, aprobación de ajustes y bodegas.'),
  ('erp', 'comprador',              'Comprador',                    'Órdenes de compra, proveedores y devoluciones.'),
  ('erp', 'cajero',                 'Cajero / facturador',          'Pedidos, facturas, caja propia y cobros.'),
  ('erp', 'supervisor_ventas',      'Supervisor de ventas y caja',  'Cajero + aprobaciones, anulaciones, notas de crédito y crédito.'),
  ('erp', 'auxiliar_contable',      'Auxiliar contable',            'Asientos en borrador, facturas de proveedor, pagos preparados y bancos.'),
  ('erp', 'contador',               'Contador',                     'Contabilidad completa, fiscal y conciliación.'),
  ('erp', 'gerente_financiero',     'Gerente financiero',           'Consulta todo y aprueba compras, pagos, créditos y ajustes.'),
  ('erp', 'administrador',          'Administrador del ERP',        'Todo el ERP.');

with mapa(role_key, module_slug, codes) as (values
  ('consulta', 'precios', array['precios.ver_modulo','precios.dashboard.resumen.ver','precios.listas.lista.ver']),
  ('analista', 'precios', array['precios.ver_modulo','precios.dashboard.resumen.ver','precios.listas.lista.ver','precios.listas.precio.editar',
                                'precios.listas.precio.importar','precios.listas.precio.exportar','precios.listas.costo.ver']),
  ('bodeguero', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.inventario.movimiento.ver',
                             'erp.inventario.ajuste.registrar','erp.inventario.traslado.registrar','erp.inventario.traslado.recibir',
                             'erp.inventario.conteo.gestionar','erp.compras.recepcion.registrar','erp.ventas.despacho.registrar']),
  ('jefe_bodega', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.inventario.movimiento.ver',
                               'erp.inventario.ajuste.registrar','erp.inventario.traslado.registrar','erp.inventario.traslado.recibir',
                               'erp.inventario.conteo.gestionar','erp.compras.recepcion.registrar','erp.ventas.despacho.registrar',
                               'erp.inventario.costo.ver','erp.inventario.ajuste.aprobar','erp.inventario.bodega.gestionar',
                               'erp.compras.orden.ver','erp.compras.devolucion.registrar']),
  ('comprador', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.inventario.costo.ver',
                             'erp.inventario.movimiento.ver','erp.compras.orden.ver','erp.compras.orden.crear','erp.compras.orden.anular',
                             'erp.compras.proveedor.gestionar','erp.compras.devolucion.registrar','erp.cxp.cartera.ver']),
  ('cajero', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.ventas.pedido.ver',
                          'erp.ventas.pedido.crear','erp.ventas.factura.ver','erp.ventas.factura.emitir','erp.caja.sesion.operar',
                          'erp.caja.cobro.registrar','erp.cxc.cartera.ver']),
  ('supervisor_ventas', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.ventas.pedido.ver',
                          'erp.ventas.pedido.crear','erp.ventas.factura.ver','erp.ventas.factura.emitir','erp.caja.sesion.operar',
                          'erp.caja.cobro.registrar','erp.cxc.cartera.ver','erp.ventas.pedido.aprobar','erp.ventas.factura.anular',
                          'erp.ventas.nota_credito.emitir','erp.ventas.precio.autorizar','erp.ventas.despacho.registrar',
                          'erp.caja.sesion.supervisar','erp.caja.cobro.anular','erp.cxc.credito.gestionar']),
  ('auxiliar_contable', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.contabilidad.catalogo.ver','erp.contabilidad.asiento.ver',
                          'erp.contabilidad.asiento.registrar','erp.contabilidad.reporte.ver','erp.fiscal.reporte.ver',
                          'erp.compras.factura.registrar','erp.cxp.cartera.ver','erp.cxp.pago.registrar','erp.cxc.cartera.ver',
                          'erp.bancos.movimiento.registrar','erp.ventas.factura.ver','erp.inventario.existencia.ver','erp.inventario.costo.ver']),
  ('contador', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.contabilidad.catalogo.ver','erp.contabilidad.asiento.ver',
                          'erp.contabilidad.asiento.registrar','erp.contabilidad.reporte.ver','erp.fiscal.reporte.ver',
                          'erp.compras.factura.registrar','erp.cxp.cartera.ver','erp.cxp.pago.registrar','erp.cxc.cartera.ver',
                          'erp.bancos.movimiento.registrar','erp.ventas.factura.ver','erp.inventario.existencia.ver','erp.inventario.costo.ver',
                          'erp.contabilidad.catalogo.gestionar','erp.contabilidad.asiento.aprobar','erp.contabilidad.asiento.anular',
                          'erp.contabilidad.periodo.cerrar','erp.contabilidad.integracion.gestionar','erp.fiscal.retencion.gestionar',
                          'erp.bancos.cuenta.gestionar','erp.bancos.conciliacion.gestionar','erp.inventario.movimiento.ver',
                          'erp.compras.orden.ver']),
  ('gerente_financiero', 'erp', array['erp.ver_modulo','erp.dashboard.resumen.ver','erp.inventario.existencia.ver','erp.inventario.costo.ver',
                          'erp.inventario.movimiento.ver','erp.compras.orden.ver','erp.ventas.pedido.ver','erp.ventas.factura.ver',
                          'erp.cxc.cartera.ver','erp.cxp.cartera.ver','erp.contabilidad.catalogo.ver','erp.contabilidad.asiento.ver',
                          'erp.contabilidad.reporte.ver','erp.fiscal.reporte.ver','erp.compras.orden.aprobar','erp.cxp.pago.aprobar',
                          'erp.cxc.credito.gestionar','erp.ventas.pedido.aprobar','erp.ventas.precio.autorizar',
                          'erp.inventario.ajuste.aprobar','erp.caja.sesion.supervisar'])
)
insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, c from mapa m join core.app_roles r on r.module_slug = m.module_slug and r.role_key = m.role_key
cross join lateral unnest(m.codes) c
union all
select r.id, p.code from core.app_roles r join core.permissions_catalog p on p.module_slug = r.module_slug
where r.role_key = 'administrador' and r.module_slug in ('precios', 'erp');

do $$
declare v record;
begin
  if (select count(*) from core.permissions_catalog where module_slug = 'precios') <> 11 then raise exception 'postcheck: precios'; end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'erp') <> 52 then raise exception 'postcheck: erp'; end if;
  -- Ningún código de las plantillas fuera del catálogo (fallaría la FK), y conteos por plantilla.
  for v in select r.module_slug, r.role_key, count(rp.*) n from core.app_roles r left join core.app_role_permissions rp on rp.app_role_id = r.id
           where r.module_slug in ('precios', 'erp') group by 1, 2 loop
    raise notice '% / %: %', v.module_slug, v.role_key, v.n;
  end loop;
end;
$$;
```

**Ensayo en `nexo-core`** (2026-10-20), dentro de una transacción revertida:
- El precheck pasó y no quedó nada escrito.
- Catálogo: precios 11, ERP 52.
- Las plantillas dieron exactamente los conteos esperados.

Conteos esperados por plantilla:
- **Precios:** Consulta 3, Analista 7, Administrador 11.
- **ERP:** Bodeguero 10, Jefe de bodega 15, Comprador 11, Cajero 10, Supervisor 18, Auxiliar contable 15, Contador 25, Gerente financiero 21, Administrador 52.

## 11. Después de aprobar

1. Aplicar el Paso Cero con las apps inactivas y verificar los conteos.
2. En el Launcher, el mosaico "Próximamente" de Facturación, Inventario, Compras, Contabilidad, Bancos y Punto de venta se reemplaza por un solo **ERP**. Listas de precios ya figura en esa lista.
3. **E1 Listas de precios:** especificación (ux-planner), esquema con pruebas revertidas, `apps/precios`, importación del Excel de multiprecios y conexión de las cotizaciones del CRM al precio de lista.
4. **E2 Contabilidad base**, en cuanto tenga el catálogo de cuentas, y así sucesivamente.
