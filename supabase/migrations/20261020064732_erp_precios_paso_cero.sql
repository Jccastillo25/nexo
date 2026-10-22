-- =============================================================================
-- Paso Cero: Listas de precios (app `precios`) + ERP (app `erp`).
-- Aprobado por el usuario el 2026-10-20 ("Sí, aplicar"). Diseño en docs/plan/17-erp.md.
-- Las dos apps quedan INACTIVAS. El trigger trg_seed_module_permission crea
-- precios.ver_modulo y erp.ver_modulo. No se crean tablas.
-- =============================================================================

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
declare v_real text; v_esperado text :=
  'erp/administrador=52 erp/auxiliar_contable=15 erp/bodeguero=10 erp/cajero=10 erp/comprador=11 erp/contador=25 '
  'erp/gerente_financiero=21 erp/jefe_bodega=15 erp/supervisor_ventas=18 precios/administrador=11 precios/analista=7 precios/consulta=3';
begin
  if (select count(*) from core.permissions_catalog where module_slug = 'precios') <> 11 then raise exception 'postcheck: catálogo precios'; end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'erp') <> 52 then raise exception 'postcheck: catálogo erp'; end if;
  if exists (select 1 from core.apps where slug in ('precios', 'erp') and active) then raise exception 'postcheck: las apps deben quedar inactivas'; end if;
  select string_agg(r.module_slug || '/' || r.role_key || '=' ||
                    (select count(*) from core.app_role_permissions rp where rp.app_role_id = r.id), ' ' order by r.module_slug, r.role_key)
    into v_real from core.app_roles r where r.module_slug in ('precios', 'erp');
  if v_real is distinct from v_esperado then raise exception 'postcheck: plantillas %', v_real; end if;
end;
$$;
