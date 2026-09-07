-- =============================================================================
-- Correccion a F1.2 (20260907153604_f1_2_rrhh_contratos): mismo patron de
-- bug que fn_crear_empleado (RETURNS TABLE crea variables OUT que
-- colisionan con las columnas del mismo nombre en la clausula RETURNING
-- del INSERT) -- rrhh.fn_crear_contrato nunca pudo ejecutarse. Detectado
-- en la misma prueba end-to-end de F1.3.
-- =============================================================================

create or replace function rrhh.fn_crear_contrato(
  p_company_id uuid,
  p_empleado_id uuid,
  p_puesto text default null,
  p_departamento text default null,
  p_modalidad_contrato text default null,
  p_fecha_inicio date default null,
  p_fecha_fin_prevista date default null,
  p_salario_base numeric default null
)
returns table (contrato_id uuid, numero_contrato bigint)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_contrato_id uuid;
  v_numero_contrato bigint;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.crear';
  end if;

  if not exists (select 1 from rrhh.empleados where id = p_empleado_id and company_id = p_company_id) then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;

  insert into rrhh.contratos as c (
    company_id, empleado_id, puesto, departamento, modalidad_contrato,
    fecha_inicio, fecha_fin_prevista, created_by
  )
  values (
    p_company_id, p_empleado_id, p_puesto, p_departamento, p_modalidad_contrato,
    p_fecha_inicio, p_fecha_fin_prevista, auth.uid()
  )
  returning c.id, c.numero_contrato into v_contrato_id, v_numero_contrato;

  if coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario)';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (v_contrato_id, p_company_id, p_salario_base, auth.uid());
  end if;

  return query select v_contrato_id, v_numero_contrato;
end;
$$;

comment on function rrhh.fn_crear_contrato(uuid, uuid, text, text, text, date, date, numeric) is
  'F1.2 (2026-09-07): crea un contrato en estado borrador para un empleado existente. Gateada por rrhh.expedientes.contratos.crear; fijar salario_base exige ademas rrhh.expedientes.compensacion.editar. CORREGIDA 2026-09-07 (mismo dia): el INSERT usaba RETURNING sin alias de tabla, ambiguo contra las variables OUT de RETURNS TABLE -- fallaba SIEMPRE. Ver fix_crear_contrato_returning_ambiguous.';
