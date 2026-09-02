-- =============================================================================
-- Nexo — matriz de permisos y roles de app para RRHH (Expedientes,
-- Asistencia, Planillas). Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md
-- §3 (RBAC de 3 capas) y §6 (playbook de app nueva, pasos 2 y 4).
--
-- PENDIENTE DE APROBACION — no aplicado al proyecto remoto todavia. Asume
-- que core.apps.rrhh ya existe (verificado en remoto, 2026-09-02: activo).
-- No crea tablas de datos de rrhh (empleados, asistencia_marcas,
-- planillas, etc.) — eso es un paso posterior, a proposito, hasta que
-- esta matriz se apruebe.
--
-- Nomenclatura estricta de 4 segmentos: rrhh.<dominio>.<recurso>.<accion>.
-- Todos los INSERT son idempotentes (on conflict do nothing) — seguro de
-- re-ejecutar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. core.permissions_catalog — 30 permisos granulares
-- -----------------------------------------------------------------------------
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  -- Dominio: expedientes (legajos de empleados)
  ('rrhh.expedientes.empleados.ver',       'rrhh', 'expedientes', 'Ver empleados',              'Listar y ver el detalle de legajos de empleados.'),
  ('rrhh.expedientes.empleados.crear',     'rrhh', 'expedientes', 'Crear empleados',            'Dar de alta un empleado nuevo.'),
  ('rrhh.expedientes.empleados.editar',    'rrhh', 'expedientes', 'Editar empleados',           'Modificar datos generales de un empleado (no salario).'),
  ('rrhh.expedientes.empleados.eliminar',  'rrhh', 'expedientes', 'Eliminar empleados',         'Dar de baja / eliminar un empleado.'),
  ('rrhh.expedientes.empleados.exportar',  'rrhh', 'expedientes', 'Exportar empleados',         'Exportar el listado de empleados (CSV/PDF).'),
  ('rrhh.expedientes.documentos.ver',      'rrhh', 'expedientes', 'Ver documentos',             'Ver documentos adjuntos al legajo (contrato, identificacion).'),
  ('rrhh.expedientes.documentos.subir',    'rrhh', 'expedientes', 'Subir documentos',           'Adjuntar un documento nuevo al legajo.'),
  ('rrhh.expedientes.documentos.eliminar', 'rrhh', 'expedientes', 'Eliminar documentos',        'Eliminar un documento del legajo.'),
  ('rrhh.expedientes.compensacion.ver',    'rrhh', 'expedientes', 'Ver compensacion',           'Ver salario/compensacion del empleado. Dato sensible, separado a proposito de empleados.ver.'),
  ('rrhh.expedientes.compensacion.editar', 'rrhh', 'expedientes', 'Editar compensacion',        'Modificar el salario/compensacion de un empleado.'),

  -- Dominio: asistencia (marcaje, turnos, justificaciones)
  ('rrhh.asistencia.marcas.ver',              'rrhh', 'asistencia', 'Ver marcas',              'Ver marcas de entrada/salida.'),
  ('rrhh.asistencia.marcas.crear',            'rrhh', 'asistencia', 'Crear marcas',            'Registrar una marca manual (correccion de supervisor).'),
  ('rrhh.asistencia.marcas.editar',           'rrhh', 'asistencia', 'Editar marcas',           'Corregir una marca existente.'),
  ('rrhh.asistencia.marcas.eliminar',         'rrhh', 'asistencia', 'Eliminar marcas',         'Eliminar una marca.'),
  ('rrhh.asistencia.turnos.ver',               'rrhh', 'asistencia', 'Ver turnos',              'Ver horarios/turnos asignados.'),
  ('rrhh.asistencia.turnos.crear',             'rrhh', 'asistencia', 'Crear turnos',            'Crear un turno nuevo.'),
  ('rrhh.asistencia.turnos.editar',            'rrhh', 'asistencia', 'Editar turnos',           'Modificar un turno existente.'),
  ('rrhh.asistencia.turnos.eliminar',          'rrhh', 'asistencia', 'Eliminar turnos',         'Eliminar un turno.'),
  ('rrhh.asistencia.justificaciones.ver',      'rrhh', 'asistencia', 'Ver justificaciones',     'Ver solicitudes de justificacion/permiso.'),
  ('rrhh.asistencia.justificaciones.crear',    'rrhh', 'asistencia', 'Crear justificaciones',   'Registrar una justificacion de ausencia.'),
  ('rrhh.asistencia.justificaciones.aprobar',  'rrhh', 'asistencia', 'Aprobar justificaciones', 'Aprobar una justificacion pendiente.'),
  ('rrhh.asistencia.justificaciones.rechazar', 'rrhh', 'asistencia', 'Rechazar justificaciones','Rechazar una justificacion pendiente.'),

  -- Dominio: planillas (nomina)
  ('rrhh.planillas.planilla.ver',        'rrhh', 'planillas', 'Ver planillas',          'Ver planillas (corridas de nomina) del periodo.'),
  ('rrhh.planillas.planilla.generar',    'rrhh', 'planillas', 'Generar planillas',      'Calcular/generar el borrador de una planilla.'),
  ('rrhh.planillas.planilla.aprobar',    'rrhh', 'planillas', 'Aprobar planillas',      'Aprobar una planilla — dispara el asiento contable atomico (ver core.fn_aprobar_planilla).'),
  ('rrhh.planillas.planilla.anular',     'rrhh', 'planillas', 'Anular planillas',       'Anular una planilla ya aprobada. Accion de alto riesgo, separada de eliminar.'),
  ('rrhh.planillas.movimientos.ver',     'rrhh', 'planillas', 'Ver movimientos',        'Ver bonos/deducciones/horas extra de una planilla.'),
  ('rrhh.planillas.movimientos.crear',   'rrhh', 'planillas', 'Crear movimientos',      'Registrar un bono, deduccion u hora extra.'),
  ('rrhh.planillas.movimientos.eliminar','rrhh', 'planillas', 'Eliminar movimientos',   'Eliminar un movimiento antes de aprobar la planilla.'),
  ('rrhh.planillas.reportes.exportar',   'rrhh', 'planillas', 'Exportar reportes',      'Exportar el reporte de planilla (ej. para el banco de pago).')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- 2. core.app_roles — 5 roles operativos de RRHH
-- -----------------------------------------------------------------------------
insert into core.app_roles (module_slug, role_key, label, description) values
  ('rrhh', 'admin',                   'Administrador de RRHH',      'Control total del modulo: expedientes, asistencia y planillas, incluida la edicion de compensacion y la anulacion de planillas.'),
  ('rrhh', 'gestor_expedientes',      'Gestor de Expedientes',      'Administra legajos completos de empleados. Ve compensacion para tramites administrativos pero no puede editarla — separacion de funciones con Planillas.'),
  ('rrhh', 'supervisor_asistencia',   'Supervisor de Asistencia',   'Control total de marcaje, turnos y justificaciones. Ve el listado de empleados en solo lectura, sin acceso a legajo ni salario.'),
  ('rrhh', 'especialista_planillas',  'Especialista de Planillas',  'Calcula y aprueba planillas. Necesita ver salario y horas marcadas (solo lectura) para el calculo, sin poder alterar el legajo ni la asistencia.'),
  ('rrhh', 'consulta',                'Consulta General',          'Visibilidad de solo lectura de los 3 dominios, sin acceso a compensacion.')
on conflict (module_slug, role_key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. core.app_role_permissions — que permisos trae empaquetado cada rol.
-- Se vincula por codigo/role_key (nunca por uuid hardcodeado), para que
-- esta migracion sea segura de re-ejecutar y no dependa del orden de
-- generacion de ids.
-- -----------------------------------------------------------------------------

-- admin: los 30 permisos de la matriz.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, pc.code
from core.app_roles ar
join core.permissions_catalog pc on pc.module_slug = 'rrhh' and pc.domain in ('expedientes', 'asistencia', 'planillas')
where ar.module_slug = 'rrhh' and ar.role_key = 'admin'
on conflict do nothing;

-- gestor_expedientes: expedientes.* excepto compensacion.editar.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.empleados.ver',
  'rrhh.expedientes.empleados.crear',
  'rrhh.expedientes.empleados.editar',
  'rrhh.expedientes.empleados.eliminar',
  'rrhh.expedientes.empleados.exportar',
  'rrhh.expedientes.documentos.ver',
  'rrhh.expedientes.documentos.subir',
  'rrhh.expedientes.documentos.eliminar',
  'rrhh.expedientes.compensacion.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'gestor_expedientes'
on conflict do nothing;

-- supervisor_asistencia: asistencia.* completo + empleados.ver de solo lectura.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.asistencia.marcas.ver',
  'rrhh.asistencia.marcas.crear',
  'rrhh.asistencia.marcas.editar',
  'rrhh.asistencia.marcas.eliminar',
  'rrhh.asistencia.turnos.ver',
  'rrhh.asistencia.turnos.crear',
  'rrhh.asistencia.turnos.editar',
  'rrhh.asistencia.turnos.eliminar',
  'rrhh.asistencia.justificaciones.ver',
  'rrhh.asistencia.justificaciones.crear',
  'rrhh.asistencia.justificaciones.aprobar',
  'rrhh.asistencia.justificaciones.rechazar',
  'rrhh.expedientes.empleados.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'supervisor_asistencia'
on conflict do nothing;

-- especialista_planillas: planillas.* completo + lectura cruzada minima
-- (empleados, compensacion, marcas) para poder calcular la planilla.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.planillas.planilla.ver',
  'rrhh.planillas.planilla.generar',
  'rrhh.planillas.planilla.aprobar',
  'rrhh.planillas.planilla.anular',
  'rrhh.planillas.movimientos.ver',
  'rrhh.planillas.movimientos.crear',
  'rrhh.planillas.movimientos.eliminar',
  'rrhh.planillas.reportes.exportar',
  'rrhh.expedientes.empleados.ver',
  'rrhh.expedientes.compensacion.ver',
  'rrhh.asistencia.marcas.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'especialista_planillas'
on conflict do nothing;

-- consulta: *.ver de los 3 dominios, sin compensacion.
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join unnest(array[
  'rrhh.expedientes.empleados.ver',
  'rrhh.expedientes.documentos.ver',
  'rrhh.asistencia.marcas.ver',
  'rrhh.asistencia.turnos.ver',
  'rrhh.asistencia.justificaciones.ver',
  'rrhh.planillas.planilla.ver',
  'rrhh.planillas.movimientos.ver'
]) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'consulta'
on conflict do nothing;
