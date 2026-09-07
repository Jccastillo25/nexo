-- =============================================================================
-- Paso Cero F1.4 -- permisos de jornadas/feriados
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md F1.4; aprobado explicitamente
-- por el usuario, 2026-09-07).
--
-- Verificado contra core.permissions_catalog/core.app_role_permissions
-- reales antes de escribir esta migracion: rrhh.asistencia.turnos.{ver,
-- crear,editar,eliminar} YA EXISTEN (matriz original de RRHH, nunca
-- consumidos por ninguna tabla hasta ahora) -- se reutilizan tal cual
-- para rrhh.jornadas/rrhh.jornada_dias (turno = jornada, mismo recurso
-- conceptual). rrhh.expedientes.contratos.editar (existente) se reutiliza
-- para asignar una jornada a un contrato (rrhh.contrato_jornadas) -- mismo
-- precedente que F1.2 con contrato_compensacion. Sin codigo nuevo para
-- ninguno de los dos.
--
-- Unico codigo nuevo: rrhh.asistencia.feriados.* (no existe ningun
-- recurso "feriados" en el catalogo). Misma asignacion de roles que
-- turnos: admin y supervisor_asistencia el CRUD completo, consulta solo
-- ver. gestor_expedientes/especialista_planillas sin acceso (mismo
-- criterio que turnos hoy).
-- =============================================================================

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.asistencia.feriados.ver',      'rrhh', 'asistencia', 'Ver feriados',      'Ver el calendario de feriados/dias no laborables de la empresa.'),
  ('rrhh.asistencia.feriados.crear',    'rrhh', 'asistencia', 'Crear feriados',    'Registrar un feriado nuevo.'),
  ('rrhh.asistencia.feriados.editar',   'rrhh', 'asistencia', 'Editar feriados',   'Modificar un feriado existente.'),
  ('rrhh.asistencia.feriados.eliminar', 'rrhh', 'asistencia', 'Eliminar feriados', 'Eliminar un feriado.')
on conflict (code) do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.asistencia.feriados.ver',
  'rrhh.asistencia.feriados.crear',
  'rrhh.asistencia.feriados.editar',
  'rrhh.asistencia.feriados.eliminar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'supervisor_asistencia'
on conflict do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, 'rrhh.asistencia.feriados.ver'
from core.app_roles ar
where ar.module_slug = 'rrhh' and ar.role_key = 'consulta'
on conflict do nothing;
