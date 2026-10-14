begin;

do $$
begin
  if exists (select 1 from core.apps where slug = 'agencia')
     or exists (select 1 from core.permissions_catalog where module_slug = 'agencia')
     or exists (select 1 from core.app_roles where module_slug = 'agencia') then
    raise exception 'El estado de Agencia cambió; volver a inspeccionar antes de registrar.';
  end if;
end;
$$;

insert into core.apps
  (slug, name, category, icon, color, route, depends, active)
values
  ('agencia', 'Agencia digital', 'Servicios', 'sun',
   'indigo', '/agencia', '{}', false);

do $$
begin
  if not exists (
    select 1 from core.permissions_catalog
    where code = 'agencia.ver_modulo' and module_slug = 'agencia'
  ) then
    raise exception 'No se generó el permiso de visibilidad; revisar el trigger.';
  end if;
end;
$$;

insert into core.permissions_catalog
  (code, module_slug, domain, label, description)
values
  ('agencia.dashboard.resumen.ver', 'agencia', 'dashboard',
   'Ver Dashboard de agencia',
   'Consultar agentes, tickets y progreso de la vista de solo lectura.');

insert into core.app_roles
  (module_slug, role_key, label, description)
values
  ('agencia', 'consulta', 'Consulta de Agencia digital',
   'Acceso al módulo y lectura del Dashboard; sin acciones de escritura.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = r.module_slug
where r.module_slug = 'agencia'
  and r.role_key = 'consulta'
  and p.code in ('agencia.ver_modulo', 'agencia.dashboard.resumen.ver');

commit;
