# 18 — Réplica de AG Negocio dentro de Nexo

**Estado:** EN CURSO.
- El inventario se hizo el 2026-10-20.
- **R0 está hecho** el mismo día: el CRM se retiró (`20261020143821`) con respaldo en la rama local `respaldo/crm-2026-10-20`.
- Sigue el Paso Cero de R1 y R2.
**Pedido del usuario (2026-10-20):**
- "abre esta pagina es el ERP que tenemos actualmente necesito que lo copies y lo implementes en su totalidad para luego mejorarlo".
- "una vez termines de analizar todo el sistema, borra todo lo de CRM que tenemos actualmente y genera el codigo para copiar todo lo nuevo basado en Ag negocio".

Este plan **reemplaza** al embudo comercial tipo NextCRM ([plan 16](16-crm-embudo-comercial.md)) y **reordena** las etapas del [plan 17](17-erp.md). Las decisiones del 2026-10-20 del plan 17 siguen vigentes: Nexo emite la factura DGI, el inventario se valora a costo promedio ponderado, el catálogo de cuentas se importa, los libros van en C$ y la factura puede ir en C$ o US$. Solo cambia la referencia funcional: ahora es AG Negocio, pantalla por pantalla.

## 1. Qué es AG Negocio

- Es un ERP en la nube de **AG Software, S.A.** (Managua). Es software propietario: no es de código abierto y no tiene repositorio público.
- Su sitio [agnegocio.com](https://agnegocio.com/) publica planes de C$9,200 a C$54,300 al mes.
- Por las huellas técnicas está hecho en Ruby on Rails (con Turbo y Foundation off-canvas). Su nombre interno es `rubyledger`.
- Es un producto genérico para muchos giros: tiene campos de colegio (carrera, becas, pensum), de restaurante (recetas) y de fábrica.
- Nexo copia **el funcionamiento**: pantallas, campos, reglas, informes y documentos. **No copia** su código, su marca ni sus textos de ayuda.

Volumen actual en la instancia `jcastillo`, según los contadores de las listas:

| Dato | Cantidad |
|---|---|
| Clientes | 110 |
| Proveedores | 61 |
| Productos | 701 (113 categorías, 64 tipos, 15 clases, 32 marcas, 17 unidades) |
| Catálogo de cuentas | 241 cuentas |
| Tasas de cambio | 1,507 registros diarios |
| Meses contables | 46 (unos 4 años de historia) |
| Facturas de compra | 5,802 |
| Despachos / remisiones | 13,152 |
| Movimientos de inventario (kardex) | 139,324 |
| Bitácora de acciones | 649,516 |
| Sucursales / bodegas | 1 / 1 |
| Series de documentos | 5 |
| Bancos / cuentas bancarias | 7 / 5 |
| Tipos de pago | 10 |
| Empleados / usuarios / roles | 11 / 10 / 6 |

Las facturas de venta no muestran total, porque la lista se carga aparte. La última vista es la F/Venta 97524, así que son unas 97 mil.

## 2. Reglas transversales que se repiten en todo el sistema

1. **Doble moneda en cada documento.** Cada documento elige moneda (C$ o US$) y guarda su tasa. Las listas muestran cada monto en C$ y en USD: subtotal, IVA, descuento, total y saldo. La tasa sale del catálogo diario de tasas, con tipo de tasa: oficial BCN u otra.
2. **Series y consecutivos por sucursal y por tipo de documento**, con número inicial y estado activa. La serie va en factura, recibo, minuta, devolución, nota, orden, transferencia y demás.
3. **Ciclo del documento.** Un documento se puede crear, editar, aprobar o rechazar, anular (con su fecha de anulación) y des-anular. Además se marca como impreso o no impreso, se puede reimprimir y se puede clonar. Anular no es eliminar: el documento anulado se queda.
4. **Asiento contable automático.** Cada documento genera su asiento (número de cuenta, nombre, débito, crédito y centro de costo), que se ve en el detalle. Las cuentas salen del cliente o proveedor (CxC y CxP), del producto (ingresos, inventario y costo), de la bodega, del tipo de pago y de la sucursal (mora, ingresos y gastos financieros).
5. **Centro de costo y proyecto** en el encabezado y en cada línea. El centro de costo es jerárquico, con un centro mayor.
6. **Campos especiales** configurables por tipo de documento, opcionales u obligatorios. **Características** de producto filtrables en todas las listas.
7. **Exonerada o exportación** con número de exoneración en ventas y compras. El cliente o proveedor también puede estar exonerado, con una cuenta para ingresos exonerados.
8. **Crédito.** Cada cliente tiene límite de crédito, días de crédito, número de facturas vencidas permitidas y prórroga. La factura muestra el "crédito disponible".
9. **Cobro de facturas.** Los pagos van dentro de la factura o por recibo. Un pago se puede hacer en varias monedas y con varios tipos de pago, y se puede aplicar un anticipo.
   - El sistema sugiere el vuelto y deja aplicarlo.
   - Lleva la mora, que se puede exonerar o congelar.
   - Si la venta es financiada, separa capital e interés por cuota.
   - Calcula la diferencia cambiaria.
10. **Bitácora** de cada acción por usuario, recurso y documento ("Ver Logs" en cada documento).
11. **Exportación.** Casi todas las listas exportan a Excel y los documentos a PDF. Productos, multiprecios, escalas, proveedores, tasas, activos y saldos iniciales también tienen plantillas de importación.
12. **Documentos digitalizados** adjuntos a cada documento, con un control de almacenamiento.
13. **Roles con matriz RECURSO × ACCIÓN.**
    - Acciones generales: lista, crear, actualizar, eliminar, anular, exportar a Excel, exportar a PDF y reimprimir.
    - Acciones especiales: aprobar, des-anular, editar impreso, editar fecha, editar tasa de cambio, editar precio de venta, vender por debajo del costo, aprobar orden o transferencia, exonerar o congelar mora, clonar, enviar correo, exportar la base de datos y ver dashboard.
    - Por usuario también se configura:
      - **Valores por defecto:** sede, serie, centro de costo, bodega, cuenta de caja, tipo de pago y moneda.
      - **Restricciones:** marca, ocultar costos, omitir asiento, ser multivendedor y si el usuario está limitado.
      - **Accesos:** web y móvil, y la llave secreta.

## 3. Inventario completo, por grupo del menú

Columna "AG": ruta en AG Negocio. "Crear": tiene formulario de alta. "XLS": exporta a Excel.

### 3.1 Cuentas por Cobrar (ventas y cobranza)

| Pantalla | AG | Qué hace / campos clave |
|---|---|---|
| Clientes | `clientes` | Lista: código, nombre, cédula, RUC, teléfono, vendedor, dirección, límite de crédito, activo. Formulario de 94 campos:<br>• Datos generales: tipo de cliente, código, nombres y apellidos, sexo, ciudad, departamento, municipio, sucursal, clasificación y subclasificación, vendedor, contacto, teléfono, correo.<br>• Contabilidad e impuestos: cuenta CxC y cuenta CxP, exonerado, exportación, moneda.<br>• Descuento y crédito: descuento máximo o automático, límite y días de crédito, facturas vencidas permitidas, prórroga.<br>• POS y correo: cliente predeterminado del POS, facturación por correo (contacto, cargo y correo de envío de la factura).<br>• Empresa del cliente y ubicaciones con latitud y longitud.<br>• Bloque académico (carrera, becas, títulos): no aplica. XLS e importación. |
| Clasificación | `clasificacions` | Clasificación → subclasificación de clientes. |
| Saldos iniciales | `saldos_inicials` | Saldo de arranque por cliente: documento, fecha, vencimiento, moneda, tasa, monto y referencia. XLS e importación. |
| Sucursal/Sedes | `sucursal_sedes` | Nombre, RUC, siglas, dirección, coordenadas, contacto, IVA específico y % de impuesto. Cuentas de mora, ingresos y gastos financieros, y % de mora. Bodega principal y tipo de documento. |
| Consecutivo de serie | `consecutivo_de_series` | Serie por sucursal y documento: número inicial, activa, minuta y recibo. Es la base de la numeración DGI. |
| Cotizaciones | `cotizacions` | Encabezado:<br>• Cliente, tipo de cotización, moneda, tasa, referencia, serie y número.<br>• Fechas de cotización y expiración, vendedor, centro de costo.<br>• Exonerada o exportación; aprobar, rechazar o anular. |
| | | Líneas: producto, bodega, cantidad, unidad, precio (lista o escala), descuento, total.<br>Totales: subtotal, IVA y total. Muestra el crédito disponible. XLS. |
| Factura de venta | `factura_de_vents` | Encabezado de la cotización, más:<br>• Datos de facturación: tipo de factura (contado o crédito), "facturado a", fechas de factura y expiración, concepto y documento físico.<br>• Datos de entrega: placa, quien retira, cédula, teléfono, transporte, recibido por y entregado por. |
| | | Líneas: código de barras, producto, bodega, cantidad, unidad, precio (lista o escala), descuento, centro de costo, concepto y garantía (monto o porcentaje). |
| | | Pagos: fecha, moneda, tipo de pago, cuenta, montos en C$ y en US$, nota de crédito, referencia y recibo de anticipo. También vuelto sugerido y aplicado, abonado y saldo pendiente. |
| | | Detalle de la factura: abonos con mora y capital, asiento contable y logs. Se imprime en PDF de factura, de detalle, de transacción y de pago de prima. Filtros: período, número, cliente, vendedor, sucursal, moneda, tipo, estado (anulada, impresa, sin vendedor) y campos especiales. |
| Factura de venta rápida | `factura_de_venta_rapidas` (Configuración) | Plantillas de factura con cliente, tipo, moneda, sucursal, serie, centro de costo y predeterminada. |
| Punto de venta (POS) | `punto_de_ventas/new` | Factura rápida de mostrador con existencias a la vista y botones "Guardar", "Guardar e imprimir" y "Pagar". |
| Factura masiva | `facturas_masivas` | Genera facturas por categoría principal y secundaria y por período. Pensado para colegios. |
| Facturación recurrente | `facturacion_recurrentes` | Plantilla con clientes, período de inicio y fin, plazo, días de crédito y líneas. Muestra el próximo período y la última generación. |
| Despacho / entrega | `remisiones` | Remisión de entrega desde factura, por bodega y con estado. En la configuración se activa "crear entrega por factura". Lleva 13,152 registros. |
| Devolución sobre ventas | `devolucion_sobre_ventas` | Sobre una factura: total devuelto, devolución en efectivo con su cuenta, serie, número y anulación. |
| Notas de crédito / débito | `nota_credito_debitos` | Tipo de nota, concepto breve, moneda, tasa, monto y documentos que afecta (con mora, pendiente y abonado). Lleva asiento manual en debe y haber y cuotas. |
| Nota de cobro | `nota_de_cobros` | Documento de cobro con líneas de producto. Es como una pre-factura. |
| Recibos | `recibos` | Cobro a cliente. Selecciona documentos por rango y paga cada uno: monto, mora, pendiente, abonado y diferencia cambiaria. Lleva cuenta, centro de costo, moneda, tipo de pago y anticipo, y muestra cuotas. Marca impreso o anulado. |
| Minuta de pago | `minuta_pagos` | Depósito del cliente: banco, cuenta bancaria, tipo de pago, moneda, monto, número de minuta, serie y referencia. Lleva aprobación. |
| Cierre de caja | `cierre_cajas` | Cierre por usuario y fecha, con aprobación y conteo de billetes y monedas (ver Catálogo). |
| Financiamiento | `financiamientos` | Planes de financiamiento: tipo, % de prima, meses y predeterminado. |
| Garantía | `garantias` | Tipos de garantía con cuenta contable, tipo y período. |
| Recetas | `recetas` | Combos o kits: productos con cantidad, precio asignado, moneda, plazo y existencias disponibles. |
| Recetas de conversión | `receta_conversions` | Conversión de un producto en otros, por ejemplo una barra que se corta en piezas. |
| Informes CxC (13) | — | Estado de cuenta, facturas a vencerse, historial de CxC por cliente, antigüedad de saldos, informe de caja, comisión por pagos, comisiones por vendedor, mejores vendedores, recibos, ventas por categoría, reporte de cotizaciones, saldos de CxC y consolidado de becas (no aplica). |

### 3.2 Cuentas por Pagar (compras)

| Pantalla | AG | Qué hace / campos clave |
|---|---|---|
| Proveedores | `proveedores` | Tipo, código, activo, nombre, contacto, cédula, RUC, dirección, teléfono, correo, exoneración, días de crédito, cuentas CxC y CxP y moneda. XLS, plantilla e importación. |
| Saldos iniciales de proveedores | `saldos_iniciales_proveedors` | Saldo de arranque por proveedor, con importación. |
| Solicitud de compras | `solicitud_de_compras` | Pedido interno: tipo de orden, tipo de compra, vendedor, sucursal, serie, centro de costo, aprobación y líneas de producto o descripción. Se puede consolidar varias solicitudes. |
| Cotización de compras | `cotizacion_de_compras` | Cotización del proveedor con líneas a precio de compra y costo promedio. Se aprueba o rechaza y se convierte en orden. |
| Órdenes de compra | `ordenes_compras` | Orden con producto o servicio, proveedor, moneda, tasa, aprobación, "es importación" y líneas con costo sugerido. Se pueden consolidar órdenes. |
| Factura de compra de productos | `factura_de_compras` | Entrada a bodega con proveedor, exonerada, importación, tipo, moneda, tasa, centro de costo y guía de entrega. Líneas con costo promedio y precio de compra; retenciones (tipo, monto sujeto, % y retenido) y pagos por comprobante. Lleva 5,802 registros. |
| Factura de compra de servicios | `factura_de_compra_de_servicios` | Gasto con asiento en debe y haber. |
| Póliza de importación | `importacions` | Factura del proveedor con FOB, factores y costos de importación (impuestos, flete, etc.) que se reparten al costo promedio de cada producto. |
| Catálogo de importación | `catalogo_importacions` | Conceptos de costo de importación con su cuenta. |
| Devoluciones | `devolucions` | Devolución al proveedor por bodega y factura. |
| Informes CxP (4) | — | Detalle de CxP, estado de cuenta, facturas a vencerse y saldos. |

### 3.3 Inventario

| Pantalla | AG | Qué hace / campos clave |
|---|---|---|
| Productos | `productos` | Formulario de 77 campos:<br>• Identificación: nombre, código, código de barras, código SAC y fecha de ingreso.<br>• Banderas: descontinuado (ventas y compras), es servicio, no inventariable, publicar en web, permitir editar.<br>• Cuentas: ingresos, inventario y costos.<br>• Clasificación: unidad, moneda, marca, clase, tipo, categoría y proveedor.<br>• Costos y precios: costo, margen de ganancia, margen bruto, precio de venta y precio mínimo.<br>• Existencias mínima y máxima, garantía y peso.<br>• Descuento máximo o automático y comisión, por categoría o empresa.<br>• Precios adicionales por sucursal o escala: nombre, período, tipo, monto o %, habilitado.<br>• Exenciones de impuesto, UUID y clasificación. |
| | | Exporta en XLS: datos, **plantilla de multiprecios** y **plantilla de escalas de precio**. |
| Categorías / Tipos / Clases / Marcas | `categoria_productos`, `tipo_productos`, `clase_productos`, `marcas` | Jerarquía categoría → tipo → clase → marca. La categoría lleva % de comisión y descuento máximo. |
| Características de productos | `caracteristica_productos` | Atributos filtrables con su tipo. |
| Catálogo de escala de precio | `escala_precios` | Listas de precio por % o monto fijo sobre el precio base. |
| Usuarios por escala de precios | `admin_user_escala_precios` | Qué escalas puede usar cada usuario. |
| Unidades de medida | `unidad_medidas` | Catálogo de unidades. |
| Bodegas | `bodegas` | Nombre, tipo, cuenta de inventario, principal y tienda en línea. |
| Ubicaciones | `ubicaciones` (Catálogo) | Ubicación dentro de bodega, con sububicaciones. |
| Ajustes de inventario | `ajuste_inventarios` | Entrada o salida por bodega con tipo, cuenta, tasa, aprobación y anulación. Líneas: producto, existencias, costo original, costo unitario y total. |
| Transferencia entre bodegas | `tranferencia_bodegas` | Sucursal y bodega de origen y destino, cada una con su cuenta de inventario, serie, tasa y aprobación. Puede pedir doble aprobación: salida y entrada. |
| Levantamiento de inventario | `levantamiento_inventarios` | Conteo físico contra el sistema, con diferencia, movimiento y costo. |
| Toma de inventario | `toma_de_inventarios` | Importación de un conteo que genera ajustes. |
| Fábrica de productos | `fabricas` | Producción según fórmula: bodega de materia prima y bodega de producto terminado. Costo de materia prima, MO, CIF y dañados. |
| Fórmula de producción | `formula_produccions` | Lista de materiales (BOM) con cantidad, cuenta y costo unitario. |
| Informes (5) | — | Existencias, existencias en bodega, unidades vendidas, rotación y movimientos (kardex con costo promedio y existencias por bodega y totales). |

### 3.4 Contabilidad

| Pantalla | AG | Qué hace / campos clave |
|---|---|---|
| Comprobantes | `comprobantes` | Asientos de diario y comprobantes de pago:<br>• Pago: tipo, proveedor, moneda, tasa, cuenta bancaria, número de cheque o transferencia, beneficiario.<br>• Retenciones y facturas de compra que se pagan; anticipos.<br>• Detalle: lugar y concepto breve, líneas en debe y haber por cuenta y centro de costo.<br>Exporta lista en PDF y XLS. |
| Catálogo contable | `cuenta_contables` (Catálogo) | 241 cuentas: número, nombre, tipo, categoría, cuenta de mayor, para registrar, cobro o pago, renglón IVA, razón financiera, ajuste por tasa de cambio y estado. |
| Mes contable | `mes_contables` (Catálogo) | Períodos abiertos o cerrados (46). |
| Cierre fiscal | `cierre_fiscals` (Catálogo) | Cierre del año con su comprobante. |
| Centro de costo | `centro_de_costos` | Código, nombre, tipo, mayor y habilitado. |
| Concepto breve | `concepto_breve_comprobantes` | Concepto con su renglón del formulario de IVA. |
| Tasas de cambio | `tasa_de_cambios` | Tasa diaria por tipo, con importación por archivo. Lleva 1,507 registros. |
| Tipo de pago | `tipo_pagos` | Efectivo, tarjeta, etc. Banderas: retención DGI o alcaldía, anticipo, vuelto, cierre de caja, minuta y POS; con cuenta, producto, moneda y %. |
| Tabla alcaldía | `tabla_alcaldias` | Tramos del impuesto municipal mensual. |
| Retenciones | `tipo_retencions`, `tipo_tasa_retencions`, `retencions` | Institución retenedora (DGI o alcaldía) con su secuencia. Tipo de retención con tasa y cuenta, y si va al débito o al crédito. Listado e impresión de constancias. |
| Bancos | `bancos`, `cuenta_bancarias` | Bancos y cuentas bancarias. Cada cuenta tiene número, moneda, cuenta contable, saldos mínimo e inicial y consecutivos de cheque, transferencia y planilla. También plantillas de comprobante y de cheque y fecha de inicio de la conciliación. |
| Configuración de cheques | `configuracion_cheques` | Posición x e y de cada campo del cheque por banco y moneda. |
| Conciliación bancaria | `conciliaciones_bancarias` | Conciliación por cuenta y mes, con plantilla XLS del estado bancario. |
| Informes contables (8) | — | Auxiliares de cuentas, crédito fiscal IVA (VET), detalle de ingresos (VET), detalle de transacciones, historial de cheques, auxiliar de recibos, informe de impuestos y retenciones (VET). |

VET es la Ventanilla Electrónica Tributaria de la DGI: estos informes son el anexo de la declaración.

### 3.5 Informes (gerenciales y financieros, 17)

Son los siguientes:
- Análisis de costos por producto.
- Balance general.
- Balanza de comprobación: mayor, detalle o libro mayor.
- Conteo de documentos contables.
- Detalle tributario de ventas.
- Estado de resultado, comparativo por períodos.
- Flujo de caja.
- Informe consolidado.
- Cartera.
- Detalle de ingresos y egresos.
- Flujo de efectivo.
- Gastos.
- Mejores clientes.
- Minutas de pago.
- Ventas por productos.
- Razones financieras.
- Reporte de ventas.

Todos tienen filtros por período, moneda, tasa, centro de costo, sucursal, cliente, vendedor y clasificación.

### 3.6 Activos fijos y presupuesto

| Pantalla | AG | Qué hace |
|---|---|---|
| Activos fijos | `activos_fijos` | Activo con tipo general, específico y más específico, precio y meses a depreciar o ya depreciados. Lleva cuentas de activo, gasto y depreciación, sucursal, centro de costo, marca, categoría, área y series. Se importa por XLS. |
| Área, categoría y marca de activos | `area_activos`, `categoria_activos`, `marca_activos` | Catálogos de activos. |
| Tabla de depreciación | `tabla_depreciacions` | Tasas oficiales por tipo de activo, anuales y mensuales. |
| Informe de depreciación | `informe_depreciacions` | Comprobantes de depreciación por período. |
| Presupuesto | `presupuestos` | Presupuesto anual por centro de costo, importado por XLS. |
| Presupuesto comparativo | `informe_comparativo_de_presupuestos` | Presupuesto contra lo real. |

### 3.7 Administración y configuración

| Pantalla | AG | Qué hace |
|---|---|---|
| Usuarios | `admin_users` | Accesos y valores por defecto de cada usuario (ver §2.13). |
| Roles | `roles` | Matriz RECURSO × ACCIÓN, con más de 200 recursos. |
| Empleados, área y cargo | `empleados`, `area_empleados`, `categoria_empleados` | Vendedores y personal. El cargo marca si es de ventas. |
| Comisiones | `comision_por_utilidades` | % de comisión por tramo de utilidad y por centro de costo. |
| Configuración del sistema | `configuracion_sistemas` | 25 interruptores. Algunos ejemplos: doble aprobación de traslados, permitir preventa, validar existencia y crear entrega por factura. |
| Campos especiales | `campo_especiales` | Campos extra por formulario. |
| Plantillas | `plantillas` | Formato de impresión de cada documento, en plantilla ODT por sucursal. |
| Catálogo POS | `catalogo_punto_de_ventas` | Botones del POS. |
| Código de barras | `codigo_barras` | Estructura del código de barras de peso o precio. |
| Descuentos | `descuentos` | Tramos de descuento máximo. |
| Catálogo UUID | `catalogo_uuids` | Identificadores adicionales de producto. |
| Configuración de informes | `configuracion_informes` | Fecha límite por informe. |
| Almacenamiento | `almacenamientos` | Espacio usado por documentos e imágenes. |
| Respaldo | `respaldos` | Respaldos de la base de datos. |
| Bitácora | `log_transaccionals` | 649,516 acciones registradas. |
| Empresa | `empresas` | Nombre, actividad, RUC, cédula, contacto y dirección. |
| Billetes y monedas | `catalogo_monedas_billetes` | Denominaciones para el cierre de caja. |
| Otros cargos | `catalogo_de_otros_cargos` | Cargos automáticos (flete, etc.) con su cuenta, IVA y tipo de cálculo. |
| Acciones por cliente | `catalogo_de_acciones_por_clientes` | Seguimientos de cobranza. |

Los roles también listan funciones móviles: rutas, seguimientos, dispositivos y preventa. AG Negocio tiene una app móvil para vendedores.

### 3.8 Dashboard

Muestra ventas, valor del inventario y total en bancos en C$ y en US$. También las mejores facturas de los últimos 3 meses, los productos más vendidos, los mejores clientes y la comparativa del mes.

## 4. Lo que queda fuera (decidido por el usuario el 2026-10-20)

- El bloque académico: carrera, turno, becas, pensum, títulos, matrícula, consolidado de becas y factura masiva por categoría ("Deja fuera el bloque académico").
- No se pierde nada propio de Materiales J Castillo.

## 5. Mapeo a Nexo

Se respeta la decisión del 2026-10-20: **una sola app ERP**, más las apps **Productos** y **Listas de precios**. Todo va con login único, permisos v3.0, RPC `security definer` y tablas de hechos particionadas.

| Grupo de AG Negocio | Dónde vive en Nexo |
|---|---|
| Productos, categorías, tipos, clases, marcas, características y unidades | App `productos` (ya existe en local; su esquema ya se parece al de AG) |
| Escalas de precio, multiprecios y usuarios por escala | App `precios` |
| Cuentas por Cobrar, Cuentas por Pagar, Inventario, Contabilidad, Bancos, Retenciones, Informes y Activos fijos | App `erp`, con un grupo de menú por cada grupo de AG |
| Presupuesto (y presupuesto comparativo) | App `presupuesto`, aparte, en el proyecto de Vercel `nexo-crm` (decisión del 2026-10-20, [plan 19](19-presupuesto.md)). Propuesta pendiente de confirmar. El ERP pone lo real |
| Usuarios y roles | Nexo `core` (login único y roles por empresa) |
| Empleados y vendedores | `core` / RRHH (un solo expediente) |
| Bitácora | `core.fn_auditar` |
| Empresa y sucursales | `core.companies` / `core.sucursales` |

### 5.1 Productos y Listas de precios alimentan al ERP

Regla del usuario (2026-10-20): "Recuerda que productos y precios son 2 apps aparte que tiene que enviarle la información a la copia de Ag negocio". Antes, el 2026-10-19: "ahí se crean y cargan los productos, precios es donde se maneja toda la lista de precios que va a manejar el sistema".

En AG Negocio el producto y sus precios viven dentro de Inventario. En Nexo se separan, y el ERP **no crea ni edita productos ni precios: los recibe**.

| Dato del formulario de producto de AG | Dueño en Nexo | Cómo lo usa el ERP |
|---|---|---|
| Código, nombre, descripción, código de barras, código SAC, unidad, marca, clase, tipo, categoría, características, proveedor habitual, peso, notas | **Productos** | Lo lee en vivo de `productos.*`, sin copiarlo. Las líneas de los documentos guardan `producto_id` con FK a `productos.productos`, y también el código y el nombre del momento, para que el documento no cambie si después se edita el producto. |
| Es servicio, inventariable, descontinuado para ventas o compras, exento de IVA en ventas o compras | **Productos** | El ERP no deja vender lo descontinuado para ventas ni comprar lo descontinuado para compras. Un servicio o un producto no inventariable no mueve kardex. |
| Cuentas de ingresos, inventario y costo, y centro de costo del producto | **Productos** elige; el **ERP** es dueño del catálogo | El asiento automático usa esas cuentas. Ver el catálogo compartido abajo. |
| Existencia mínima y máxima | **Productos** | Alertas de reposición y sugerencia de compra en el ERP. |
| Costo, margen, precio de venta, precio mínimo, precios por sucursal o por escala, escalas por usuario, descuento máximo y automático, comisión | **Listas de precios** | Al cotizar, facturar o vender en el POS, el ERP toma el precio publicado según la escala que el usuario tiene permitida y lo **guarda en la línea**, como foto del momento. Vender por debajo del precio mínimo o del costo exige el permiso especial del ERP (equivale a "PRECIOS POR DEBAJO DEL COSTO" y "EDITAR PRECIO VENTA" en AG) y queda en la bitácora. |
| Costo promedio ponderado y existencias por bodega | **ERP** (kardex) | Lo calcula el inventario del ERP, y Listas de precios y Productos lo **leen**, sin editarlo, para mostrar márgenes y existencias. El costo de referencia de Productos queda solo como dato inicial. |

**Catálogos que eran de Productos y pasan al ERP**, como en AG:
- El catálogo de cuentas pertenece a Contabilidad.
- Los centros de costo pertenecen a Contabilidad.
- Los proveedores pertenecen a Cuentas por pagar.

Hoy `productos.cuentas_contables`, `productos.centros_costo` y `productos.proveedores` existen y están vacías. En R2 (cuentas y centros de costo) y en R5 (proveedores):
- Productos dejará de tener tablas propias y elegirá de los catálogos del ERP.
- Las FK de `productos.productos` pasarán a apuntar al ERP.
- El permiso `productos.configuracion.contable.gestionar` se retira a favor de los del ERP.

**Cómo se "envía" la información.** Es la misma base de datos con esquemas distintos, así que no hay sincronización ni copias que se puedan desfasar:
- Las RPC del ERP (`security definer`) leen `productos.*` y las listas publicadas de `precios.*`.
- Productos y Precios leen del ERP solo lo que les toca: costo promedio, existencias y catálogos de cuentas.
- Cada lectura hace cumplir los permisos de la app que muestra el dato. Por ejemplo, el costo solo se ve con `productos.catalogo.costo.ver`, `precios.listas.costo.ver` o el permiso de costo del ERP.

**Faltantes en Productos frente al formulario de AG**, para la etapa R3:
- Publicar en web.
- Permitir editar la descripción en la factura.
- Garantía (catálogo de garantías de Cuentas por cobrar).
- UUID.

**Orden.** Productos ya existe. Listas de precios se construye en R3, antes de que las ventas (R4) la necesiten.

## 6. Etapas

| Etapa | Contenido | Depende de |
|---|---|---|
| R0 | Borrar el CRM actual (alcance a confirmar, §8) con respaldo en una rama local | — |
| R1 | Base: empresa, sucursales, series y consecutivos DGI, monedas y tasas diarias, tipos de pago, billetes, centros de costo, mes contable, campos especiales, configuración, bitácora | R0 |
| R2 | Contabilidad núcleo: catálogo de cuentas, comprobantes (asientos), concepto breve y renglón IVA, períodos, cierre fiscal, balanza, auxiliares, balance y estado de resultados | R1 |
| R3 | Productos y precios (alinear la app existente) e Inventario: bodegas, ubicaciones, kardex a costo promedio, ajustes, transferencias, levantamiento, toma, fórmulas, fábrica, recetas e informes | R2 |
| R4 | Ventas y CxC: clientes, cotizaciones, factura (normal, rápida, POS y recurrente), despacho, devoluciones, notas, recibos, minutas, cierre de caja, financiamiento, garantía e informes CxC | R3 |
| R5 | Compras y CxP: proveedores, solicitud → cotización → orden → factura (productos y servicios), importaciones, devoluciones e informes CxP | R3 |
| R6 | Bancos y fiscal: bancos, cuentas, cheques, conciliación, retenciones DGI y alcaldía, informes VET e impuestos | R4, R5 |
| R7 | Informes gerenciales (17) y dashboard | R4–R6 |
| R8 | Activos fijos. El presupuesto por centro de costo va en la app Presupuesto ([plan 19](19-presupuesto.md), fase 2) | R2 |
| R9 | Migración de datos desde AG (Excel y respaldo), operación en paralelo y corte | R1–R8 |

Cada etapa sigue el mismo orden:
1. Paso Cero.
2. Esquema con pruebas en transacción revertida.
3. Pantallas.
4. Revisión.
5. Prueba en el navegador.

## 7. Migración de datos

- AG exporta a Excel: clientes, proveedores, productos (datos, multiprecios y escalas), catálogo de cuentas, tasas, saldos iniciales, movimientos, activos, presupuesto y cada lista de documentos. Cada descarga se pide al usuario.
- AG tiene la acción "EXPORTAR BASE DE DATOS" y el módulo de Respaldo. Hay que pedirle a AG Software un respaldo completo para no perder historia: 97 mil facturas, 139 mil movimientos y 46 meses contables.

## 8. Decisiones

Ya tomadas (2026-10-20):
1. **R0, qué se borró del CRM:** el código de `apps/crm` (respaldado en una rama local), la app del Launcher y los esquemas `crm` y `metas` con sus permisos en nexo-core. Se hizo en `20261020143821`. Ver el [status-log](../status-log/2026-10-20-retiro-crm-replica-ag-negocio.md).
2. **Bloque académico:** queda fuera (§4).
3. **Proyecto de Vercel `nexo-crm`:** lo reutiliza la app Presupuesto, que es aparte del ERP ([plan 19](19-presupuesto.md)). El usuario lo pidió así: "Quiero aplicar presupuesto como una app aparte pero que viva en el despliegue de CRM para no crear una nueva".

Pendientes del usuario:
1. **Respaldo completo de AG:** pedirlo a AG Software, o migrar con los Excel que exporta cada pantalla.
2. **Quitar `crm` de "Exposed schemas"** en Supabase, para poder borrar el esquema vacío.
3. **Datos de la resolución DGI:** número, fecha, series y rangos por sucursal.

## 9. Paso Cero de R1 (base) y R2 (contabilidad) — PROPUESTA, sin aplicar

Estado: **esperando aprobación del usuario**. SQL en
[`supabase/migrations/20261021090000_erp_r1_r2_paso_cero.sql`](../../supabase/migrations/20261021090000_erp_r1_r2_paso_cero.sql).
Se ensayó completo en una transacción revertida el 2026-10-20: dio 92 permisos `erp` y las plantillas exactas de abajo. El remoto quedó igual: 52 permisos.

**Verificación remota previa:**
- La app `erp` está inactiva y tiene 52 permisos y 9 plantillas.
- Ningún usuario ni rol de empresa tiene permisos `erp.*`.

**Criterio:** la matriz recurso × acción de los roles de AG Negocio en 4 segmentos `erp.<dominio>.<recurso>.<acción>`. Las acciones de AG se traducen así:
- "Lista" pasa a `ver`, "Crear" a `crear` y "Actualizar" a `editar`.
- "Anular", "Des-anular", "Reimprimir" y "Exportar XLS/PDF" pasan a `anular`, `desanular`, `imprimir` y `exportar`.
- "Eliminar" pasa a `desactivar`: en Nexo un documento o catálogo con uso no se borra.

### R1 — `erp.configuracion` (25 códigos)

| Recurso (pantalla de AG) | Acciones |
|---|---|
| `empresa` (Empresa) | ver, editar |
| `sucursal` (Sucursal/Sedes: datos contables. La sucursal se crea en Nexo con `nexo.administracion.sucursales.gestionar`) | ver, editar |
| `serie` (Consecutivo de serie, numeración DGI) | ver, crear, editar, desactivar |
| `tasa_cambio` (Tasas de cambio) | ver, crear, editar, importar |
| `tipo_pago` (Tipo de pago) | ver, crear, editar, desactivar |
| `denominacion` (Billetes y monedas) | ver, gestionar |
| `campo_especial` (Campos especiales) | ver, gestionar |
| `sistema` (Configuración de sistema) | ver, editar |
| `plantilla` (Plantillas de impresión) | ver, gestionar |
| `bitacora` (Log de acciones por usuario) | ver |

### R2 — `erp.contabilidad` (25 códigos)

| Recurso (pantalla de AG) | Acciones |
|---|---|
| `cuenta` (Catálogo contable) | ver, crear, editar, desactivar, importar, exportar |
| `centro_costo` (Centro de costo) | ver, crear, editar, desactivar |
| `concepto` (Concepto breve y renglón IVA) | ver, gestionar |
| `comprobante` (Comprobantes de diario) | ver, crear, editar, anular, desanular, imprimir, exportar |
| `periodo` (Mes contable) | ver, cerrar (cerrar y reabrir) |
| `cierre_fiscal` (Cierre fiscal) | ver, ejecutar |
| `informe` (Balanza, auxiliares, balance, resultados, flujo, gastos y razones) | ver, exportar |

Los comprobantes de pago con cheque o transferencia y las retenciones van en R6 (bancos y fiscal), con sus propios códigos.

### Códigos del plan 17 que se retiran (nadie los usa)

- `erp.contabilidad.asiento.{ver, registrar, aprobar, anular}`
- `erp.contabilidad.catalogo.{ver, gestionar}`
- `erp.contabilidad.integracion.gestionar`
- `erp.contabilidad.periodo.cerrar` (se vuelve a crear igual en la matriz nueva)
- `erp.contabilidad.reporte.ver`
- `erp.ventas.serie.gestionar`

En total se retiran 10 y se agregan 50, así que el ERP queda con 92 códigos.

### Plantillas (solo cambian en lo de R1 y R2)

| Plantilla | Qué recibe de R1 y R2 | Total erp |
|---|---|---|
| Administrador | Los 50 códigos | 92 |
| Contador | Todo `contabilidad`. Lectura de toda la configuración, y tasas de cambio completas (ver, crear, editar, importar) | 54 |
| Auxiliar contable | Ver cuentas, centros de costo, conceptos, períodos, cierres e informes. Comprobantes: ver, crear, editar, imprimir, exportar. Tasas: ver y crear. Series y tipos de pago: ver | 26 |
| Gerente financiero | Todo lo `ver` de los dos dominios, más exportar cuentas, comprobantes e informes | 38 |
| Cajero | Tasas, tipos de pago, centros de costo, y billetes y monedas (ver) | 14 |
| Supervisor de ventas, Comprador, Bodeguero, Jefe de bodega | Tasas, tipos de pago y centros de costo (ver) | 21, 14, 13, 18 |

**Separación de funciones:**
- Des-anular comprobantes y ejecutar el cierre fiscal solo lo tienen Contador y Administrador. El poscheque de la migración lo comprueba.
- La RPC impedirá además des-anular lo propio y editar un comprobante en un mes cerrado o ya impreso.

**Lo que no hace este Paso Cero:**
- No crea tablas, no activa la app `erp` y no asigna roles a usuarios.
- Tablas y pantallas vienen después de aprobarlo.
