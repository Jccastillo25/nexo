-- =============================================================================
-- Correccion a F1.1 (20260907152301_f1_1_separar_expediente_general_laboral):
-- rrhh.fn_crear_empleado nunca pudo ejecutarse -- fallaba SIEMPRE con
-- "column reference codigo_empleado is ambiguous". Causa: RETURNS TABLE
-- declara automaticamente variables OUT llamadas empleado_id/codigo_empleado
-- en el cuerpo de la funcion, que colisionan con las columnas del mismo
-- nombre de rrhh.empleados dentro de la clausula RETURNING del INSERT.
--
-- Detectado en F1.3 al probar el flujo completo end-to-end por primera
-- vez con una llamada real a la funcion (las pruebas de F1.1 solo habian
-- verificado el esquema con INSERT crudo, sin pasar por esta funcion).
--
-- Fix: alias de tabla explicito en el INSERT para desambiguar la
-- clausula RETURNING. Sin cambio de firma ni de comportamiento -- CREATE
-- OR REPLACE alcanza.
-- =============================================================================

create or replace function rrhh.fn_crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns table (empleado_id uuid, codigo_empleado bigint)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_empleado_id uuid;
  v_codigo_empleado bigint;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.crear';
  end if;

  insert into rrhh.empleados as e (company_id, nombre, apellido, documento_identidad, email, telefono)
  values (p_company_id, p_nombre, p_apellido, p_documento_identidad, p_email, p_telefono)
  returning e.id, e.codigo_empleado into v_empleado_id, v_codigo_empleado;

  return query select v_empleado_id, v_codigo_empleado;
end;
$$;

comment on function rrhh.fn_crear_empleado(uuid, text, text, text, text, text) is
  'F1.1 (2026-09-07): alta de Expediente General exclusivamente -- nombre, apellido, documento, email, telefono. Sin puesto/departamento/modalidad/salario/PIN/nombre_usuario (eso es contrato, F1.2/F1.3). Gateada por rrhh.expedientes.empleados.crear. Reemplaza a la version de 13 parametros de 20260902000008. CORREGIDA 2026-09-07 (mismo dia): el INSERT usaba RETURNING sin alias de tabla, ambiguo contra las variables OUT de RETURNS TABLE -- fallaba SIEMPRE. Ver fix_crear_empleado_returning_ambiguous.';
