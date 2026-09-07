-- =============================================================================
-- Paso Cero -- Matriz de permisos para Contratos y Credenciales de RRHH
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md, aprobada explicitamente por el
-- usuario en la fase F1.0.1/Paso Cero, 2026-09-07). Precede a cualquier tabla
-- de datos de F1.1-F1.3 (regla obligatoria "Paso Cero" de CLAUDE.md/PERMISSIONS.md).
--
-- Reutiliza el dominio 'expedientes' ya existente en core.permissions_catalog
-- (no se crea un dominio nuevo 'contratos') -- nomenclatura exacta pedida por
-- el usuario: rrhh.expedientes.contratos.* y rrhh.expedientes.credenciales.*.
--
-- Verificacion remota obligatoria hecha antes de este insert (2026-09-07):
-- ninguno de estos 7 codigos existia en permissions_catalog; los 5
-- core.app_roles de module_slug='rrhh' (admin, gestor_expedientes,
-- supervisor_asistencia, especialista_planillas, consulta) ya estaban
-- seedeados desde 20260902000005 -- no se crea ningun rol nuevo.
--
-- Asignacion inicial aprobada (tabla exacta del usuario):
--   contratos.ver/crear/editar        -> admin, gestor_expedientes
--   contratos.activar/finalizar       -> solo admin
--   credenciales.ver                  -> admin, gestor_expedientes, supervisor_asistencia
--   credenciales.regenerar            -> solo admin
--   especialista_planillas, consulta  -> ninguno de estos 7 (sin fila)
--
-- credenciales.ver es exclusivamente estado de la credencial (activa/
-- bloqueada), nunca el PIN en texto plano -- el PIN solo se muestra una vez,
-- en el momento de rrhh.expedientes.contratos.activar o
-- rrhh.expedientes.credenciales.regenerar, igual que el patron ya usado por
-- rrhh.fn_crear_empleado hoy.
--
-- Explicitamente NO incluido en esta migracion (por decision del usuario):
--   core.identidad.cuenta.*              -- diseno objetivo, capacidad
--     transversal de Nexo a disenar aparte, no se implementa dentro de
--     F1.1-F1.3 ni se asigna a rrhh.admin.
--   flotilla.conductores.*               -- Fase 4, su propio Paso Cero
--     cuando corresponda.
--
-- Verificado despues de aplicar (core.app_role_permissions):
--   admin                  -> los 7
--   gestor_expedientes     -> ver/crear/editar de contratos + credenciales.ver
--   supervisor_asistencia  -> solo credenciales.ver
--   especialista_planillas, consulta -> sin filas de este bloque
-- =============================================================================

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('rrhh.expedientes.contratos.ver', 'rrhh', 'expedientes', 'Ver contratos', 'Ver el expediente laboral / contratos de un empleado'),
  ('rrhh.expedientes.contratos.crear', 'rrhh', 'expedientes', 'Crear contrato', 'Crear un contrato en estado borrador para un empleado existente'),
  ('rrhh.expedientes.contratos.editar', 'rrhh', 'expedientes', 'Editar contrato', 'Editar un contrato en estado borrador (puesto, departamento, jornada, fechas, compensacion)'),
  ('rrhh.expedientes.contratos.activar', 'rrhh', 'expedientes', 'Activar contrato', 'Activar un contrato borrador -- genera el PIN de asistencia automaticamente'),
  ('rrhh.expedientes.contratos.finalizar', 'rrhh', 'expedientes', 'Finalizar contrato', 'Finalizar un contrato activo -- revoca el PIN y bloquea nuevas marcaciones/operaciones laborales'),
  ('rrhh.expedientes.credenciales.ver', 'rrhh', 'expedientes', 'Ver estado de credencial', 'Ver si un contrato tiene PIN activo/bloqueado -- nunca el PIN en texto plano'),
  ('rrhh.expedientes.credenciales.regenerar', 'rrhh', 'expedientes', 'Regenerar PIN', 'Regenerar el PIN de asistencia de un contrato activo -- se muestra en texto plano una unica vez, igual que en la generacion inicial');

-- admin: los 7
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join (values
  ('rrhh.expedientes.contratos.ver'),
  ('rrhh.expedientes.contratos.crear'),
  ('rrhh.expedientes.contratos.editar'),
  ('rrhh.expedientes.contratos.activar'),
  ('rrhh.expedientes.contratos.finalizar'),
  ('rrhh.expedientes.credenciales.ver'),
  ('rrhh.expedientes.credenciales.regenerar')
) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'admin';

-- gestor_expedientes: ver/crear/editar de contratos + ver de credenciales (no activar/finalizar/regenerar)
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, p.code
from core.app_roles ar
cross join (values
  ('rrhh.expedientes.contratos.ver'),
  ('rrhh.expedientes.contratos.crear'),
  ('rrhh.expedientes.contratos.editar'),
  ('rrhh.expedientes.credenciales.ver')
) as p(code)
where ar.module_slug = 'rrhh' and ar.role_key = 'gestor_expedientes';

-- supervisor_asistencia: solo ver estado de credencial
insert into core.app_role_permissions (app_role_id, permission_code)
select ar.id, 'rrhh.expedientes.credenciales.ver'
from core.app_roles ar
where ar.module_slug = 'rrhh' and ar.role_key = 'supervisor_asistencia';

-- especialista_planillas y consulta: sin fila (0 de los 7) -- decision explicita del usuario, sin insert.
