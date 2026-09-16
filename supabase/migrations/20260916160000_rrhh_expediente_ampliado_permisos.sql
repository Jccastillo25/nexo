-- =============================================================================
-- Paso Cero -- Fase 5 del bloque "pre-F1.5" (docs/status-log/2026-09-16-
-- rrhh-pre-f1-5.md): expediente ampliado (Direccion, Informacion
-- complementaria, Cuentas bancarias, Beneficiario). Matriz de permisos
-- aprobada por el usuario en la sesion de planificacion previa.
--
-- Verificacion remota (nexo-core, 2026-09-16) antes de este insert: ningun
-- codigo 'rrhh.expedientes.direccion.*'/'info_complementaria.*'/
-- 'cuentas_bancarias.*'/'beneficiarios.*' existe todavia; 'documentos.ver/
-- subir/eliminar' SI existen (2026-09-02, huerfanos hasta Fase 4/5) -- no
-- se re-crean, solo se agrega 'documentos.descargar' (el set original no
-- distinguia "ver metadata" de "obtener el archivo").
--
-- Sensibilidad: Direccion/Informacion complementaria NO son tan sensibles
-- como Compensacion -- visibles tambien para 'consulta' (mismo criterio
-- que Puestos/Departamentos/Plantillas en la Fase 3 de este bloque).
-- Cuentas bancarias/Beneficiario SI son datos sensibles -- restringidos a
-- 'admin' unicamente, mismo criterio que 'rrhh.expedientes.compensacion.*'
-- ya vigente desde F1.0.
-- =============================================================================

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.expedientes.direccion.ver',             'rrhh', 'expedientes', 'Ver dirección',                 'Ver la dirección del empleado.'),
  ('rrhh.expedientes.direccion.editar',           'rrhh', 'expedientes', 'Editar dirección',              'Editar la dirección del empleado.'),
  ('rrhh.expedientes.info_complementaria.ver',    'rrhh', 'expedientes', 'Ver información complementaria', 'Ver información complementaria del empleado (estado civil, contacto de emergencia).'),
  ('rrhh.expedientes.info_complementaria.editar', 'rrhh', 'expedientes', 'Editar información complementaria', 'Editar información complementaria del empleado.'),
  ('rrhh.expedientes.cuentas_bancarias.ver',      'rrhh', 'expedientes', 'Ver cuentas bancarias',         'Ver cuentas bancarias del empleado. Dato sensible.'),
  ('rrhh.expedientes.cuentas_bancarias.editar',   'rrhh', 'expedientes', 'Editar cuentas bancarias',      'Crear, editar o desactivar cuentas bancarias del empleado. Dato sensible.'),
  ('rrhh.expedientes.beneficiarios.ver',          'rrhh', 'expedientes', 'Ver beneficiarios',             'Ver beneficiarios del empleado. Dato sensible.'),
  ('rrhh.expedientes.beneficiarios.editar',       'rrhh', 'expedientes', 'Editar beneficiarios',          'Crear, editar o desactivar beneficiarios del empleado. Dato sensible.'),
  ('rrhh.expedientes.documentos.descargar',       'rrhh', 'expedientes', 'Descargar documentos',          'Obtener una URL firmada de descarga de un documento del legajo.')
on conflict (code) do nothing;

-- direccion/info_complementaria: admin + gestor_expedientes administran,
-- resto de roles (supervisor_asistencia, especialista_planillas, consulta)
-- solo ven -- mismo patron que puestos/departamentos/plantillas (Fase 3).
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.direccion.ver',
  'rrhh.expedientes.direccion.editar',
  'rrhh.expedientes.info_complementaria.ver',
  'rrhh.expedientes.info_complementaria.editar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key in ('admin', 'gestor_expedientes')
on conflict do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.direccion.ver',
  'rrhh.expedientes.info_complementaria.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key in ('supervisor_asistencia', 'especialista_planillas', 'consulta')
on conflict do nothing;

-- cuentas_bancarias/beneficiarios: solo admin (dato sensible, mismo
-- criterio que rrhh.expedientes.compensacion.*).
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.cuentas_bancarias.ver',
  'rrhh.expedientes.cuentas_bancarias.editar',
  'rrhh.expedientes.beneficiarios.ver',
  'rrhh.expedientes.beneficiarios.editar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'admin'
on conflict do nothing;

-- documentos.descargar: mismos roles que ya tienen documentos.ver
-- (admin, gestor_expedientes, consulta) -- ver 20260902000005.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, 'rrhh.expedientes.documentos.descargar'
from core.app_roles ar
where ar.module_slug = 'rrhh' and ar.role_key in ('admin', 'gestor_expedientes', 'consulta')
on conflict do nothing;
