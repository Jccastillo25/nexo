-- =============================================================================
-- Correccion a f1_4_jornadas_permission_matrix (mismo dia): el comentario
-- de esa migracion asumia que el rol 'admin' de rrhh recibe los permisos
-- nuevos de un dominio existente automaticamente -- FALSO, verificado con
-- una consulta real despues de aplicar: la insercion original de 'admin'
-- (rrhh_permissions_and_roles.sql) es un INSERT ... SELECT de una sola
-- vez contra las filas de permissions_catalog QUE EXISTIAN en ese
-- momento, no una vista/trigger que se mantenga sincronizada. 'admin'
-- quedo sin los 4 codigos de rrhh.asistencia.feriados.* recien creados.
-- Corregido explicitamente aqui -- sin este fix, el propio admin de RRHH
-- quedaria denegado (fail-closed) para gestionar feriados.
-- =============================================================================

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.asistencia.feriados.ver',
  'rrhh.asistencia.feriados.crear',
  'rrhh.asistencia.feriados.editar',
  'rrhh.asistencia.feriados.eliminar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'admin'
on conflict do nothing;
