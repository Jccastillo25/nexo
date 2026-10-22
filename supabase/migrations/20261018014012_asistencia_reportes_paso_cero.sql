-- Paso Cero: reportes de Asistencia. Aprobado por el usuario el 2026-10-18
-- ("Ok" a la matriz y a las decisiones recomendadas).
--
-- | Código                              | Admin RRHH | Supervisor Asistencia | Especialista Planillas | Consulta General |
-- |-------------------------------------|------------|-----------------------|------------------------|------------------|
-- | rrhh.asistencia.reportes.ver        | ✓          | ✓                     | ✓                      | ✓                |
-- | rrhh.asistencia.reportes.exportar   | ✓          | ✓                     | ✓                      | —                |
--
-- Los roles de app son plantillas del editor de roles (desde 20261014203144).
-- El acceso efectivo lo da el rol de empresa (core.rol_permisos) o ser owner.
-- Verificado en remoto el 2026-10-18: los roles de empresa existentes no
-- tienen permisos de RRHH, así que esta migración no les asigna nada; se
-- asignan desde Configuración → Roles cuando el usuario lo decida.
-- `marcas.ver` y `reportes.ver` son independientes. `reportes.ver` permite ver
-- horarios y tolerancias de la jornada dentro del reporte.
--
-- Rollback (antes de uso):
--   delete from core.app_role_permissions where permission_code in
--     ('rrhh.asistencia.reportes.ver','rrhh.asistencia.reportes.exportar');
--   delete from core.permissions_catalog where code in
--     ('rrhh.asistencia.reportes.ver','rrhh.asistencia.reportes.exportar');
do $$
declare n integer;
begin
  if exists (select 1 from core.permissions_catalog
             where code in ('rrhh.asistencia.reportes.ver','rrhh.asistencia.reportes.exportar')) then
    raise exception 'precheck: los permisos de reportes de asistencia ya existen';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'rrhh'
        and role_key in ('admin','supervisor_asistencia','especialista_planillas','consulta')) <> 4 then
    raise exception 'precheck: faltan roles de app de rrhh';
  end if;

  insert into core.permissions_catalog (code, module_slug, domain, label, description) values
    ('rrhh.asistencia.reportes.ver', 'rrhh', 'asistencia', 'Ver reportes de asistencia',
     'Consultar en pantalla asistencia diaria, resumen por persona, tardanzas y salidas tempranas, incidencias de marcación y tarjeta individual. Incluye ver horarios y tolerancias de la jornada dentro del reporte.'),
    ('rrhh.asistencia.reportes.exportar', 'rrhh', 'asistencia', 'Exportar reportes de asistencia',
     'Descargar en PDF o abrir la vista de impresión de los reportes de asistencia. Cada exportación queda auditada.');

  insert into core.app_role_permissions (app_role_id, permission_code)
  select ar.id, x.code
  from core.app_roles ar
  join (values
    ('admin',                  'rrhh.asistencia.reportes.ver'),
    ('admin',                  'rrhh.asistencia.reportes.exportar'),
    ('supervisor_asistencia',  'rrhh.asistencia.reportes.ver'),
    ('supervisor_asistencia',  'rrhh.asistencia.reportes.exportar'),
    ('especialista_planillas', 'rrhh.asistencia.reportes.ver'),
    ('especialista_planillas', 'rrhh.asistencia.reportes.exportar'),
    ('consulta',               'rrhh.asistencia.reportes.ver')
  ) as x(role_key, code) on x.role_key = ar.role_key
  where ar.module_slug = 'rrhh';
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'postcheck: se esperaban 7 asignaciones a plantillas (%).', n; end if;
end;
$$;
