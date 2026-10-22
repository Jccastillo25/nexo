-- Paso Cero de Planilla (docs/plan/20-planilla.md §8). Aprobado por el usuario
-- el 2026-10-21: "Apruebo el Paso Cero de Planilla, incluyendo quitarle aprobar
-- y anular al especialista de planillas. Aplícalo."
--
-- Solo catálogo y plantillas de rol: no crea tablas ni asigna nada a roles de
-- empresa (core.rol_permisos). 15 códigos nuevos, 34 asignaciones y la
-- separación de funciones: especialista_planillas deja de aprobar y anular.
--
-- Rollback (antes de uso):
--   delete from core.app_role_permissions where permission_code in (<los 15>);
--   delete from core.permissions_catalog where code in (<los 15>);
--   insert into core.app_role_permissions (app_role_id, permission_code)
--   select id, c from core.app_roles, unnest(array['rrhh.planillas.planilla.aprobar','rrhh.planillas.planilla.anular']) c
--   where module_slug = 'rrhh' and role_key = 'especialista_planillas';
do $$
declare
  n integer;
  v_codigos text[] := array[
    'rrhh.planillas.regimen.ver','rrhh.planillas.regimen.cambiar',
    'rrhh.planillas.conceptos.ver','rrhh.planillas.conceptos.gestionar',
    'rrhh.planillas.planilla.pagar',
    'rrhh.planillas.vacaciones.ver','rrhh.planillas.vacaciones.registrar','rrhh.planillas.vacaciones.aprobar',
    'rrhh.planillas.prestamos.ver','rrhh.planillas.prestamos.gestionar',
    'rrhh.planillas.liquidaciones.ver','rrhh.planillas.liquidaciones.calcular','rrhh.planillas.liquidaciones.aprobar',
    'rrhh.planillas.declaraciones.generar','rrhh.planillas.colillas.enviar'];
begin
  -- Prechequeo
  if exists (select 1 from core.permissions_catalog where code = any (v_codigos)) then
    raise exception 'precheck: algún permiso de planilla ya existe';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'rrhh'
        and role_key in ('admin','gestor_expedientes','supervisor_asistencia','especialista_planillas','consulta')) <> 5 then
    raise exception 'precheck: faltan plantillas de rol de rrhh';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'rrhh' and domain = 'planillas') <> 10 then
    raise exception 'precheck: se esperaban 10 permisos de planillas antes del cambio';
  end if;

  -- 1. Catálogo
  insert into core.permissions_catalog (code, module_slug, domain, label, description) values
    ('rrhh.planillas.regimen.ver', 'rrhh', 'planillas', 'Ver régimen de contratación', 'Ver si cada contrato es laboral o de servicios profesionales y su historial.'),
    ('rrhh.planillas.regimen.cambiar', 'rrhh', 'planillas', 'Cambiar régimen de contratación', 'Cambiar el régimen de un contrato activo con fecha efectiva y motivo. Queda auditado.'),
    ('rrhh.planillas.conceptos.ver', 'rrhh', 'planillas', 'Ver conceptos de planilla', 'Ver el catálogo de ingresos, deducciones y tipos de planilla.'),
    ('rrhh.planillas.conceptos.gestionar', 'rrhh', 'planillas', 'Gestionar conceptos de planilla', 'Crear y editar ingresos, deducciones y tipos de planilla. Un concepto usado en una planilla cerrada no cambia sus reglas.'),
    ('rrhh.planillas.planilla.pagar', 'rrhh', 'planillas', 'Pagar planillas', 'Marcar una planilla aprobada como pagada, por cheque o banco.'),
    ('rrhh.planillas.vacaciones.ver', 'rrhh', 'planillas', 'Ver vacaciones', 'Ver saldos y movimientos de vacaciones.'),
    ('rrhh.planillas.vacaciones.registrar', 'rrhh', 'planillas', 'Registrar vacaciones', 'Registrar días gozados, pagados o ajustes de vacaciones.'),
    ('rrhh.planillas.vacaciones.aprobar', 'rrhh', 'planillas', 'Aprobar vacaciones', 'Aprobar o rechazar solicitudes de vacaciones.'),
    ('rrhh.planillas.prestamos.ver', 'rrhh', 'planillas', 'Ver préstamos', 'Ver préstamos, adelantos y embargos con sus cuotas.'),
    ('rrhh.planillas.prestamos.gestionar', 'rrhh', 'planillas', 'Gestionar préstamos', 'Crear y editar préstamos, adelantos y embargos.'),
    ('rrhh.planillas.liquidaciones.ver', 'rrhh', 'planillas', 'Ver liquidaciones', 'Ver liquidaciones y simulaciones.'),
    ('rrhh.planillas.liquidaciones.calcular', 'rrhh', 'planillas', 'Calcular liquidaciones', 'Simular y preparar la liquidación final de un contrato.'),
    ('rrhh.planillas.liquidaciones.aprobar', 'rrhh', 'planillas', 'Aprobar liquidaciones', 'Aprobar una liquidación preparada. Quien la calcula no la aprueba.'),
    ('rrhh.planillas.declaraciones.generar', 'rrhh', 'planillas', 'Generar declaraciones', 'Generar los informes de INSS, INATEC y DGI-VET.'),
    ('rrhh.planillas.colillas.enviar', 'rrhh', 'planillas', 'Enviar colillas', 'Publicar y enviar las colillas de una planilla aprobada.');

  -- 2. Plantillas de rol
  insert into core.app_role_permissions (app_role_id, permission_code)
  select ar.id, x.code
  from core.app_roles ar
  join (values
    ('admin','rrhh.planillas.regimen.ver'), ('admin','rrhh.planillas.regimen.cambiar'),
    ('admin','rrhh.planillas.conceptos.ver'), ('admin','rrhh.planillas.conceptos.gestionar'),
    ('admin','rrhh.planillas.planilla.pagar'),
    ('admin','rrhh.planillas.vacaciones.ver'), ('admin','rrhh.planillas.vacaciones.registrar'), ('admin','rrhh.planillas.vacaciones.aprobar'),
    ('admin','rrhh.planillas.prestamos.ver'), ('admin','rrhh.planillas.prestamos.gestionar'),
    ('admin','rrhh.planillas.liquidaciones.ver'), ('admin','rrhh.planillas.liquidaciones.calcular'), ('admin','rrhh.planillas.liquidaciones.aprobar'),
    ('admin','rrhh.planillas.declaraciones.generar'), ('admin','rrhh.planillas.colillas.enviar'),
    ('especialista_planillas','rrhh.planillas.regimen.ver'),
    ('especialista_planillas','rrhh.planillas.conceptos.ver'), ('especialista_planillas','rrhh.planillas.conceptos.gestionar'),
    ('especialista_planillas','rrhh.planillas.vacaciones.ver'), ('especialista_planillas','rrhh.planillas.vacaciones.registrar'),
    ('especialista_planillas','rrhh.planillas.prestamos.ver'), ('especialista_planillas','rrhh.planillas.prestamos.gestionar'),
    ('especialista_planillas','rrhh.planillas.liquidaciones.ver'), ('especialista_planillas','rrhh.planillas.liquidaciones.calcular'),
    ('especialista_planillas','rrhh.planillas.declaraciones.generar'), ('especialista_planillas','rrhh.planillas.colillas.enviar'),
    ('supervisor_asistencia','rrhh.planillas.vacaciones.ver'), ('supervisor_asistencia','rrhh.planillas.vacaciones.aprobar'),
    ('gestor_expedientes','rrhh.planillas.regimen.ver'),
    ('consulta','rrhh.planillas.regimen.ver'), ('consulta','rrhh.planillas.conceptos.ver'),
    ('consulta','rrhh.planillas.vacaciones.ver'), ('consulta','rrhh.planillas.prestamos.ver'),
    ('consulta','rrhh.planillas.liquidaciones.ver')
  ) as x(role_key, code) on x.role_key = ar.role_key
  where ar.module_slug = 'rrhh';
  get diagnostics n = row_count;
  if n <> 34 then raise exception 'postcheck: se esperaban 34 asignaciones (%).', n; end if;

  -- 3. Separación de funciones: quien genera la planilla no la aprueba ni la anula.
  delete from core.app_role_permissions rp
  using core.app_roles ar
  where rp.app_role_id = ar.id and ar.module_slug = 'rrhh' and ar.role_key = 'especialista_planillas'
    and rp.permission_code in ('rrhh.planillas.planilla.aprobar','rrhh.planillas.planilla.anular');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'postcheck: se esperaban 2 permisos quitados al especialista (%).', n; end if;

  -- 4. Poscheque
  if (select count(*) from core.permissions_catalog where module_slug = 'rrhh' and domain = 'planillas') <> 25 then
    raise exception 'postcheck: se esperaban 25 permisos de planillas';
  end if;
  if exists (select 1 from core.permissions_catalog
             where code like 'rrhh.planillas.%' and array_length(string_to_array(code, '.'), 1) <> 4) then
    raise exception 'postcheck: hay códigos de planillas sin 4 segmentos';
  end if;
  if exists (select 1 from core.app_role_permissions rp join core.app_roles ar on ar.id = rp.app_role_id
             where ar.module_slug = 'rrhh' and ar.role_key <> 'admin'
               and rp.permission_code in ('rrhh.planillas.regimen.cambiar','rrhh.planillas.planilla.pagar',
                                          'rrhh.planillas.planilla.aprobar','rrhh.planillas.planilla.anular',
                                          'rrhh.planillas.liquidaciones.aprobar')) then
    raise exception 'postcheck: régimen, pago, aprobación y anulación son solo del admin';
  end if;
  if exists (select 1 from core.rol_permisos where permission_code = any (v_codigos)) then
    raise exception 'postcheck: no se asigna nada a roles de empresa';
  end if;
end;
$$;
