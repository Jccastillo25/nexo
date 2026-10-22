-- =============================================================================
-- Metas de ventas pasa a ser parte del CRM (decisión del usuario 2026-10-18:
-- "Integra Metas y Presupuesto dentro de la app CRM, como un solo módulo de
-- ventas"; matriz aprobada: "Si").
--
--   1. Permisos crm.* de 4 segmentos que reemplazan a los metas.* del Paso
--      Cero 20261018133816 (mismo significado, ver docs/plan/15-metas-ventas.md §3).
--   2. Plantillas del CRM: Vendedor, Gerente de ventas, Administrador de ventas
--      (incluyen los permisos de Clientes que ya existían).
--   3. Las RPC public.metas_* y los helpers metas.* exigen los códigos nuevos:
--      se reescriben a partir de su definición actual reemplazando solo los
--      literales de código entre comillas (sin cambiar ninguna otra línea).
--   4. Se retira la app `metas` del catálogo (permisos, plantillas, company_apps).
--      El schema `metas` y sus tablas/RPC se quedan: son los datos del CRM.
-- Sin datos en metas.* al aplicar (verificado).
-- =============================================================================

do $$
begin
  if not exists (select 1 from core.apps where slug = 'crm') then
    raise exception 'precheck: no existe la app crm';
  end if;
  if exists (select 1 from core.permissions_catalog where code like 'crm.metas.%' or code like 'crm.ventas.%' or code like 'crm.configuracion.%') then
    raise exception 'precheck: los permisos crm de metas ya existen';
  end if;
  if exists (select 1 from core.app_roles where module_slug = 'crm') then
    raise exception 'precheck: el CRM ya tiene plantillas';
  end if;
  if exists (select 1 from core.rol_permisos where permission_code like 'metas.%')
     or exists (select 1 from core.user_permissions where permission_code like 'metas.%') then
    raise exception 'precheck: hay roles o usuarios con permisos metas.* (reasignar antes)';
  end if;
  if exists (select 1 from metas.facturas) or exists (select 1 from metas.vendedores) or exists (select 1 from metas.presupuestos) then
    raise exception 'precheck: metas ya tiene datos';
  end if;
end;
$$;

-- 1. Permisos -------------------------------------------------------------------
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('crm.metas.avance_propio.ver',          'crm', 'metas',         'Ver mi avance',          'Ver la meta mensual propia, el avance y el historial.'),
  ('crm.metas.avance_equipo.ver',          'crm', 'metas',         'Ver avance del equipo',  'Ver el avance de todos los vendedores, el ranking y el total contra el presupuesto.'),
  ('crm.ventas.factura_propia.ver',        'crm', 'ventas',        'Ver mis facturas',       'Ver las facturas propias importadas del ERP.'),
  ('crm.ventas.factura.ver',               'crm', 'ventas',        'Ver todas las facturas', 'Ver las facturas de todos los vendedores.'),
  ('crm.ventas.factura.importar',          'crm', 'ventas',        'Importar facturas',      'Subir el reporte de facturas del ERP sin duplicar.'),
  ('crm.metas.meta_vendedor.gestionar',    'crm', 'metas',         'Gestionar metas',        'Generar la meta sugerida por vendedor y mes y ajustarla.'),
  ('crm.metas.presupuesto.gestionar',      'crm', 'metas',         'Gestionar presupuesto',  'Definir el presupuesto anual y su distribución mensual.'),
  ('crm.configuracion.vendedor.gestionar', 'crm', 'configuracion', 'Gestionar vendedores',   'Vincular códigos de vendedor del ERP con usuarios de Nexo.');

-- 2. Plantillas del CRM ---------------------------------------------------------
insert into core.app_roles (module_slug, role_key, label, description) values
  ('crm', 'vendedor',      'Vendedor',                'Ve clientes, su meta, su avance y sus facturas.'),
  ('crm', 'gerente',       'Gerente de ventas',       'Gestiona clientes, ve al equipo, importa facturas y ajusta metas.'),
  ('crm', 'administrador', 'Administrador de ventas', 'Todo el CRM.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'crm'
where r.module_slug = 'crm'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'vendedor' and p.code in (
      'crm.ver_modulo', 'crm.clientes.ver', 'crm.metas.avance_propio.ver', 'crm.ventas.factura_propia.ver'))
    or (r.role_key = 'gerente' and p.code not in (
      'crm.clientes.eliminar', 'crm.metas.presupuesto.gestionar', 'crm.configuracion.vendedor.gestionar'))
  );

-- 3. Las RPC exigen los códigos nuevos -----------------------------------------
do $$
declare
  mapa text[][] := array[
    ['metas.dashboard.propio.ver',             'crm.metas.avance_propio.ver'],
    ['metas.dashboard.equipo.ver',             'crm.metas.avance_equipo.ver'],
    ['metas.ventas.mis_facturas.ver',          'crm.ventas.factura_propia.ver'],
    ['metas.ventas.factura.ver',               'crm.ventas.factura.ver'],
    ['metas.ventas.factura.importar',          'crm.ventas.factura.importar'],
    ['metas.presupuesto.vendedor.gestionar',   'crm.metas.meta_vendedor.gestionar'],
    ['metas.presupuesto.empresa.gestionar',    'crm.metas.presupuesto.gestionar'],
    ['metas.configuracion.vendedor.gestionar', 'crm.configuracion.vendedor.gestionar']
  ];
  f record;
  def text;
  nueva text;
  i integer;
  n integer := 0;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where p.prokind = 'f' and ((s.nspname = 'public' and p.proname like 'metas\_%') or s.nspname = 'metas')
  loop
    def := pg_get_functiondef(f.oid);
    nueva := def;
    for i in 1 .. array_length(mapa, 1) loop
      nueva := replace(nueva, quote_literal(mapa[i][1]), quote_literal(mapa[i][2]));
    end loop;
    if nueva <> def then
      execute nueva;
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'no se reescribió ninguna función'; end if;

  -- Ninguna función debe seguir exigiendo uno de los 8 códigos viejos (las
  -- acciones de auditoría 'metas.presupuesto.guardar', etc. se quedan).
  if exists (
    with fs as materialized (
      select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where p.prokind = 'f' and ((s.nspname = 'public' and p.proname like 'metas\_%') or s.nspname = 'metas')
    ), defs as materialized (select pg_get_functiondef(fs.oid) as d from fs)
    select 1 from defs, generate_subscripts(mapa, 1) g
    where position(quote_literal(mapa[g][1]) in defs.d) > 0
  ) then
    raise exception 'quedó una función con códigos metas.*';
  end if;
end;
$$;

-- 4. Se retira la app metas del catálogo ---------------------------------------
delete from core.app_role_permissions rp using core.app_roles r
where rp.app_role_id = r.id and r.module_slug = 'metas';
delete from core.app_roles where module_slug = 'metas';
delete from core.permissions_catalog where module_slug = 'metas';
delete from core.apps where slug = 'metas';  -- company_apps cae por cascada

do $$
begin
  if exists (select 1 from core.apps where slug = 'metas')
     or exists (select 1 from core.permissions_catalog where module_slug = 'metas') then
    raise exception 'postcheck: quedó la app metas';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'crm') <> 13 then
    raise exception 'postcheck: el CRM debe tener 13 permisos';
  end if;
end;
$$;
