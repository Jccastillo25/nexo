-- Paso Cero de la app Presupuesto (docs/plan/19-presupuesto.md §4).
--
-- Aprobado por el usuario el 2026-10-20 ("Si aplícalo").
--
-- Pedido del usuario (2026-10-20): "Quiero aplicar presupuesto como una app
-- aparte pero que viva en el despliegue de CRM para no crear una nueva".
-- Recupera Metas de ventas y Presupuesto anual (plan 15), que se borraron con
-- el CRM en 20261020143821, como app propia del Launcher. Los significados son
-- los de la matriz crm.* aprobada el 2026-10-18. Cambian el prefijo y el
-- dominio del presupuesto anual, que pasa a `ventas` para dejar `contable`
-- libre al presupuesto por centro de costo de AG Negocio (fase 2, con su
-- propio Paso Cero cuando el ERP tenga cuentas y centros de costo).
--
-- Solo catálogo y plantillas: no crea tablas, deja la app inactiva y no asigna
-- nada a usuarios ni a roles de empresa.
--
-- Resultado esperado: 9 permisos presupuesto (ver_modulo + 8) y plantillas
-- vendedor 3, gerente 7, administrador 9.

-- 0. Prechequeo: nada de Presupuesto registrado todavía.
do $$
begin
  if exists (select 1 from core.apps where slug = 'presupuesto')
     or exists (select 1 from core.permissions_catalog where module_slug = 'presupuesto' or code like 'presupuesto.%')
     or exists (select 1 from core.app_roles where module_slug = 'presupuesto') then
    raise exception 'Prechequeo: Presupuesto ya está registrado';
  end if;
  if exists (select 1 from information_schema.schemata where schema_name = 'presupuesto') then
    raise exception 'Prechequeo: ya existe el schema presupuesto';
  end if;
end $$;

-- 1. App, inactiva hasta que se despliegue. El trigger trg_seed_module_permission
--    crea presupuesto.ver_modulo.
insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('presupuesto', 'Presupuesto', 'Ventas', 'target', 'rosa', '/presupuesto', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'presupuesto.ver_modulo') then
    raise exception 'El trigger no creó presupuesto.ver_modulo';
  end if;
end $$;

-- 2. Permisos (4 segmentos).
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('presupuesto.metas.avance_propio.ver',             'presupuesto', 'metas',         'Ver mi avance',               'Ver la meta mensual propia, el avance y el historial.'),
  ('presupuesto.metas.avance_equipo.ver',             'presupuesto', 'metas',         'Ver avance del equipo',       'Ver el avance de todos los vendedores, el ranking y el total contra el presupuesto.'),
  ('presupuesto.metas.meta_vendedor.gestionar',       'presupuesto', 'metas',         'Gestionar metas',             'Generar la meta sugerida por vendedor y mes y ajustarla.'),
  ('presupuesto.ventas.presupuesto_anual.gestionar',  'presupuesto', 'ventas',        'Gestionar presupuesto anual', 'Definir la venta base, el crecimiento y el reparto mensual del año.'),
  ('presupuesto.ventas.factura_propia.ver',           'presupuesto', 'ventas',        'Ver mis facturas',            'Ver las facturas propias importadas de AG Negocio.'),
  ('presupuesto.ventas.factura.ver',                  'presupuesto', 'ventas',        'Ver todas las facturas',      'Ver las facturas de todos los vendedores.'),
  ('presupuesto.ventas.factura.importar',             'presupuesto', 'ventas',        'Importar facturas',           'Subir el Excel de facturas de AG Negocio sin duplicar.'),
  ('presupuesto.configuracion.vendedor.gestionar',    'presupuesto', 'configuracion', 'Gestionar vendedores',        'Vincular los códigos de vendedor de AG Negocio con usuarios de Nexo.');

-- 3. Plantillas.
insert into core.app_roles (module_slug, role_key, label, description) values
  ('presupuesto', 'vendedor',      'Vendedor',                 'Ve solo su meta, su avance y sus facturas.'),
  ('presupuesto', 'gerente',       'Gerente de ventas',        'Ve a todo el equipo, importa facturas y ajusta metas.'),
  ('presupuesto', 'administrador', 'Administrador de ventas',  'Toda la app, incluido el presupuesto anual y los vendedores.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'presupuesto'
where r.module_slug = 'presupuesto'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'vendedor' and p.code in (
      'presupuesto.ver_modulo',
      'presupuesto.metas.avance_propio.ver',
      'presupuesto.ventas.factura_propia.ver'))
    or (r.role_key = 'gerente' and p.code not in (
      'presupuesto.ventas.presupuesto_anual.gestionar',
      'presupuesto.configuracion.vendedor.gestionar'))
  );

-- 4. Poscheque.
do $$
declare
  v_permisos int;
  v_vendedor int;
  v_gerente int;
  v_admin int;
begin
  select count(*) into v_permisos from core.permissions_catalog where module_slug = 'presupuesto';
  select count(*) into v_vendedor from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
    where r.module_slug = 'presupuesto' and r.role_key = 'vendedor';
  select count(*) into v_gerente from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
    where r.module_slug = 'presupuesto' and r.role_key = 'gerente';
  select count(*) into v_admin from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
    where r.module_slug = 'presupuesto' and r.role_key = 'administrador';
  if v_permisos <> 9 or v_vendedor <> 3 or v_gerente <> 7 or v_admin <> 9 then
    raise exception 'Poscheque: permisos %, vendedor %, gerente %, administrador % (se esperaban 9, 3, 7, 9)',
      v_permisos, v_vendedor, v_gerente, v_admin;
  end if;
  if exists (select 1 from core.permissions_catalog
             where module_slug = 'presupuesto' and code <> 'presupuesto.ver_modulo'
               and array_length(string_to_array(code, '.'), 1) <> 4) then
    raise exception 'Poscheque: hay códigos que no tienen 4 segmentos';
  end if;
  -- Separación: el vendedor no ve al equipo ni todas las facturas, y solo el
  -- administrador define el presupuesto anual y vincula vendedores.
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'presupuesto' and r.role_key = 'vendedor'
               and rp.permission_code in ('presupuesto.metas.avance_equipo.ver', 'presupuesto.ventas.factura.ver')) then
    raise exception 'Poscheque: el vendedor no debe ver al equipo';
  end if;
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'presupuesto' and r.role_key <> 'administrador'
               and rp.permission_code in ('presupuesto.ventas.presupuesto_anual.gestionar',
                                          'presupuesto.configuracion.vendedor.gestionar')) then
    raise exception 'Poscheque: presupuesto anual y vendedores son solo del administrador';
  end if;
  if exists (select 1 from core.apps where slug = 'presupuesto' and active)
     or exists (select 1 from core.company_apps ca join core.apps a on a.id = ca.app_id where a.slug = 'presupuesto') then
    raise exception 'Poscheque: la app debe quedar inactiva y sin habilitar para la empresa';
  end if;
end $$;
