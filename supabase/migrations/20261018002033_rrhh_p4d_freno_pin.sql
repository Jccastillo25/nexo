-- P4d: cierra el salto del freno de PIN (revisión independiente de P4c,
-- 2026-10-17, hallazgo #2) y adopta search_path vacío (hallazgo #7).
--
-- Problema: en P4b/P4c un PIN válido ponía intentos_en_ventana = 0. Quien
-- conoce un PIN válido (el suyo) podía alternar 7 PINes ajenos con 1 envío
-- con su PIN y no llegar nunca al bloqueo (8 inválidos/min → 5 min). Además,
-- las confirmaciones que terminan sin marca (sin_acciones,
-- accion_no_disponible, revision) no contaban en ningún límite.
--
-- Cambios (solo rrhh.fn_registrar_marca_kiosko; misma firma, grants y
-- wrappers sin cambios):
--   1. Un PIN válido ya NO reinicia intentos_en_ventana: los inválidos solo se
--      reinician al cambiar la ventana de 1 minuto.
--   2. previas_en_ventana cuenta todo envío con PIN válido que no registra una
--      marca: vistas previas y confirmaciones rechazadas con motivo. 30 por
--      minuto bloquean el kiosco 5 minutos (igual que P4c para las previas).
--   3. set search_path = '' con nombres calificados (extensions.crypt).
--
-- Rollback: volver a crear la función con el cuerpo de
-- 20261017233458_rrhh_p4c_marcas_descanso.sql.

do $$
begin
  if to_regprocedure('rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text)') is null then
    raise exception 'precheck: falta fn_registrar_marca_kiosko con la firma de P4c';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='rrhh' and table_name='kiosko_rate_limits' and column_name='previas_en_ventana') then
    raise exception 'precheck: falta kiosko_rate_limits.previas_en_ventana (P4c)';
  end if;
end;
$$;

create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid, p_solicitud_id uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 c_max_invalidos constant integer := 8;
 c_max_sin_marca constant integer := 30;
 v_kiosko rrhh.kiosko_dispositivos%rowtype;
 v_rl rrhh.kiosko_rate_limits%rowtype;
 v_contratos uuid[]; v_empleados uuid[]; v_coincidencias integer;
 v_contrato uuid; v_empleado uuid; v_estado text;
 v_ahora timestamptz; v_fecha date; v_inicio timestamptz; v_fin timestamptz;
 v_seq text[]; v_acciones text[]; v_motivo text;
 v_respuesta jsonb := '{"estado":"rechazada"}'::jsonb;
begin
 if p_solicitud_id is null or p_pin is null or p_pin !~ '^[0-9]{4}$'
    or (p_accion is not null and p_accion not in ('entrada','inicio_descanso','fin_descanso','salida')) then
  return v_respuesta;
 end if;
 select * into v_kiosko from rrhh.kiosko_dispositivos where id=p_kiosko_id for share;
 if not found or not v_kiosko.activo then return v_respuesta; end if;
 perform pg_advisory_xact_lock(76108,hashtext(p_solicitud_id::text));
 select s.respuesta into v_respuesta from rrhh.kiosko_solicitudes s
 where s.solicitud_id=p_solicitud_id and s.kiosko_id=p_kiosko_id;
 if found then return v_respuesta; end if;
 v_respuesta := '{"estado":"rechazada"}'::jsonb;
 v_ahora := clock_timestamp();

 <<procesar>>
 begin
  insert into rrhh.kiosko_rate_limits(kiosko_id) values(p_kiosko_id) on conflict(kiosko_id) do nothing;
  select * into v_rl from rrhh.kiosko_rate_limits where kiosko_id=p_kiosko_id for update;
  v_ahora := clock_timestamp();
  if v_rl.bloqueado_hasta is not null and v_rl.bloqueado_hasta>v_ahora then exit procesar; end if;
  if v_ahora-v_rl.window_started_at>interval '1 minute' then
   update rrhh.kiosko_rate_limits set window_started_at=v_ahora,intentos_en_ventana=0,previas_en_ventana=0,
    bloqueado_hasta=null,updated_at=v_ahora where kiosko_id=p_kiosko_id returning * into v_rl;
  end if;
  select array_agg(c.id),array_agg(c.empleado_id),count(*)
  into v_contratos,v_empleados,v_coincidencias
  from rrhh.contrato_credenciales cc join rrhh.contratos c on c.id=cc.contrato_id
  where c.company_id=v_kiosko.company_id and c.estado='activo' and cc.activo and not cc.pin_bloqueado
    and extensions.crypt(p_pin,cc.pin_hash)=cc.pin_hash;
  if v_coincidencias<>1 then
   if v_coincidencias>1 then
    raise warning 'rrhh.kiosko: PIN ambiguo rechazado (fallo cerrado) — kiosko_id=%, company_id=%, credenciales_vigentes_coincidentes=%',
     p_kiosko_id,v_kiosko.company_id,v_coincidencias;
   end if;
   update rrhh.kiosko_rate_limits set intentos_en_ventana=intentos_en_ventana+1,
    bloqueado_hasta=case when intentos_en_ventana+1>=c_max_invalidos then v_ahora+interval '5 minutes' else bloqueado_hasta end,
    updated_at=v_ahora where kiosko_id=p_kiosko_id;
   exit procesar;
  end if;
  v_contrato:=v_contratos[1]; v_empleado:=v_empleados[1];
  -- Coordinar con finalizar/regenerar: revalidar bajo lock contractual, en orden
  -- contrato -> credencial, antes de insertar; no marcar una credencial revocada.
  select estado into v_estado from rrhh.contratos
   where id=v_contrato and company_id=v_kiosko.company_id for share;
  if v_estado<>'activo' then exit procesar; end if;
  perform 1 from rrhh.contrato_credenciales cc where cc.contrato_id=v_contrato
   and cc.company_id=v_kiosko.company_id and cc.activo and not cc.pin_bloqueado
   and extensions.crypt(p_pin,cc.pin_hash)=cc.pin_hash for share;
  if not found then exit procesar; end if;
  -- P4d: un PIN válido ya no reinicia intentos_en_ventana.
  loop
   v_ahora:=clock_timestamp(); v_fecha:=(v_ahora at time zone 'America/Managua')::date;
   perform pg_advisory_xact_lock(76107,hashtext(v_contrato::text||':'||v_fecha::text));
   v_ahora:=clock_timestamp();
   exit when (v_ahora at time zone 'America/Managua')::date=v_fecha;
  end loop;
  v_inicio:=v_fecha::timestamp at time zone 'America/Managua';
  v_fin:=(v_fecha+1)::timestamp at time zone 'America/Managua';
  select coalesce(array_agg(am.tipo order by am.marcado_en, am.id), '{}') into v_seq
   from rrhh.asistencia_marcas am
   where am.contrato_id=v_contrato and am.company_id=v_kiosko.company_id
    and am.marcado_en>=v_inicio and am.marcado_en<v_fin;
  if v_seq = '{}'::text[] then
   v_acciones := array['entrada'];
  elsif v_seq = array['entrada'] then
   v_acciones := array['inicio_descanso','salida'];
  elsif v_seq = array['entrada','inicio_descanso'] then
   v_acciones := array['fin_descanso'];
  elsif v_seq = array['entrada','inicio_descanso','fin_descanso'] then
   v_acciones := array['salida'];
  elsif v_seq = array['entrada','salida'] or v_seq = array['entrada','inicio_descanso','fin_descanso','salida'] then
   v_acciones := '{}'; v_motivo := 'sin_acciones';
  else
   v_acciones := '{}'; v_motivo := 'revision';
  end if;
  if v_motivo is null and p_accion is not null and not (p_accion = any(v_acciones)) then
   v_motivo := 'accion_no_disponible';
  end if;
  -- P4d: todo envío con PIN válido que no registra marca (vista previa o
  -- confirmación rechazada) cuenta; 30 por minuto bloquean 5 minutos.
  if p_accion is null or v_motivo is not null then
   update rrhh.kiosko_rate_limits set previas_en_ventana=previas_en_ventana+1,
    bloqueado_hasta=case when previas_en_ventana+1>=c_max_sin_marca then v_ahora+interval '5 minutes' else bloqueado_hasta end,
    updated_at=v_ahora where kiosko_id=p_kiosko_id;
  end if;
  if v_motivo is not null then
   v_respuesta := jsonb_build_object('estado','rechazada','motivo',v_motivo);
   exit procesar;
  end if;
  if p_accion is null then
   -- Vista previa: no se guarda; el commit usa el mismo p_solicitud_id.
   return jsonb_build_object('estado','acciones','acciones',to_jsonb(v_acciones));
  end if;
  insert into rrhh.asistencia_marcas(company_id,empleado_id,kiosko_id,contrato_id,tipo,marcado_en,origen)
   values(v_kiosko.company_id,v_empleado,p_kiosko_id,v_contrato,p_accion,v_ahora,'kiosko');
  v_respuesta:=jsonb_build_object('estado','registrada','tipo',p_accion,'marcado_en',v_ahora);
 end procesar;
 insert into rrhh.kiosko_solicitudes(solicitud_id,company_id,kiosko_id,fecha_local,resultado,respuesta)
 values(p_solicitud_id,v_kiosko.company_id,p_kiosko_id,(v_ahora at time zone 'America/Managua')::date,
  v_respuesta->>'estado',v_respuesta);
 return v_respuesta;
end $$;

-- create or replace conserva los privilegios; se reafirman.
revoke execute on function rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text) from public, anon, authenticated;

do $$
declare v_def text := pg_get_functiondef('rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text)'::regprocedure);
begin
  if has_function_privilege('anon', 'rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text)', 'execute') then
    raise exception 'postcheck: la función interna quedó ejecutable por anon';
  end if;
  if not has_function_privilege('anon', 'public.registrar_marca_kiosko(text,uuid,uuid,text)', 'execute')
     or not has_function_privilege('anon', 'public.registrar_marca_terminal(text,text,uuid,text)', 'execute') then
    raise exception 'postcheck: la terminal (anon) ya no puede marcar';
  end if;
  -- El único reinicio de intentos que queda es el del cambio de ventana.
  if position('set intentos_en_ventana=0' in v_def) > 0 then
    raise exception 'postcheck: el PIN válido sigue reiniciando los intentos';
  end if;
  if v_def not like '%search_path TO ''''%' then
    raise exception 'postcheck: search_path no quedó vacío';
  end if;
end;
$$;
