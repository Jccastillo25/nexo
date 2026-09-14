-- =============================================================================
-- P3 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
-- edición real del Expediente General. El permiso rrhh.expedientes.
-- empleados.editar YA EXISTE (20260902000005_rrhh_permissions_and_roles)
-- y la policy RLS de UPDATE sobre rrhh.empleados ya lo exige
-- (20260902000006_rrhh_schema_and_tables) -- ninguno de los dos se toca,
-- se reutilizan tal cual (Paso Cero no aplica: no hay permiso nuevo). Lo
-- que faltaba era el RPC que de verdad ejecuta el UPDATE -- hasta ahora
-- el ícono "Editar" de Expedientes navegaba a la misma ficha de solo
-- lectura que "Visualizar" (deuda documentada en
-- docs/status-log/2026-09-08-fix-estabilizacion-rrhh.md).
--
-- Mismo patron que rrhh.fn_crear_empleado/rrhh.fn_eliminar_empleado:
-- SECURITY DEFINER + chequeo de permiso explicito (capa fuerte, RLS es
-- la segunda) + wrapper publico authenticated-only. Solo campos del
-- Expediente General (nombre/apellido/documento/email/telefono) -- NUNCA
-- datos contractuales (eso vive en rrhh.contratos vía Contratación).
-- =============================================================================

create or replace function rrhh.fn_editar_empleado(
  p_empleado_id uuid,
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_updated_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.editar';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_apellido), '') = '' then
    raise exception 'Nombre y apellido son obligatorios';
  end if;

  begin
    update rrhh.empleados as e
    set
      nombre = trim(p_nombre),
      apellido = trim(p_apellido),
      documento_identidad = nullif(trim(p_documento_identidad), ''),
      email = nullif(trim(p_email), ''),
      telefono = nullif(trim(p_telefono), ''),
      updated_at = now()
    where e.id = p_empleado_id
      and e.company_id = p_company_id
    returning e.id into v_updated_id;
  exception when unique_violation then
    raise exception 'Ya existe otro empleado con ese documento de identidad en esta empresa.';
  end;

  if v_updated_id is null then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;
end;
$$;

comment on function rrhh.fn_editar_empleado(uuid, uuid, text, text, text, text, text) is
  'P3 (2026-09-14): edita el Expediente General -- nombre, apellido, documento, email, telefono. Ningun dato contractual (eso vive en rrhh.contratos vía Contratación). Gateada por rrhh.expedientes.empleados.editar (ya existente, sin Paso Cero nuevo).';

revoke execute on function rrhh.fn_editar_empleado(uuid, uuid, text, text, text, text, text) from PUBLIC, anon, authenticated;

create or replace function public.editar_empleado(
  p_empleado_id uuid,
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns void
language sql
security definer
set search_path = rrhh, public
as $$
  select rrhh.fn_editar_empleado(p_empleado_id, p_company_id, p_nombre, p_apellido, p_documento_identidad, p_email, p_telefono);
$$;

comment on function public.editar_empleado(uuid, uuid, text, text, text, text, text) is
  'Wrapper publico de rrhh.fn_editar_empleado (P3, 2026-09-14).';

revoke execute on function public.editar_empleado(uuid, uuid, text, text, text, text, text) from PUBLIC, anon;
grant execute on function public.editar_empleado(uuid, uuid, text, text, text, text, text) to authenticated;
