-- =============================================================================
-- Nexo Enterprise UI (rediseño visual, 2026-09-07) — completar el hueco de
-- UI para rrhh.expedientes.empleados.eliminar: el permiso y la politica RLS
-- DELETE ya existian (20260902000006) pero ningun Server Action lo
-- invocaba. Ajuste obligatorio del usuario: la validacion de dominio
-- (¿tiene contratos historicos?) debe ser EXPLICITA en el backend, no
-- depender de que la violacion de FK sea el mecanismo de rechazo -- por
-- eso el chequeo de rrhh.contratos va primero, con mensaje de dominio
-- claro, y solo despues el delete (que en la practica nunca llegaria a
-- violar la FK porque el chequeo ya lo impidio antes).
--
-- Misma logica de negocio para Web y Mobile (regla obligatoria de
-- CLAUDE.md/ARCHITECTURE.md §8): RPC real, no un query suelto encerrado en
-- el Server Action de apps/rrhh.
-- =============================================================================
create or replace function rrhh.fn_eliminar_empleado(p_empleado_id uuid, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = rrhh, public
as $$
declare
  v_contratos_count integer;
  v_deleted_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.eliminar') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.eliminar';
  end if;

  select count(*) into v_contratos_count
  from rrhh.contratos
  where empleado_id = p_empleado_id
    and company_id = p_company_id;

  if v_contratos_count > 0 then
    raise exception
      'No se puede eliminar: este empleado tiene % contrato(s) registrado(s) (borrador, activo o finalizado). Un expediente con historial contractual no se elimina.',
      v_contratos_count;
  end if;

  delete from rrhh.empleados
  where id = p_empleado_id
    and company_id = p_company_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;
end;
$$;

comment on function rrhh.fn_eliminar_empleado is
  'Elimina un Expediente General solo si no tiene ningun rrhh.contratos asociado (cualquier estado) -- validacion de dominio explicita, no depende de la violacion de la FK. Usa rrhh.expedientes.empleados.eliminar (ya existente).';

revoke execute on function rrhh.fn_eliminar_empleado(uuid, uuid) from public;
revoke execute on function rrhh.fn_eliminar_empleado(uuid, uuid) from anon;
revoke execute on function rrhh.fn_eliminar_empleado(uuid, uuid) from authenticated;

create or replace function public.eliminar_empleado(p_empleado_id uuid, p_company_id uuid)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_eliminar_empleado(p_empleado_id, p_company_id);
$$;

comment on function public.eliminar_empleado is
  'Wrapper publico de rrhh.fn_eliminar_empleado -- ver esa funcion para la logica de dominio.';

revoke execute on function public.eliminar_empleado from public;
grant execute on function public.eliminar_empleado to authenticated;
