-- Paso Cero del enrolamiento de terminales de kiosco (app Asistencia).
-- Aprobado por el usuario 2026-10-17: "permisos nuevos kioskos.asignar y
-- kioskos.revocar solo para Administrador de RRHH".
--
-- | Código                           | Administrador de RRHH | Supervisor de Asistencia |
-- |----------------------------------|-----------------------|--------------------------|
-- | rrhh.asistencia.kioskos.ver      | ✓ (ya existe)         | ✓ (ya existe)            |
-- | rrhh.asistencia.kioskos.asignar  | ✓ nuevo               | —                        |
-- | rrhh.asistencia.kioskos.revocar  | ✓ nuevo               | —                        |
--
-- Los roles de app son plantillas del editor de roles (desde 20261014203144);
-- el acceso efectivo lo da el rol de empresa del usuario o ser owner. Sin
-- roles de empresa ni usuarios nuevos.
--
-- Rollback (antes de que exista uso):
--   delete from core.app_role_permissions where permission_code in
--     ('rrhh.asistencia.kioskos.asignar','rrhh.asistencia.kioskos.revocar');
--   delete from core.permissions_catalog where code in
--     ('rrhh.asistencia.kioskos.asignar','rrhh.asistencia.kioskos.revocar');
do $$
declare n integer;
begin
  -- Prechecks
  if exists (select 1 from core.permissions_catalog
             where code in ('rrhh.asistencia.kioskos.asignar','rrhh.asistencia.kioskos.revocar')) then
    raise exception 'precheck: los permisos de enrolamiento ya existen';
  end if;
  if not exists (select 1 from core.app_roles where module_slug = 'rrhh' and role_key = 'admin') then
    raise exception 'precheck: no existe el rol de app admin de rrhh';
  end if;

  insert into core.permissions_catalog (code, module_slug, domain, label, description) values
    ('rrhh.asistencia.kioskos.asignar', 'rrhh', 'asistencia', 'Asignar equipo a terminal',
     'Generar el código de un solo uso que vincula un equipo físico a un dispositivo de marcación.'),
    ('rrhh.asistencia.kioskos.revocar', 'rrhh', 'asistencia', 'Revocar equipo de terminal',
     'Quitar la autorización al equipo vinculado a un dispositivo o cancelar un código pendiente.');

  insert into core.app_role_permissions (app_role_id, permission_code)
  select ar.id, p.code
  from core.app_roles ar
  cross join unnest(array['rrhh.asistencia.kioskos.asignar','rrhh.asistencia.kioskos.revocar']) as p(code)
  where ar.module_slug = 'rrhh' and ar.role_key = 'admin';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'postcheck: se esperaban 2 permisos asignados al admin de rrhh (%).', n; end if;
end;
$$;
