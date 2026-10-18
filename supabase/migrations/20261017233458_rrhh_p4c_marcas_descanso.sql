-- P4c: descanso en las marcas del kiosco. Decisión del usuario 2026-10-17,
-- antes del piloto P7 (cambia el corte aprobado el 2026-10-15, que tenía un
-- solo par entrada/salida sin descanso marcado):
--   - cuatro tipos: entrada, inicio_descanso, fin_descanso, salida;
--   - un descanso por día (contrato + día local America/Managua);
--   - secuencias válidas: entrada → [inicio_descanso → fin_descanso] → salida;
--   - con el descanso abierto no se puede marcar salida (primero se termina);
--   - el descanso es opcional: salir sin descanso es válido. El descanso no
--     marcado se resolverá en el cálculo de horas (F1.5) descontando el
--     programado de la jornada; aquí solo se informa "sin_descanso_marcado";
--   - la persona elige la acción con botones después del PIN: la RPC pasa de
--     `p_confirmar_salida boolean` a `p_accion text`. Con `p_accion` nulo es
--     una vista previa que devuelve las acciones válidas sin escribir marcas;
--     el botón es la confirmación (mismo `p_solicitud_id`);
--   - D7: las vistas previas con PIN válido cuentan en el límite del kiosco
--     (30 por minuto bloquean 5 min), para que nadie pueda probar PINs válidos
--     sin dejar rastro ni freno.
-- Especificación: docs/status-log/2026-10-17-asistencia-app.md.
--
-- El cliente anterior (p_confirmar_salida) falla cerrado: la firma vieja deja
-- de existir y PostgREST no la encuentra. Se publica junto con el cliente
-- nuevo en el push único; todavía no hay marcas reales.
--
-- Rollback: volver a crear las funciones de
-- 20261017131202_rrhh_p4b_marca_atomica_idempotente.sql y de
-- 20261017180853_asistencia_enrolamiento_terminales.sql (firma con
-- p_confirmar_salida), fn_consultar_marcas de 20261017131221, el check
-- ('entrada','salida') si no hay marcas de descanso, y quitar la columna
-- previas_en_ventana.

do $$
begin
  if to_regprocedure('rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean)') is null then
    raise exception 'precheck: falta fn_registrar_marca_kiosko con la firma de P4b';
  end if;
  if to_regprocedure('rrhh.fn_registrar_marca_terminal(text,text,uuid,boolean)') is null then
    raise exception 'precheck: falta fn_registrar_marca_terminal (enrolamiento)';
  end if;
  if exists (select 1 from rrhh.asistencia_marcas where tipo not in ('entrada','salida')) then
    raise exception 'precheck: ya hay marcas con tipos distintos de entrada/salida';
  end if;
end;
$$;

-- ---------------------------------------------------------------- tipos

-- El check vive en la tabla padre y lo heredan las particiones.
alter table rrhh.asistencia_marcas drop constraint asistencia_marcas_tipo_check;
alter table rrhh.asistencia_marcas add constraint asistencia_marcas_tipo_check
  check (tipo in ('entrada','inicio_descanso','fin_descanso','salida'));

-- D7: contador de vistas previas válidas por kiosco y ventana.
alter table rrhh.kiosko_rate_limits
  add column previas_en_ventana smallint not null default 0;

-- ---------------------------------------------------------------- marcar

drop function public.registrar_marca_terminal(text,text,uuid,boolean);
drop function public.registrar_marca_kiosko(text,uuid,uuid,boolean);
drop function rrhh.fn_registrar_marca_terminal(text,text,uuid,boolean);
drop function rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean);

create function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid, p_solicitud_id uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = rrhh, extensions, pg_temp as $$
declare
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
    and crypt(p_pin,cc.pin_hash)=cc.pin_hash;
  if v_coincidencias<>1 then
   if v_coincidencias>1 then
    raise warning 'rrhh.kiosko: PIN ambiguo rechazado (fallo cerrado) — kiosko_id=%, company_id=%, credenciales_vigentes_coincidentes=%',
     p_kiosko_id,v_kiosko.company_id,v_coincidencias;
   end if;
   update rrhh.kiosko_rate_limits set intentos_en_ventana=intentos_en_ventana+1,
    bloqueado_hasta=case when intentos_en_ventana+1>=8 then v_ahora+interval '5 minutes' else bloqueado_hasta end,
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
   and crypt(p_pin,cc.pin_hash)=cc.pin_hash for share;
  if not found then exit procesar; end if;
  -- PIN válido: los inválidos se reinician; una vista previa suma a su propio
  -- contador (D7): 30 por minuto bloquean el kiosco 5 minutos.
  update rrhh.kiosko_rate_limits set intentos_en_ventana=0,
   previas_en_ventana=previas_en_ventana+case when p_accion is null then 1 else 0 end,
   bloqueado_hasta=case when p_accion is null and previas_en_ventana+1>=30
                        then v_ahora+interval '5 minutes' else null end,
   updated_at=v_ahora
   where kiosko_id=p_kiosko_id;
  loop
   v_ahora:=clock_timestamp(); v_fecha:=(v_ahora at time zone 'America/Managua')::date;
   perform pg_advisory_xact_lock(76107,hashtext(v_contrato::text||':'||v_fecha::text));
   v_ahora:=clock_timestamp();
   exit when (v_ahora at time zone 'America/Managua')::date=v_fecha;
  end loop;
  v_inicio:=v_fecha::timestamp at time zone 'America/Managua';
  v_fin:=(v_fecha+1)::timestamp at time zone 'America/Managua';
  -- Estado del día = secuencia ordenada de marcas del contrato.
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
  if v_motivo is not null then
   v_respuesta := jsonb_build_object('estado','rechazada','motivo',v_motivo);
   exit procesar;
  end if;
  if p_accion is null then
   -- Vista previa: no se guarda; el commit usa el mismo p_solicitud_id.
   return jsonb_build_object('estado','acciones','acciones',to_jsonb(v_acciones));
  end if;
  if not (p_accion = any(v_acciones)) then
   v_respuesta := '{"estado":"rechazada","motivo":"accion_no_disponible"}'::jsonb;
   exit procesar;
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

create function rrhh.fn_registrar_marca_terminal(p_token text, p_pin text, p_solicitud_id uuid, p_accion text)
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
  return rrhh.fn_registrar_marca_kiosko(p_pin, v_kiosko_id, p_solicitud_id, p_accion);
end $$;

create function public.registrar_marca_kiosko(p_pin text, p_kiosko_id uuid, p_solicitud_id uuid, p_accion text)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_registrar_marca_kiosko(p_pin, p_kiosko_id, p_solicitud_id, p_accion);
$$;
create function public.registrar_marca_terminal(p_token text, p_pin text, p_solicitud_id uuid, p_accion text)
returns jsonb language sql security definer set search_path = '' as $$
  select rrhh.fn_registrar_marca_terminal(p_token, p_pin, p_solicitud_id, p_accion);
$$;

revoke execute on function rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text) from public, anon, authenticated;
revoke execute on function rrhh.fn_registrar_marca_terminal(text,text,uuid,text) from public, anon, authenticated;
revoke execute on function public.registrar_marca_kiosko(text,uuid,uuid,text) from public;
revoke execute on function public.registrar_marca_terminal(text,text,uuid,text) from public;
grant execute on function public.registrar_marca_kiosko(text,uuid,uuid,text) to anon, authenticated;
grant execute on function public.registrar_marca_terminal(text,text,uuid,text) to anon, authenticated;

-- ---------------------------------------------------------------- consultar

create or replace function rrhh.fn_consultar_marcas(p_company_id uuid, p_desde date, p_hasta date, p_empleado_id uuid DEFAULT NULL::uuid, p_contrato_id uuid DEFAULT NULL::uuid, p_estado text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
returns table(marca_id uuid, empleado_id uuid, empleado_label text, contrato_id uuid, contrato_numero bigint, fecha_local date, tipo text, marcado_en timestamp with time zone, estado text)
language plpgsql security definer set search_path = rrhh, core, pg_temp as $$
begin
 if core.has_permission(auth.uid(),p_company_id,'rrhh.asistencia.marcas.ver') is distinct from true then
  raise exception 'Sin permiso';
 end if;
 if p_desde is null or p_hasta is null or p_desde>p_hasta or p_hasta-p_desde>61
  or p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0
  or (p_estado is not null and p_estado not in ('registrada','entrada_abierta_hoy','falta_salida',
      'en_descanso_hoy','descanso_sin_cerrar','sin_descanso_marcado')) then
  raise exception 'Filtros invalidos';
 end if;
 return query
 with base as (
  select am.id marca_id,am.empleado_id,
   coalesce(e.codigo_empleado::text||' — ','')||e.nombre||' '||coalesce(e.apellido,'') empleado_label,
   am.contrato_id,c.numero_contrato contrato_numero,
   (am.marcado_en at time zone 'America/Managua')::date fecha_local,
   am.tipo,am.marcado_en
  from rrhh.asistencia_marcas am
  join rrhh.empleados e on e.id=am.empleado_id and e.company_id=p_company_id
  join rrhh.contratos c on c.id=am.contrato_id and c.company_id=p_company_id and c.empleado_id=am.empleado_id
  where am.company_id=p_company_id
   and am.marcado_en>=p_desde::timestamp at time zone 'America/Managua'
   and am.marcado_en<(p_hasta+1)::timestamp at time zone 'America/Managua'
   and (p_empleado_id is null or am.empleado_id=p_empleado_id)
   and (p_contrato_id is null or am.contrato_id=p_contrato_id)
 ), marcas as (
  select b.*,
   (select array_agg(s.tipo) from rrhh.asistencia_marcas s
     where s.company_id=p_company_id and s.contrato_id=b.contrato_id
      and s.marcado_en>=b.fecha_local::timestamp at time zone 'America/Managua'
      and s.marcado_en<(b.fecha_local+1)::timestamp at time zone 'America/Managua') tipos_dia,
   b.fecha_local=(clock_timestamp() at time zone 'America/Managua')::date es_hoy
  from base b
 )
 select m.marca_id,m.empleado_id,m.empleado_label,m.contrato_id,m.contrato_numero,m.fecha_local,m.tipo,m.marcado_en,
  case
   when m.tipo='entrada' and not ('salida'=any(m.tipos_dia)) then
    case when m.es_hoy then 'entrada_abierta_hoy' else 'falta_salida' end
   when m.tipo='inicio_descanso' and not ('fin_descanso'=any(m.tipos_dia)) then
    case when m.es_hoy then 'en_descanso_hoy' else 'descanso_sin_cerrar' end
   when m.tipo='salida' and not ('inicio_descanso'=any(m.tipos_dia)) then 'sin_descanso_marcado'
   else 'registrada'
  end estado
 from marcas m
 where p_estado is null or p_estado = case
   when m.tipo='entrada' and not ('salida'=any(m.tipos_dia)) then
    case when m.es_hoy then 'entrada_abierta_hoy' else 'falta_salida' end
   when m.tipo='inicio_descanso' and not ('fin_descanso'=any(m.tipos_dia)) then
    case when m.es_hoy then 'en_descanso_hoy' else 'descanso_sin_cerrar' end
   when m.tipo='salida' and not ('inicio_descanso'=any(m.tipos_dia)) then 'sin_descanso_marcado'
   else 'registrada' end
 order by m.marcado_en desc,m.marca_id desc limit p_limit offset p_offset;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------- postchecks
do $$
begin
  if to_regprocedure('public.registrar_marca_kiosko(text,uuid,uuid,boolean)') is not null
     or to_regprocedure('public.registrar_marca_terminal(text,text,uuid,boolean)') is not null then
    raise exception 'postcheck: quedó la firma vieja con p_confirmar_salida';
  end if;
  if not has_function_privilege('anon', 'public.registrar_marca_kiosko(text,uuid,uuid,text)', 'execute')
     or not has_function_privilege('anon', 'public.registrar_marca_terminal(text,text,uuid,text)', 'execute') then
    raise exception 'postcheck: la terminal (anon) no puede marcar';
  end if;
  if has_function_privilege('anon', 'rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'rrhh.fn_registrar_marca_terminal(text,text,uuid,text)', 'execute') then
    raise exception 'postcheck: una función interna quedó ejecutable por la API';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conrelid='rrhh.asistencia_marcas'::regclass
       and conname='asistencia_marcas_tipo_check')) not like '%inicio_descanso%' then
    raise exception 'postcheck: el check de tipo no incluye el descanso';
  end if;
  if exists (select 1 from pg_inherits i join pg_class p on p.oid=i.inhrelid
             where i.inhparent='rrhh.asistencia_marcas'::regclass
               and not exists (select 1 from pg_constraint c where c.conrelid=p.oid
                               and c.conname='asistencia_marcas_tipo_check'
                               and pg_get_constraintdef(c.oid) like '%inicio_descanso%')) then
    raise exception 'postcheck: alguna partición no heredó el check nuevo';
  end if;
end;
$$;
