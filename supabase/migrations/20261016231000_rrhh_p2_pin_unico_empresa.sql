-- P2: asignacion criptografica serializada por empresa, firmas conservadas.
-- Rollback: conservar credenciales y corregir hacia adelante; no restaurar random().
-- Verificacion: definiciones sin random(), locks presentes; pruebas P2 y P7 remoto.
create or replace function rrhh.fn_activar_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns table (pin_kiosko text)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
  v_empleado_id uuid;
  v_pin text;
  v_bytes bytea;
  v_n integer;
  v_intento integer;
  v_candidato text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.activar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.activar';
  end if;

  perform pg_advisory_xact_lock(76106, hashtext(p_company_id::text));

  select estado, empleado_id into v_estado, v_empleado_id
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id for update;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede activar un contrato en estado borrador';
  end if;

  if exists (select 1 from rrhh.contratos where empleado_id = v_empleado_id and estado = 'activo') then
    raise exception 'El empleado ya tiene un contrato activo';
  end if;

  -- F1.4 (2026-09-07, decision explicita del usuario): la jornada es
  -- obligatoria para activar -- un contrato activo sin jornada quedaria
  -- inutilizable para asistencia (F1.5) hasta que alguien la complete a
  -- mano. Basta con que exista AL MENOS UNA fila (no necesariamente
  -- vigente hoy -- un contrato puede activarse con fecha de inicio
  -- futura ya con su jornada preparada).
  if not exists (select 1 from rrhh.contrato_jornadas where contrato_id = p_contrato_id) then
    raise exception 'El contrato no tiene una jornada asignada -- complete la jornada antes de activar';
  end if;

  update rrhh.contratos
  set estado = 'activo', activado_at = now(), activado_by = auth.uid()
  where id = p_contrato_id and company_id = p_company_id;

  perform pg_advisory_xact_lock(76106, hashtext(p_company_id::text));
  v_pin := null;
  for v_intento in 1..128 loop
    v_bytes := extensions.gen_random_bytes(2);
    v_n := get_byte(v_bytes, 0) * 256 + get_byte(v_bytes, 1);
    continue when v_n >= 60000;
    v_candidato := lpad((v_n % 10000)::text, 4, '0');
    if not exists (
      select 1 from rrhh.contrato_credenciales cc
      join rrhh.contratos c on c.id = cc.contrato_id
      where c.company_id = p_company_id and c.estado = 'activo'
        and cc.activo and not cc.pin_bloqueado
        and crypt(v_candidato, cc.pin_hash) = cc.pin_hash
    ) then v_pin := v_candidato; exit; end if;
  end loop;
  if v_pin is null then
    raise exception 'No fue posible asignar una credencial. Intente nuevamente.';
  end if;

  insert into rrhh.contrato_credenciales (company_id, contrato_id, pin_hash, creado_by)
  values (p_company_id, p_contrato_id, crypt(v_pin, gen_salt('bf')), auth.uid());

  return query select v_pin;
end;
$$;

create or replace function rrhh.fn_regenerar_pin_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns table (pin_kiosko text)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
  v_pin text;
  v_bytes bytea;
  v_n integer;
  v_intento integer;
  v_candidato text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.credenciales.regenerar') then
    raise exception 'Permiso denegado: rrhh.expedientes.credenciales.regenerar';
  end if;

  perform pg_advisory_xact_lock(76106, hashtext(p_company_id::text));

  select estado into v_estado from rrhh.contratos where id = p_contrato_id and company_id = p_company_id for update;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'activo' then
    raise exception 'Solo se puede regenerar el PIN de un contrato activo';
  end if;

  perform pg_advisory_xact_lock(76106, hashtext(p_company_id::text));
  v_pin := null;
  for v_intento in 1..128 loop
    v_bytes := extensions.gen_random_bytes(2);
    v_n := get_byte(v_bytes, 0) * 256 + get_byte(v_bytes, 1);
    continue when v_n >= 60000;
    v_candidato := lpad((v_n % 10000)::text, 4, '0');
    if not exists (
      select 1 from rrhh.contrato_credenciales cc
      join rrhh.contratos c on c.id = cc.contrato_id
      where c.company_id = p_company_id and c.estado = 'activo'
        and cc.activo and not cc.pin_bloqueado
        and crypt(v_candidato, cc.pin_hash) = cc.pin_hash
    ) then v_pin := v_candidato; exit; end if;
  end loop;
  if v_pin is null then
    raise exception 'No fue posible asignar una credencial. Intente nuevamente.';
  end if;

  update rrhh.contrato_credenciales
  set pin_hash = crypt(v_pin, gen_salt('bf')),
      rotacion_numero = rotacion_numero + 1,
      pin_bloqueado = false,
      intentos_fallidos = 0
  where contrato_id = p_contrato_id and activo = true;

  if not found then
    raise exception 'No existe una credencial activa para este contrato';
  end if;

  return query select v_pin;
end;
$$;
revoke execute on function rrhh.fn_activar_contrato(uuid, uuid) from public, anon, authenticated;
revoke execute on function rrhh.fn_regenerar_pin_contrato(uuid, uuid) from public, anon, authenticated;
