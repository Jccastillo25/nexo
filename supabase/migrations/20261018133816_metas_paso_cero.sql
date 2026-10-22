-- Paso Cero Metas de ventas (aprobado por el usuario 2026-10-18). Solo catálogo + plantillas; sin tablas.
-- Diseño: docs/plan/15-metas-ventas.md
do $$
begin
  if exists (select 1 from core.apps where slug = 'metas')
     or exists (select 1 from core.permissions_catalog where module_slug = 'metas')
     or exists (select 1 from core.app_roles where module_slug = 'metas') then
    raise exception 'precheck: Metas ya registrado';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('metas', 'Metas de ventas', 'Ventas', 'target', 'rosa', '/metas', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'metas.ver_modulo') then
    raise exception 'el trigger no creó metas.ver_modulo';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('metas.dashboard.propio.ver',             'metas', 'dashboard',     'Ver mi avance',          'Ver la meta mensual propia, el avance y el historial.'),
  ('metas.dashboard.equipo.ver',             'metas', 'dashboard',     'Ver avance del equipo',  'Ver el avance de todos los vendedores, el ranking y el total contra el presupuesto.'),
  ('metas.ventas.mis_facturas.ver',          'metas', 'ventas',        'Ver mis facturas',       'Ver las facturas propias importadas del ERP.'),
  ('metas.ventas.factura.ver',               'metas', 'ventas',        'Ver todas las facturas', 'Ver las facturas de todos los vendedores.'),
  ('metas.ventas.factura.importar',          'metas', 'ventas',        'Importar facturas',      'Subir el reporte de facturas del ERP sin duplicar.'),
  ('metas.presupuesto.empresa.gestionar',    'metas', 'presupuesto',   'Gestionar presupuesto',  'Definir el presupuesto anual y su distribución mensual.'),
  ('metas.presupuesto.vendedor.gestionar',   'metas', 'presupuesto',   'Gestionar metas',        'Generar la meta sugerida por vendedor y mes y ajustarla.'),
  ('metas.configuracion.vendedor.gestionar', 'metas', 'configuracion', 'Gestionar vendedores',   'Vincular códigos de vendedor del ERP con usuarios de Nexo.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('metas', 'vendedor',      'Vendedor',          'Ve solo su meta, su avance y sus facturas.'),
  ('metas', 'gerente',       'Gerente de ventas', 'Ve a todo el equipo, importa facturas y ajusta metas.'),
  ('metas', 'administrador', 'Administrador',     'Todo el módulo.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'metas'
where r.module_slug = 'metas'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'vendedor' and p.code in (
      'metas.ver_modulo', 'metas.dashboard.propio.ver', 'metas.ventas.mis_facturas.ver'))
    or (r.role_key = 'gerente' and p.code not in (
      'metas.presupuesto.empresa.gestionar', 'metas.configuracion.vendedor.gestionar'))
  );
