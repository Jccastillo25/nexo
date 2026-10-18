-- M3 de la revisión del enrolamiento (2026-10-17): el límite global de canjes
-- fallidos (20 en 10 min → bloqueo de 15 min) permitía a cualquiera, con unas
-- 20 llamadas anónimas cada ~25 min, mantener bloqueada la asignación de
-- equipos para todas las empresas. Pedido del usuario: "subir el umbral a
-- unos cientos y auditar los bloqueos".
--
-- Cambios (solo rrhh.fn_canjear_codigo_terminal; firma, grants y wrapper
-- public.canjear_codigo_terminal sin cambios):
--   - umbral: 300 fallos en la ventana de 10 min (antes 20); bloqueo de 15 min
--     sin cambios. Seguridad frente a fuerza bruta: con 10^10 códigos posibles y
--     pocos vivos durante 10 min, 300 intentos dan una probabilidad de acierto
--     del orden de 10^-8 por código vivo y ventana.
--   - auditoría: al activarse un bloqueo se registra una sola vez
--     'asistencia.terminal.canje_bloqueado' en core.audit_log (sin código ni
--     IP; company_id nulo porque el límite es global), con el número de fallos
--     y el fin del bloqueo.
--
-- Desbloqueo administrativo (SQL Editor, rol con acceso al schema rrhh):
--   update rrhh.kiosko_canje_limites
--      set fallos_en_ventana = 0, bloqueado_hasta = null,
--          window_started_at = now(), updated_at = now()
--    where id = 1;
--
-- Rollback: volver a crear la función con el cuerpo de
-- 20261017180853_asistencia_enrolamiento_terminales.sql (umbral 20, sin
-- auditoría de bloqueo).

do $$
begin
  if to_regprocedure('rrhh.fn_canjear_codigo_terminal(text)') is null then
    raise exception 'precheck: falta rrhh.fn_canjear_codigo_terminal (migración 20261017180853)';
  end if;
  if to_regprocedure('core.fn_auditar(uuid,uuid,text,text,text,jsonb)') is null then
    raise exception 'precheck: falta core.fn_auditar';
  end if;
end;
$$;

create or replace function rrhh.fn_canjear_codigo_terminal(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_umbral constant integer := 300;
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
           bloqueado_hasta = case when fallos_en_ventana + 1 >= c_umbral
                                  then v_ahora + interval '15 minutes' else bloqueado_hasta end,
           updated_at = v_ahora
     where id = 1
     returning * into v_lim;
    -- Se audita una sola vez: en el fallo que activa el bloqueo.
    if v_lim.fallos_en_ventana = c_umbral then
      perform core.fn_auditar(null, null, 'asistencia.terminal.canje_bloqueado',
        'rrhh.kiosko_canje_limites', '1',
        jsonb_build_object('fallos_en_ventana', v_lim.fallos_en_ventana,
                           'ventana_desde', v_lim.window_started_at,
                           'bloqueado_hasta', v_lim.bloqueado_hasta));
    end if;
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

-- create or replace conserva los privilegios; se reafirma por si acaso.
revoke execute on function rrhh.fn_canjear_codigo_terminal(text) from public, anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'rrhh.fn_canjear_codigo_terminal(text)', 'execute')
     or has_function_privilege('authenticated', 'rrhh.fn_canjear_codigo_terminal(text)', 'execute') then
    raise exception 'postcheck: la función interna quedó ejecutable por la API';
  end if;
  if not has_function_privilege('anon', 'public.canjear_codigo_terminal(text)', 'execute') then
    raise exception 'postcheck: la terminal (anon) ya no puede canjear';
  end if;
  if position('c_umbral constant integer := 300' in pg_get_functiondef('rrhh.fn_canjear_codigo_terminal(text)'::regprocedure)) = 0 then
    raise exception 'postcheck: el umbral no quedó en 300';
  end if;
end;
$$;
