-- Enrolamiento de terminales de kiosco (app Asistencia). Aprobado por el
-- usuario 2026-10-17, junto con el Paso Cero 20261017200000:
--   - código de 10 dígitos, un solo uso, vence en 10 minutos;
--   - el código se canjea en la terminal por un token (256 bits) que la app
--     guarda en una cookie httpOnly; en la base solo hay hashes;
--   - desactivar un dispositivo conserva el token (no es revocar);
--   - el token no vence: vale hasta que se revoque o se asigne otro equipo;
--   - la terminal muestra el nombre del dispositivo.
-- Especificación: docs/status-log/2026-10-17-asistencia-app.md.
--
-- Convive con NEXO_KIOSKO_ID: public.registrar_marca_kiosko queda igual. La
-- migración de cierre (cuando el usuario retire la env) revoca su EXECUTE a
-- anon/authenticated, que es el hallazgo H5 de la revisión de seguridad.
--
-- kiosko_credenciales es estado operativo (una fila por dispositivo, se
-- actualiza en sitio), no un hecho: no se particiona. Los eventos van a
-- core.audit_log (particionada) sin código ni token.
--
-- Rollback (sin datos que conservar: los equipos vuelven a la env):
--   drop function public.asistencia_generar_codigo_terminal(uuid,uuid);
--   drop function public.canjear_codigo_terminal(text);
--   drop function public.estado_terminal(text);
--   drop function public.registrar_marca_terminal(text,text,uuid,boolean);
--   drop function public.asistencia_revocar_terminal(uuid,uuid);
--   drop function public.asistencia_estado_terminales(uuid);
--   drop function rrhh.fn_generar_codigo_terminal(uuid,uuid);
--   drop function rrhh.fn_canjear_codigo_terminal(text);
--   drop function rrhh.fn_estado_terminal(text);
--   drop function rrhh.fn_registrar_marca_terminal(text,text,uuid,boolean);
--   drop function rrhh.fn_revocar_terminal(uuid,uuid);
--   drop function rrhh.fn_estado_terminales(uuid);
--   drop table rrhh.kiosko_canje_limites;
--   drop table rrhh.kiosko_credenciales;

do $$
begin
  if to_regclass('rrhh.kiosko_credenciales') is not null
     or to_regclass('rrhh.kiosko_canje_limites') is not null then
    raise exception 'precheck: las tablas de enrolamiento ya existen';
  end if;
  if (select count(*) from core.permissions_catalog
      where code in ('rrhh.asistencia.kioskos.asignar','rrhh.asistencia.kioskos.revocar')) <> 2 then
    raise exception 'precheck: falta el Paso Cero 20261017200000 (permisos asignar/revocar)';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'precheck: falta pgcrypto';
  end if;
end;
$$;

-- ---------------------------------------------------------------- tablas

create table rrhh.kiosko_credenciales (
  kiosko_id           uuid primary key references rrhh.kiosko_dispositivos(id) on delete cascade,
  company_id          uuid not null references core.companies(id),
  codigo_hash         bytea,
  codigo_vence_en     timestamptz,
  codigo_generado_por uuid references auth.users(id) on delete set null,
  codigo_generado_en  timestamptz,
  token_hash          bytea,
  token_emitido_en    timestamptz,
  token_emitido_por   uuid references auth.users(id) on delete set null,
  ultimo_uso_en       timestamptz,
  revocado_en         timestamptz,
  revocado_por        uuid references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now(),
  constraint kiosko_credenciales_codigo_completo
    check ((codigo_hash is null) = (codigo_vence_en is null))
);
create unique index kiosko_credenciales_codigo_idx on rrhh.kiosko_credenciales(codigo_hash)
  where codigo_hash is not null;
create unique index kiosko_credenciales_token_idx on rrhh.kiosko_credenciales(token_hash)
  where token_hash is not null;
create index kiosko_credenciales_company_idx on rrhh.kiosko_credenciales(company_id);
create index kiosko_credenciales_generado_por_idx on rrhh.kiosko_credenciales(codigo_generado_por);
create index kiosko_credenciales_emitido_por_idx on rrhh.kiosko_credenciales(token_emitido_por);
create index kiosko_credenciales_revocado_por_idx on rrhh.kiosko_credenciales(revocado_por);
alter table rrhh.kiosko_credenciales enable row level security;
revoke all on rrhh.kiosko_credenciales from public, anon, authenticated;

-- Límite global de canjes fallidos: con un código inválido no se sabe de qué
-- empresa es, así que el freno es uno solo. Solo frena la asignación de
-- equipos, nunca la marcación.
create table rrhh.kiosko_canje_limites (
  id                smallint primary key default 1 check (id = 1),
  window_started_at timestamptz not null default now(),
  fallos_en_ventana integer not null default 0,
  bloqueado_hasta   timestamptz,
  updated_at        timestamptz not null default now()
);
insert into rrhh.kiosko_canje_limites (id) values (1);
alter table rrhh.kiosko_canje_limites enable row level security;
revoke all on rrhh.kiosko_canje_limites from public, anon, authenticated;

-- ---------------------------------------------------------------- internas

-- Generar código (authenticated, rrhh.asistencia.kioskos.asignar).
-- Reemplaza un código pendiente; no toca el token vigente (el equipo actual
-- sigue marcando hasta que se canjee el código nuevo).
create function rrhh.fn_generar_codigo_terminal(p_company_id uuid, p_kiosko_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_bytes  bytea;
  v_valor  bigint;
  v_codigo text;
  v_vence  timestamptz;
  v_intento integer := 0;
begin
  if p_company_id is null or p_kiosko_id is null
     or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.kioskos.asignar') then
    return '{"estado":"denegado"}'::jsonb;
  end if;
  select * into v_kiosko from rrhh.kiosko_dispositivos
   where id = p_kiosko_id and company_id = p_company_id for update;
  if not found then return '{"estado":"no_encontrado"}'::jsonb; end if;
  if not v_kiosko.activo then return '{"estado":"inactivo"}'::jsonb; end if;

  -- Limpieza perezosa de códigos vencidos (de cualquier empresa).
  update rrhh.kiosko_credenciales
     set codigo_hash = null, codigo_vence_en = null, updated_at = now()
   where codigo_vence_en is not null and codigo_vence_en <= now();

  v_vence := now() + interval '10 minutes';
  loop
    v_intento := v_intento + 1;
    -- 10 dígitos uniformes: 40 bits aleatorios con muestreo por rechazo
    -- (109 * 10^10 es el mayor múltiplo de 10^10 que cabe en 2^40).
    loop
      v_bytes := extensions.gen_random_bytes(5);
      v_valor := ('x' || encode(v_bytes, 'hex'))::bit(40)::bigint;
      exit when v_valor < 1090000000000;
    end loop;
    v_codigo := lpad((v_valor % 10000000000)::text, 10, '0');
    begin
      insert into rrhh.kiosko_credenciales
        (kiosko_id, company_id, codigo_hash, codigo_vence_en, codigo_generado_por, codigo_generado_en, updated_at)
      values
        (p_kiosko_id, p_company_id, extensions.digest(v_codigo, 'sha256'), v_vence, auth.uid(), now(), now())
      on conflict (kiosko_id) do update
        set codigo_hash = excluded.codigo_hash,
            codigo_vence_en = excluded.codigo_vence_en,
            codigo_generado_por = excluded.codigo_generado_por,
            codigo_generado_en = excluded.codigo_generado_en,
            updated_at = excluded.updated_at;
      exit;
    exception when unique_violation then
      -- Colisión con otro código vivo (improbable): se genera otro.
      if v_intento >= 5 then return '{"estado":"error"}'::jsonb; end if;
    end;
  end loop;

  perform core.fn_auditar(auth.uid(), p_company_id, 'asistencia.terminal.codigo_generado',
    'rrhh.kiosko_dispositivos', p_kiosko_id::text, jsonb_build_object('vence_en', v_vence));
  return jsonb_build_object('estado', 'generado', 'codigo', v_codigo, 'vence_en', v_vence);
end $$;

-- Canjear código (anon, desde la terminal). Respuesta idéntica para código
-- inexistente, vencido, usado, de formato inválido o de un dispositivo
-- inactivo; 20 fallos en 10 minutos bloquean el canje 15 minutos.
create function rrhh.fn_canjear_codigo_terminal(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lim    rrhh.kiosko_canje_limites%rowtype;
  v_codigo text := regexp_replace(coalesce(p_codigo, ''), '[[:space:]-]', '', 'g');
  v_cred   rrhh.kiosko_credenciales%rowtype;
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_token  text;
  v_ahora  timestamptz := clock_timestamp();
begin
  select * into v_lim from rrhh.kiosko_canje_limites where id = 1 for update;
  if v_lim.bloqueado_hasta is not null and v_lim.bloqueado_hasta > v_ahora then
    return '{"estado":"limitado"}'::jsonb;
  end if;
  if v_ahora - v_lim.window_started_at > interval '10 minutes' then
    update rrhh.kiosko_canje_limites
       set window_started_at = v_ahora, fallos_en_ventana = 0, bloqueado_hasta = null, updated_at = v_ahora
     where id = 1;
  end if;

  if v_codigo ~ '^[0-9]{10}$' then
    select c.* into v_cred from rrhh.kiosko_credenciales c
     where c.codigo_hash = extensions.digest(v_codigo, 'sha256')
       and c.codigo_vence_en > v_ahora
     for update;
    if found then
      select * into v_kiosko from rrhh.kiosko_dispositivos
       where id = v_cred.kiosko_id and company_id = v_cred.company_id;
    end if;
  end if;

  if v_cred.kiosko_id is null or v_kiosko.id is null or not v_kiosko.activo then
    update rrhh.kiosko_canje_limites
       set fallos_en_ventana = fallos_en_ventana + 1,
           bloqueado_hasta = case when fallos_en_ventana + 1 >= 20
                                  then v_ahora + interval '15 minutes' else bloqueado_hasta end,
           updated_at = v_ahora
     where id = 1;
    return '{"estado":"rechazado"}'::jsonb;
  end if;

  v_token := 'nxk_' || translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');
  update rrhh.kiosko_credenciales
     set codigo_hash = null, codigo_vence_en = null,
         token_hash = extensions.digest(v_token, 'sha256'),
         token_emitido_en = v_ahora,
         token_emitido_por = v_cred.codigo_generado_por,
         ultimo_uso_en = null, revocado_en = null, revocado_por = null,
         updated_at = v_ahora
   where kiosko_id = v_cred.kiosko_id;

  perform core.fn_auditar(v_cred.codigo_generado_por, v_cred.company_id, 'asistencia.terminal.asignada',
    'rrhh.kiosko_dispositivos', v_cred.kiosko_id::text, '{}'::jsonb);
  return jsonb_build_object('estado', 'asignada', 'token', v_token, 'nombre', v_kiosko.nombre);
end $$;

-- Estado de la terminal según su token (anon, al cargar /kiosco).
create function rrhh.fn_estado_terminal(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cred   rrhh.kiosko_credenciales%rowtype;
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
begin
  if p_token is null or p_token !~ '^nxk_[A-Za-z0-9_-]{43}$' then
    return '{"estado":"sin_asignar"}'::jsonb;
  end if;
  select * into v_cred from rrhh.kiosko_credenciales
   where token_hash = extensions.digest(p_token, 'sha256');
  if not found then return '{"estado":"sin_asignar"}'::jsonb; end if;
  select * into v_kiosko from rrhh.kiosko_dispositivos
   where id = v_cred.kiosko_id and company_id = v_cred.company_id;
  if not found then return '{"estado":"sin_asignar"}'::jsonb; end if;
  if not v_kiosko.activo then
    return jsonb_build_object('estado', 'no_disponible', 'nombre', v_kiosko.nombre);
  end if;
  update rrhh.kiosko_credenciales set ultimo_uso_en = now()
   where kiosko_id = v_cred.kiosko_id
     and (ultimo_uso_en is null or ultimo_uso_en < now() - interval '5 minutes');
  return jsonb_build_object('estado', 'asignada', 'nombre', v_kiosko.nombre);
end $$;

-- Marcar con token (anon). Resuelve el dispositivo y delega en la función de
-- P4b sin duplicar su lógica (rate limit por kiosco, idempotencia,
-- confirmación de salida). Un token desconocido o revocado se distingue
-- ("terminal_no_autorizada") porque no es enumerable.
create function rrhh.fn_registrar_marca_terminal(p_token text, p_pin text, p_solicitud_id uuid, p_confirmar_salida boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_kiosko_id uuid;
begin
  if p_token is null or p_token !~ '^nxk_[A-Za-z0-9_-]{43}$' then
    return '{"estado":"terminal_no_autorizada"}'::jsonb;
  end if;
  select kiosko_id into v_kiosko_id from rrhh.kiosko_credenciales
   where token_hash = extensions.digest(p_token, 'sha256');
  if not found then return '{"estado":"terminal_no_autorizada"}'::jsonb; end if;
  update rrhh.kiosko_credenciales set ultimo_uso_en = now()
   where kiosko_id = v_kiosko_id
     and (ultimo_uso_en is null or ultimo_uso_en < now() - interval '5 minutes');
  return rrhh.fn_registrar_marca_kiosko(p_pin, v_kiosko_id, p_solicitud_id, p_confirmar_salida);
end $$;

-- Revocar el equipo o cancelar el código pendiente (authenticated,
-- rrhh.asistencia.kioskos.revocar). Idempotente.
create function rrhh.fn_revocar_terminal(p_company_id uuid, p_kiosko_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cred rrhh.kiosko_credenciales%rowtype;
  v_accion text;
begin
  if p_company_id is null or p_kiosko_id is null
     or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.kioskos.revocar') then
    return '{"estado":"denegado"}'::jsonb;
  end if;
  perform 1 from rrhh.kiosko_dispositivos where id = p_kiosko_id and company_id = p_company_id;
  if not found then return '{"estado":"no_encontrado"}'::jsonb; end if;

  select * into v_cred from rrhh.kiosko_credenciales
   where kiosko_id = p_kiosko_id and company_id = p_company_id for update;
  if not found or (v_cred.token_hash is null and v_cred.codigo_hash is null) then
    return '{"estado":"revocada"}'::jsonb;
  end if;

  if v_cred.token_hash is not null then
    v_accion := 'asistencia.terminal.revocada';
    update rrhh.kiosko_credenciales
       set token_hash = null, codigo_hash = null, codigo_vence_en = null,
           revocado_en = now(), revocado_por = auth.uid(), updated_at = now()
     where kiosko_id = p_kiosko_id;
  else
    v_accion := 'asistencia.terminal.codigo_cancelado';
    update rrhh.kiosko_credenciales
       set codigo_hash = null, codigo_vence_en = null, updated_at = now()
     where kiosko_id = p_kiosko_id;
  end if;

  perform core.fn_auditar(auth.uid(), p_company_id, v_accion,
    'rrhh.kiosko_dispositivos', p_kiosko_id::text, '{}'::jsonb);
  return '{"estado":"revocada"}'::jsonb;
end $$;

-- Estado de los equipos de todos los dispositivos de la empresa
-- (authenticated, rrhh.asistencia.kioskos.ver). Nunca devuelve hashes.
create function rrhh.fn_estado_terminales(p_company_id uuid)
returns table (kiosko_id uuid, estado text, codigo_vence_en timestamptz,
               token_emitido_en timestamptz, ultimo_uso_en timestamptz, revocado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_company_id is null
     or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.kioskos.ver') then
    raise exception 'Permiso denegado: rrhh.asistencia.kioskos.ver' using errcode = '42501';
  end if;
  return query
  select d.id,
         case when c.token_hash is not null then 'asignada'
              when c.codigo_hash is not null and c.codigo_vence_en > now() then 'codigo_pendiente'
              else 'sin_asignar' end,
         case when c.codigo_vence_en > now() then c.codigo_vence_en end,
         case when c.token_hash is not null then c.token_emitido_en end,
         case when c.token_hash is not null then c.ultimo_uso_en end,
         c.revocado_en
    from rrhh.kiosko_dispositivos d
    left join rrhh.kiosko_credenciales c on c.kiosko_id = d.id and c.company_id = d.company_id
   where d.company_id = p_company_id;
end $$;

revoke execute on function rrhh.fn_generar_codigo_terminal(uuid,uuid) from public, anon, authenticated;
revoke execute on function rrhh.fn_canjear_codigo_terminal(text) from public, anon, authenticated;
revoke execute on function rrhh.fn_estado_terminal(text) from public, anon, authenticated;
revoke execute on function rrhh.fn_registrar_marca_terminal(text,text,uuid,boolean) from public, anon, authenticated;
revoke execute on function rrhh.fn_revocar_terminal(uuid,uuid) from public, anon, authenticated;
revoke execute on function rrhh.fn_estado_terminales(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- wrappers

create function public.asistencia_generar_codigo_terminal(p_company_id uuid, p_kiosko_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_generar_codigo_terminal(p_company_id, p_kiosko_id);
$$;
create function public.canjear_codigo_terminal(p_codigo text)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_canjear_codigo_terminal(p_codigo);
$$;
create function public.estado_terminal(p_token text)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_estado_terminal(p_token);
$$;
create function public.registrar_marca_terminal(p_token text, p_pin text, p_solicitud_id uuid, p_confirmar_salida boolean)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_registrar_marca_terminal(p_token, p_pin, p_solicitud_id, p_confirmar_salida);
$$;
create function public.asistencia_revocar_terminal(p_company_id uuid, p_kiosko_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_revocar_terminal(p_company_id, p_kiosko_id);
$$;
create function public.asistencia_estado_terminales(p_company_id uuid)
returns table (kiosko_id uuid, estado text, codigo_vence_en timestamptz,
               token_emitido_en timestamptz, ultimo_uso_en timestamptz, revocado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from rrhh.fn_estado_terminales(p_company_id);
$$;

revoke execute on function public.asistencia_generar_codigo_terminal(uuid,uuid) from public, anon;
revoke execute on function public.canjear_codigo_terminal(text) from public;
revoke execute on function public.estado_terminal(text) from public;
revoke execute on function public.registrar_marca_terminal(text,text,uuid,boolean) from public;
revoke execute on function public.asistencia_revocar_terminal(uuid,uuid) from public, anon;
revoke execute on function public.asistencia_estado_terminales(uuid) from public, anon;

grant execute on function public.asistencia_generar_codigo_terminal(uuid,uuid) to authenticated;
grant execute on function public.canjear_codigo_terminal(text) to anon, authenticated;
grant execute on function public.estado_terminal(text) to anon, authenticated;
grant execute on function public.registrar_marca_terminal(text,text,uuid,boolean) to anon, authenticated;
grant execute on function public.asistencia_revocar_terminal(uuid,uuid) to authenticated;
grant execute on function public.asistencia_estado_terminales(uuid) to authenticated;

-- ---------------------------------------------------------------- postchecks
do $$
begin
  if has_table_privilege('anon', 'rrhh.kiosko_credenciales', 'select')
     or has_table_privilege('authenticated', 'rrhh.kiosko_credenciales', 'select')
     or has_table_privilege('anon', 'rrhh.kiosko_canje_limites', 'select')
     or has_table_privilege('authenticated', 'rrhh.kiosko_canje_limites', 'select') then
    raise exception 'postcheck: las tablas de enrolamiento quedaron legibles por la API';
  end if;
  if has_function_privilege('anon', 'rrhh.fn_canjear_codigo_terminal(text)', 'execute')
     or has_function_privilege('authenticated', 'rrhh.fn_generar_codigo_terminal(uuid,uuid)', 'execute') then
    raise exception 'postcheck: una función interna quedó ejecutable por la API';
  end if;
  if has_function_privilege('anon', 'public.asistencia_generar_codigo_terminal(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.asistencia_revocar_terminal(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.asistencia_estado_terminales(uuid)', 'execute') then
    raise exception 'postcheck: una RPC administrativa quedó abierta a anon';
  end if;
  if not has_function_privilege('anon', 'public.canjear_codigo_terminal(text)', 'execute')
     or not has_function_privilege('anon', 'public.registrar_marca_terminal(text,text,uuid,boolean)', 'execute') then
    raise exception 'postcheck: la terminal (anon) no puede canjear o marcar';
  end if;
end;
$$;
