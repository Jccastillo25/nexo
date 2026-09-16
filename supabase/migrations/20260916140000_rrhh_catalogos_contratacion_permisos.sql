-- =============================================================================
-- Paso Cero -- Fase 3 del bloque "pre-F1.5" (docs/status-log/2026-09-16-
-- rrhh-pre-f1-5.md): catalogos de Contratacion (puestos, departamentos
-- organizacionales, plantillas de contrato). Matriz de permisos aprobada
-- por el usuario en la sesion de planificacion previa.
--
-- Verificacion remota (nexo-core, 2026-09-16) antes de este insert: ningun
-- codigo 'rrhh.expedientes.puestos.*'/'departamentos.*'/'plantillas.*'
-- existe todavia en core.permissions_catalog -- confirmado con
-- `select code from core.permissions_catalog where code like 'rrhh.%'`.
--
-- Dominio: 'expedientes' (mismo dominio de permisos que contratos/
-- empleados -- Contratacion y Expediente son secciones de UI distintas
-- pero un mismo dominio de autorizacion, ver docs/PERMISSIONS.md). Roles:
-- admin y gestor_expedientes administran los 3 catalogos; el resto de
-- roles de rrhh (supervisor_asistencia, especialista_planillas, consulta)
-- solo necesitan *.ver para poder elegir puesto/departamento/plantilla al
-- crear un contrato o consultarlo -- se les da acceso de lectura.
-- =============================================================================

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.expedientes.puestos.ver',          'rrhh', 'expedientes', 'Ver puestos',           'Ver el catalogo de puestos.'),
  ('rrhh.expedientes.puestos.crear',        'rrhh', 'expedientes', 'Crear puestos',         'Crear un puesto nuevo.'),
  ('rrhh.expedientes.puestos.editar',       'rrhh', 'expedientes', 'Editar puestos',        'Editar, activar o desactivar un puesto.'),
  ('rrhh.expedientes.departamentos.ver',    'rrhh', 'expedientes', 'Ver departamentos',     'Ver el catalogo de departamentos organizacionales.'),
  ('rrhh.expedientes.departamentos.crear',  'rrhh', 'expedientes', 'Crear departamentos',   'Crear un departamento organizacional nuevo.'),
  ('rrhh.expedientes.departamentos.editar', 'rrhh', 'expedientes', 'Editar departamentos',  'Editar, activar o desactivar un departamento organizacional.'),
  ('rrhh.expedientes.plantillas.ver',       'rrhh', 'expedientes', 'Ver plantillas',        'Ver el catalogo de plantillas de contrato.'),
  ('rrhh.expedientes.plantillas.crear',     'rrhh', 'expedientes', 'Crear plantillas',      'Crear una plantilla de contrato nueva.'),
  ('rrhh.expedientes.plantillas.editar',    'rrhh', 'expedientes', 'Editar plantillas',     'Editar, activar, desactivar o subir el archivo de una plantilla de contrato.')
on conflict (code) do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.puestos.ver',
  'rrhh.expedientes.puestos.crear',
  'rrhh.expedientes.puestos.editar',
  'rrhh.expedientes.departamentos.ver',
  'rrhh.expedientes.departamentos.crear',
  'rrhh.expedientes.departamentos.editar',
  'rrhh.expedientes.plantillas.ver',
  'rrhh.expedientes.plantillas.crear',
  'rrhh.expedientes.plantillas.editar'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key in ('admin', 'gestor_expedientes')
on conflict do nothing;

insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.puestos.ver',
  'rrhh.expedientes.departamentos.ver',
  'rrhh.expedientes.plantillas.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key in ('supervisor_asistencia', 'especialista_planillas', 'consulta')
on conflict do nothing;
