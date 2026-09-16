-- =============================================================================
-- Fase 1 del bloque "pre-F1.5" (ver docs/status-log/2026-09-16-rrhh-pre-f1-5.md
-- y el plan aprobado de esa sesión): la cedula/documento de identidad del
-- Expediente General era opcional en UI, Server Action y base de datos desde
-- F1.1 (20260907152301) -- el usuario pidio hacerla obligatoria.
--
-- Verificacion remota previa (nexo-core, 2026-09-16): 0 filas con
-- documento_identidad nulo/vacio en produccion -- el ALTER NOT NULL de abajo
-- es seguro sin backfill. Se deja igual una guarda explicita: si en el
-- entorno donde corra esta migracion existiera alguna fila nula, aborta con
-- un mensaje entendible en vez del error generico de Postgres o de rellenar
-- un valor inventado (regla del plan: "no perder historicos ni sobrescribir
-- datos silenciosamente").
-- =============================================================================

do $$
declare
  v_nulos int;
begin
  select count(*) into v_nulos
  from rrhh.empleados
  where documento_identidad is null or trim(documento_identidad) = '';

  if v_nulos > 0 then
    raise exception
      'No se puede hacer NOT NULL rrhh.empleados.documento_identidad: hay % expediente(s) sin documento. Definir la estrategia de transicion para esos casos antes de aplicar esta migracion.',
      v_nulos;
  end if;
end;
$$;

update rrhh.empleados set documento_identidad = trim(documento_identidad) where documento_identidad is not null;

alter table rrhh.empleados
  alter column documento_identidad set not null;

comment on column rrhh.empleados.documento_identidad is
  'Cedula/documento de identidad -- obligatorio desde 2026-09-16 (Fase 1 pre-F1.5). Unico por empresa (empleados_company_id_documento_identidad_key).';

-- -----------------------------------------------------------------------------
-- rrhh.fn_crear_empleado: exige documento no vacio antes del insert, y
-- traduce el unique_violation a un mensaje entendible (mismo patron que ya
-- usa rrhh.fn_editar_empleado desde 2026-09-14 -- fn_crear_empleado no lo
-- tenia).
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns table(empleado_id uuid, codigo_empleado bigint)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_empleado_id uuid;
  v_codigo_empleado bigint;
  v_documento text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.crear';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_apellido), '') = '' then
    raise exception 'Nombre y apellido son obligatorios';
  end if;

  v_documento := nullif(trim(p_documento_identidad), '');
  if v_documento is null then
    raise exception 'El documento de identidad (cedula) es obligatorio';
  end if;

  begin
    insert into rrhh.empleados as e (company_id, nombre, apellido, documento_identidad, email, telefono)
    values (p_company_id, trim(p_nombre), trim(p_apellido), v_documento, nullif(trim(p_email), ''), nullif(trim(p_telefono), ''))
    returning e.id, e.codigo_empleado into v_empleado_id, v_codigo_empleado;
  exception when unique_violation then
    raise exception 'Ya existe un empleado con ese documento de identidad en esta empresa.';
  end;

  return query select v_empleado_id, v_codigo_empleado;
end;
$$;

comment on function rrhh.fn_crear_empleado(uuid, text, text, text, text, text) is
  'Crea el Expediente General de un empleado. Documento de identidad obligatorio desde 2026-09-16 (Fase 1 pre-F1.5) -- ningun dato contractual (eso es un Contrato, F1.2).';

-- -----------------------------------------------------------------------------
-- rrhh.fn_editar_empleado: mismo requisito -- ya no se permite vaciar el
-- documento de un expediente existente via edicion.
-- -----------------------------------------------------------------------------
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
  v_documento text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.editar';
  end if;

  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_apellido), '') = '' then
    raise exception 'Nombre y apellido son obligatorios';
  end if;

  v_documento := nullif(trim(p_documento_identidad), '');
  if v_documento is null then
    raise exception 'El documento de identidad (cedula) es obligatorio';
  end if;

  begin
    update rrhh.empleados as e
    set
      nombre = trim(p_nombre),
      apellido = trim(p_apellido),
      documento_identidad = v_documento,
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
  'Edita el Expediente General. Documento de identidad obligatorio desde 2026-09-16 (Fase 1 pre-F1.5) -- ningun dato contractual.';
