-- Registra Asistencia como app propia del Launcher, separada de RRHH.
-- Decisión del usuario 2026-10-17: "separar RRHH (gestión del personal,
-- contrataciones, planilla) de kiosco y todas sus configuraciones"; aprobada
-- como mosaico propio en /rrhh/asistencia, dentro del mismo código y deploy que
-- apps/rrhh (basePath /rrhh). No necesita un rewrite nuevo: /rrhh/:path* ya va
-- al deploy de RRHH.
--
-- Alcance: solo core.apps y core.company_apps. El trigger
-- trg_seed_module_permission crea asistencia.ver_modulo (visibilidad del
-- mosaico). El contenido de la app sigue usando los permisos que ya existen
-- (rrhh.asistencia.{marcas,kioskos,justificaciones,turnos}.*), que dependen de
-- que el módulo rrhh esté activo. Sin roles nuevos: hoy ningún rol de empresa
-- tiene rrhh.ver_modulo (solo el owner ve RRHH) y Asistencia queda igual hasta
-- que se apruebe la asignación a roles.
--
-- Rollback (sin datos propios que conservar):
--   update core.company_apps set enabled = false
--     where app_id = (select id from core.apps where slug = 'asistencia');
--   update core.apps set active = false where slug = 'asistencia';
do $$
declare n integer;
begin
  -- Prechecks
  if exists (select 1 from core.apps where slug = 'asistencia') then
    raise exception 'precheck: la app asistencia ya existe';
  end if;
  if exists (select 1 from core.permissions_catalog where code like 'asistencia.%') then
    raise exception 'precheck: ya hay permisos con prefijo asistencia.';
  end if;
  if not exists (select 1 from core.apps where slug = 'rrhh' and active) then
    raise exception 'precheck: el módulo rrhh no existe o está inactivo';
  end if;

  insert into core.apps (slug, name, category, icon, color, route, depends, active)
  values ('asistencia', 'Asistencia', 'RRHH', 'clock', 'ambar', '/rrhh/asistencia',
          array['rrhh'], true);

  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'asistencia'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;

  -- Postchecks
  if not exists (select 1 from core.permissions_catalog
                 where code = 'asistencia.ver_modulo' and module_slug = 'asistencia') then
    raise exception 'postcheck: el trigger no creó asistencia.ver_modulo';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'asistencia') <> 1 then
    raise exception 'postcheck: se esperaba un solo permiso del módulo asistencia';
  end if;
end;
$$;
