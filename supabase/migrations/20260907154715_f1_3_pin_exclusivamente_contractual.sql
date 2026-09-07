-- =============================================================================
-- F1.3 -- PIN exclusivamente contractual
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md secciones 5.3/8.4; aprobado
-- explicitamente por el usuario, 2026-09-07).
--
-- Regla objetivo: SIN CONTRATO ACTIVO -> SIN PIN. El PIN nace SOLO al
-- activar un contrato (rrhh.fn_activar_contrato), se revoca al
-- finalizarlo (rrhh.fn_finalizar_contrato), y solo puede regenerarse
-- sobre un contrato activo (rrhh.fn_regenerar_pin_contrato, nueva). Vive
-- en rrhh.contrato_credenciales (nueva tabla), NUNCA en
-- rrhh.empleados.pin_hash (deprecada desde F1.1, ahora superada del
-- todo). "credenciales.ver" es EXCLUSIVAMENTE estado, nunca el PIN en
-- texto plano -- se implementa como un RPC que ni siquiera hace SELECT
-- de pin_hash, no como una policy de RLS sobre la tabla (no se GRANTea
-- SELECT alguno sobre rrhh.contrato_credenciales).
--
-- rrhh.fn_registrar_marca_kiosko (kiosko en produccion) se reescribe
-- para validar contra rrhh.contrato_credenciales + rrhh.contratos.estado
-- = 'activo' en vez de rrhh.empleados.pin_hash/estado/pin_bloqueado --
-- MISMA firma, MISMO rate-limit de kiosko_rate_limits, MISMA logica
-- anti-enumeracion (RETURN, nunca RAISE EXCEPTION), MISMA inferencia de
-- entrada/salida. Unico cambio: de donde sale la credencial valida.
--
-- Verificado end-to-end (2026-09-07, simulando auth.uid() via
-- request.jwt.claims contra un empleado/contrato/kiosko de prueba,
-- borrados en la misma sesion): crear empleado -> crear contrato con
-- salario -> activar (PIN devuelto una vez) -> marcar entrada -> marcar
-- salida -> ver estado de credencial (sin PIN) -> regenerar PIN -> PIN
-- viejo rechazado -> PIN nuevo acepta marca -> finalizar contrato -> PIN
-- rechazado despues de finalizar. Negativos: usuario sin permiso
-- rechazado; empresa cruzada rechazada (aislamiento).
-- =============================================================================

create table rrhh.contrato_credenciales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null unique references rrhh.contratos(id) on delete cascade,
  pin_hash text not null,
  activo boolean not null default true,
  pin_bloqueado boolean not null default false,
  intentos_fallidos smallint not null default 0,
  rotacion_numero int not null default 1,
  creado_at timestamptz not null default now(),
  creado_by uuid references auth.users(id),
  revocado_at timestamptz,
  revocado_by uuid references auth.users(id)
);

comment on table rrhh.contrato_credenciales is
  'Credencial de asistencia del contrato (F1.3, 2026-09-07) -- PIN exclusivamente de kiosko/asistencia, nunca contraseña Web/Mobile. 1 fila por contrato (unique en contrato_id), se actualiza in place en cada regeneracion (rotacion_numero++). pin_hash NUNCA se expone via SELECT directo -- sin GRANT de SELECT a authenticated, solo accesible via RPC (rrhh.fn_estado_credencial_contrato, que ni siquiera lee esta columna).';

create index contrato_credenciales_company_id_idx on rrhh.contrato_credenciales (company_id);

alter table rrhh.contrato_credenciales enable row level security;
-- Sin policies a proposito (deny by default, mismo criterio que
-- rrhh.seguridad_accesos y rrhh.kiosko_rate_limits): toda lectura/
-- escritura pasa por funciones SECURITY DEFINER. Sin GRANT a
-- authenticated/anon sobre la tabla.

-- =============================================================================
-- rrhh.fn_activar_contrato: AHORA genera el PIN (cambia el tipo de
-- retorno de void a table(pin_kiosko text) -- requiere DROP, Postgres no
-- permite CREATE OR REPLACE con retorno distinto).
-- =============================================================================
drop function if exists public.activar_contrato(uuid, uuid);
drop function if exists rrhh.fn_activar_contrato(uuid, uuid);

create function rrhh.fn_activar_contrato(
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
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.activar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.activar';
  end if;

  select estado, empleado_id into v_estado, v_empleado_id
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede activar un contrato en estado borrador';
  end if;

  if exists (select 1 from rrhh.contratos where empleado_id = v_empleado_id and estado = 'activo') then
    raise exception 'El empleado ya tiene un contrato activo';
  end if;

  update rrhh.contratos
  set estado = 'activo', activado_at = now(), activado_by = auth.uid()
  where id = p_contrato_id and company_id = p_company_id;

  v_pin := lpad(floor(random() * 10000)::text, 4, '0');

  insert into rrhh.contrato_credenciales (company_id, contrato_id, pin_hash, creado_by)
  values (p_company_id, p_contrato_id, crypt(v_pin, gen_salt('bf')), auth.uid());

  -- pin_kiosko se devuelve en texto plano UNA SOLA VEZ, aqui -- misma
  -- garantia que el fn_crear_empleado original (F1.0-era): no se puede
  -- recuperar despues, solo regenerar (rrhh.fn_regenerar_pin_contrato).
  return query select v_pin;
end;
$$;

comment on function rrhh.fn_activar_contrato(uuid, uuid) is
  'F1.3 (2026-09-07): activa un contrato borrador Y genera su PIN de asistencia (rrhh.contrato_credenciales), devuelto en texto plano UNA sola vez. Gateada por rrhh.expedientes.contratos.activar. Reemplaza la version F1.2 (solo transicion de estado, sin PIN).';

create function public.activar_contrato(p_contrato_id uuid, p_company_id uuid)
returns table (pin_kiosko text)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_activar_contrato(p_contrato_id, p_company_id);
$$;

revoke execute on function rrhh.fn_activar_contrato(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.activar_contrato(uuid, uuid) from PUBLIC, anon;
grant execute on function public.activar_contrato(uuid, uuid) to authenticated;

-- =============================================================================
-- rrhh.fn_finalizar_contrato: AHORA revoca la credencial. Retorno sigue
-- siendo void -- CREATE OR REPLACE alcanza, sin DROP.
-- =============================================================================
create or replace function rrhh.fn_finalizar_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_estado text;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.finalizar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.finalizar';
  end if;

  select estado into v_estado from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'activo' then
    raise exception 'Solo se puede finalizar un contrato activo';
  end if;

  update rrhh.contratos
  set estado = 'finalizado', finalizado_at = now(), finalizado_by = auth.uid(), fecha_fin_real = current_date
  where id = p_contrato_id and company_id = p_company_id;

  -- F1.3: revoca la credencial de asistencia -- sin nueva marcacion posible.
  update rrhh.contrato_credenciales
  set activo = false, revocado_at = now(), revocado_by = auth.uid()
  where contrato_id = p_contrato_id and activo = true;
end;
$$;

comment on function rrhh.fn_finalizar_contrato(uuid, uuid) is
  'F1.3 (2026-09-07): finaliza un contrato activo Y revoca su credencial de asistencia (rrhh.contrato_credenciales.activo = false). Gateada por rrhh.expedientes.contratos.finalizar.';

-- =============================================================================
-- rrhh.fn_regenerar_pin_contrato: nueva -- unico camino para regenerar
-- el PIN, solo sobre un contrato activo.
-- =============================================================================
create function rrhh.fn_regenerar_pin_contrato(
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
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.credenciales.regenerar') then
    raise exception 'Permiso denegado: rrhh.expedientes.credenciales.regenerar';
  end if;

  select estado into v_estado from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'activo' then
    raise exception 'Solo se puede regenerar el PIN de un contrato activo';
  end if;

  v_pin := lpad(floor(random() * 10000)::text, 4, '0');

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

comment on function rrhh.fn_regenerar_pin_contrato(uuid, uuid) is
  'F1.3 (2026-09-07): unico camino para regenerar el PIN de asistencia de un contrato -- exige contrato activo. Revoca el PIN anterior de inmediato (mismo campo pin_hash, sobreescrito). Devuelve el PIN en texto plano UNA sola vez. Gateada por rrhh.expedientes.credenciales.regenerar.';

create function public.regenerar_pin_contrato(p_contrato_id uuid, p_company_id uuid)
returns table (pin_kiosko text)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_regenerar_pin_contrato(p_contrato_id, p_company_id);
$$;

revoke execute on function rrhh.fn_regenerar_pin_contrato(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.regenerar_pin_contrato(uuid, uuid) from PUBLIC, anon;
grant execute on function public.regenerar_pin_contrato(uuid, uuid) to authenticated;

-- =============================================================================
-- rrhh.fn_estado_credencial_contrato: unico camino de lectura -- NUNCA
-- selecciona pin_hash. "ver" = estado, nunca el PIN.
-- =============================================================================
create function rrhh.fn_estado_credencial_contrato(
  p_contrato_id uuid,
  p_company_id uuid
)
returns table (tiene_credencial boolean, activo boolean, pin_bloqueado boolean, rotacion_numero int)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_row rrhh.contrato_credenciales%rowtype;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.credenciales.ver') then
    raise exception 'Permiso denegado: rrhh.expedientes.credenciales.ver';
  end if;

  if not exists (select 1 from rrhh.contratos where id = p_contrato_id and company_id = p_company_id) then
    raise exception 'Contrato no encontrado en esta empresa';
  end if;

  select * into v_row from rrhh.contrato_credenciales where contrato_id = p_contrato_id;

  if v_row.id is null then
    return query select false, false, false, 0;
  else
    return query select true, v_row.activo, v_row.pin_bloqueado, v_row.rotacion_numero;
  end if;
end;
$$;

comment on function rrhh.fn_estado_credencial_contrato(uuid, uuid) is
  'F1.3 (2026-09-07): unica forma de "ver" una credencial -- estado (activa/bloqueada/rotacion), NUNCA el pin_hash ni el PIN en texto plano (esta funcion ni siquiera lo selecciona). Gateada por rrhh.expedientes.credenciales.ver.';

create function public.estado_credencial_contrato(p_contrato_id uuid, p_company_id uuid)
returns table (tiene_credencial boolean, activo boolean, pin_bloqueado boolean, rotacion_numero int)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_estado_credencial_contrato(p_contrato_id, p_company_id);
$$;

revoke execute on function rrhh.fn_estado_credencial_contrato(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.estado_credencial_contrato(uuid, uuid) from PUBLIC, anon;
grant execute on function public.estado_credencial_contrato(uuid, uuid) to authenticated;

-- =============================================================================
-- rrhh.fn_registrar_marca_kiosko: MISMA firma, MISMO rate-limit, MISMA
-- logica anti-enumeracion e inferencia entrada/salida -- unico cambio es
-- de donde sale la credencial valida (contrato activo + su credencial,
-- en vez de rrhh.empleados.pin_hash/estado/pin_bloqueado).
-- =============================================================================
create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_rl rrhh.kiosko_rate_limits%rowtype;
  v_empleado_id uuid;
  v_ultimo_tipo text;
  v_tipo text;
  v_ahora timestamptz := now();
  v_marcado_en timestamptz;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    return;
  end if;

  insert into rrhh.kiosko_rate_limits (kiosko_id) values (p_kiosko_id)
    on conflict (kiosko_id) do nothing;

  select * into v_rl from rrhh.kiosko_rate_limits where kiosko_id = p_kiosko_id for update;

  if v_rl.bloqueado_hasta is not null and v_rl.bloqueado_hasta > v_ahora then
    return;
  end if;

  if v_ahora - v_rl.window_started_at > interval '1 minute' then
    update rrhh.kiosko_rate_limits
      set window_started_at = v_ahora,
          intentos_en_ventana = 0,
          bloqueado_hasta = null,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id
      returning * into v_rl;
  end if;

  -- F1.3: la credencial valida vive en rrhh.contrato_credenciales, unica
  -- por contrato ACTIVO del empleado (rrhh.contratos.estado = 'activo'
  -- ya garantiza como maximo un contrato activo por empleado). Ya NO se
  -- lee rrhh.empleados.pin_hash/estado/pin_bloqueado (deprecados F1.1).
  select c.empleado_id into v_empleado_id
  from rrhh.contrato_credenciales cc
  join rrhh.contratos c on c.id = cc.contrato_id
  where c.company_id = v_kiosko.company_id
    and c.estado = 'activo'
    and cc.activo = true
    and not cc.pin_bloqueado
    and crypt(p_pin, cc.pin_hash) = cc.pin_hash
  limit 1;

  if v_empleado_id is null then
    update rrhh.kiosko_rate_limits
      set intentos_en_ventana = intentos_en_ventana + 1,
          bloqueado_hasta = case
            when intentos_en_ventana + 1 >= 8 then v_ahora + interval '5 minutes'
            else bloqueado_hasta
          end,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id;

    return;
  end if;

  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0,
        bloqueado_hasta = null,
        updated_at = v_ahora
    where kiosko_id = p_kiosko_id;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.empleado_id = v_empleado_id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;
  v_marcado_en := v_ahora;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado_id, p_kiosko_id, v_tipo, v_marcado_en, 'kiosko');

  return query select v_tipo, v_marcado_en;
end;
$$;

comment on function rrhh.fn_registrar_marca_kiosko is
  'F1.3 (2026-09-07): reescrita para validar contra rrhh.contrato_credenciales + rrhh.contratos.estado=''activo'' en vez de rrhh.empleados.pin_hash/estado/pin_bloqueado (deprecados desde F1.1). Misma firma, mismo rate-limit persistente (rrhh.kiosko_rate_limits), misma logica anti-enumeracion (RETURN, nunca RAISE EXCEPTION) e inferencia de entrada/salida.';
