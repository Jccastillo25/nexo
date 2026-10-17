-- Paso Cero Productos (aprobado por el usuario 2026-10-16). Solo catálogo + plantillas; sin tablas.
-- Diseño: docs/plan/14-productos.md
do $$
begin
  if exists (select 1 from core.apps where slug = 'productos')
     or exists (select 1 from core.permissions_catalog where module_slug = 'productos')
     or exists (select 1 from core.app_roles where module_slug = 'productos') then
    raise exception 'precheck: Productos ya registrado';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('productos', 'Productos', 'Cadena de suministro', 'package', 'purple', '/productos', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'productos.ver_modulo') then
    raise exception 'el trigger no creó productos.ver_modulo';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('productos.dashboard.resumen.ver',                  'productos', 'dashboard',     'Ver dashboard',              'Ver los indicadores del catálogo de productos.'),
  ('productos.catalogo.producto.ver',                  'productos', 'catalogo',      'Ver productos',              'Ver el listado y la ficha de los productos.'),
  ('productos.catalogo.producto.crear',                'productos', 'catalogo',      'Crear productos',            'Dar de alta productos y servicios nuevos.'),
  ('productos.catalogo.producto.editar',               'productos', 'catalogo',      'Editar productos',           'Modificar datos generales, clasificación, unidad, características y parámetros de inventario.'),
  ('productos.catalogo.producto.descontinuar',         'productos', 'catalogo',      'Descontinuar productos',     'Descontinuar y reactivar productos para ventas o compras (no se borran).'),
  ('productos.catalogo.producto.importar',             'productos', 'catalogo',      'Importar productos',         'Crear o actualizar productos desde la plantilla del ERP.'),
  ('productos.catalogo.producto.exportar',             'productos', 'catalogo',      'Exportar productos',         'Descargar el catálogo en el formato del ERP.'),
  ('productos.catalogo.costo.ver',                     'productos', 'catalogo',      'Ver costo',                  'Ver el costo de referencia de los productos.'),
  ('productos.catalogo.costo.editar',                  'productos', 'catalogo',      'Editar costo',               'Modificar el costo de referencia y su moneda.'),
  ('productos.catalogo.fiscal.editar',                 'productos', 'catalogo',      'Editar datos fiscales',      'Modificar exenciones, cuentas contables, código SAC y centro de costo.'),
  ('productos.configuracion.clasificacion.gestionar',  'productos', 'configuracion', 'Gestionar clasificación',    'Crear, editar y desactivar clases, tipos y categorías.'),
  ('productos.configuracion.marca.gestionar',          'productos', 'configuracion', 'Gestionar marcas',           'Crear, editar y desactivar marcas y sus clases permitidas.'),
  ('productos.configuracion.unidad.gestionar',         'productos', 'configuracion', 'Gestionar unidades',         'Crear, editar y desactivar unidades de medida.'),
  ('productos.configuracion.proveedor.gestionar',      'productos', 'configuracion', 'Gestionar proveedores',      'Crear, editar y desactivar proveedores.'),
  ('productos.configuracion.caracteristica.gestionar', 'productos', 'configuracion', 'Gestionar características',  'Crear, editar y desactivar características de producto.'),
  ('productos.configuracion.contable.gestionar',       'productos', 'configuracion', 'Gestionar cuentas contables','Crear, editar y desactivar cuentas contables y centros de costo.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('productos', 'consulta',      'Consulta',                  'Ve el catálogo sin costos.'),
  ('productos', 'editor',        'Editor de catálogo',        'Crea y edita productos; ve costos.'),
  ('productos', 'contabilidad',  'Contabilidad',              'Costos, datos fiscales y cuentas contables.'),
  ('productos', 'administrador', 'Administrador de catálogo', 'Todo el módulo.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'productos'
where r.module_slug = 'productos'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'consulta' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver'))
    or (r.role_key = 'editor' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver',
      'productos.catalogo.producto.crear', 'productos.catalogo.producto.editar',
      'productos.catalogo.producto.exportar', 'productos.catalogo.costo.ver'))
    or (r.role_key = 'contabilidad' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver',
      'productos.catalogo.producto.exportar', 'productos.catalogo.costo.ver', 'productos.catalogo.costo.editar',
      'productos.catalogo.fiscal.editar', 'productos.configuracion.contable.gestionar'))
  );
