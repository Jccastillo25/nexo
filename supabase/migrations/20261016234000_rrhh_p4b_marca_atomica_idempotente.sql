-- P4b: secuencia por contrato/dia local e idempotencia serializada.
-- Requiere P1,P2,P3,P4a. Ventana de despliegue: cliente antiguo falla cerrado.
-- Rollback: no restaurar firma antigua; preservar marcas/resultados, corregir
-- hacia adelante o deshabilitar kiosco hasta publicar cliente compatible.
drop function public.registrar_marca_kiosko(text,uuid);
drop function rrhh.fn_registrar_marca_kiosko(text,uuid);

create function rrhh.fn_registrar_marca_kiosko(
 p_pin text,p_kiosko_id uuid,p_solicitud_id uuid,p_confirmar_salida boolean
) returns jsonb language plpgsql security definer
set search_path=rrhh,extensions,pg_temp as $$
declare
 v_kiosko rrhh.kiosko_dispositivos%rowtype;
 v_rl rrhh.kiosko_rate_limits%rowtype;
 v_contratos uuid[]; v_empleados uuid[]; v_coincidencias integer;
 v_contrato uuid; v_empleado uuid; v_estado text; v_tipo text;
 v_ahora timestamptz; v_fecha date; v_inicio timestamptz; v_fin timestamptz;
 v_entradas integer; v_salidas integer;
 v_respuesta jsonb := '{"estado":"rechazada"}'::jsonb;
begin
 if p_solicitud_id is null or p_pin is null or p_pin !~ '^[0-9]{4}$'
    or p_confirmar_salida is null then return v_respuesta; end if;
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
   update rrhh.kiosko_rate_limits set window_started_at=v_ahora,intentos_en_ventana=0,
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
  update rrhh.kiosko_rate_limits set intentos_en_ventana=0,bloqueado_hasta=null,updated_at=v_ahora
   where kiosko_id=p_kiosko_id;
  loop
   v_ahora:=clock_timestamp(); v_fecha:=(v_ahora at time zone 'America/Managua')::date;
   perform pg_advisory_xact_lock(76107,hashtext(v_contrato::text||':'||v_fecha::text));
   v_ahora:=clock_timestamp();
   exit when (v_ahora at time zone 'America/Managua')::date=v_fecha;
  end loop;
  v_inicio:=v_fecha::timestamp at time zone 'America/Managua';
  v_fin:=(v_fecha+1)::timestamp at time zone 'America/Managua';
  select count(*) filter(where am.tipo='entrada'),count(*) filter(where am.tipo='salida')
   into v_entradas,v_salidas from rrhh.asistencia_marcas am
   where am.contrato_id=v_contrato and am.company_id=v_kiosko.company_id
    and am.marcado_en>=v_inicio and am.marcado_en<v_fin;
  if v_entradas=0 and v_salidas=0 then v_tipo:='entrada';
  elsif v_entradas=1 and v_salidas=0 then
   if not p_confirmar_salida then return '{"estado":"confirmacion_requerida"}'::jsonb; end if;
   v_tipo:='salida';
  else exit procesar;
  end if;
  insert into rrhh.asistencia_marcas(company_id,empleado_id,kiosko_id,contrato_id,tipo,marcado_en,origen)
   values(v_kiosko.company_id,v_empleado,p_kiosko_id,v_contrato,v_tipo,v_ahora,'kiosko');
  v_respuesta:=jsonb_build_object('estado','registrada','tipo',v_tipo);
 end procesar;
 insert into rrhh.kiosko_solicitudes(solicitud_id,company_id,kiosko_id,fecha_local,resultado,respuesta)
 values(p_solicitud_id,v_kiosko.company_id,p_kiosko_id,(v_ahora at time zone 'America/Managua')::date,
  v_respuesta->>'estado',v_respuesta);
 return v_respuesta;
end $$;
create function public.registrar_marca_kiosko(
 p_pin text,p_kiosko_id uuid,p_solicitud_id uuid,p_confirmar_salida boolean
) returns jsonb language sql security definer set search_path=rrhh,pg_temp as $$
 select rrhh.fn_registrar_marca_kiosko(p_pin,p_kiosko_id,p_solicitud_id,p_confirmar_salida);
$$;
revoke execute on function rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean) from public,anon,authenticated;
revoke execute on function public.registrar_marca_kiosko(text,uuid,uuid,boolean) from public;
grant execute on function public.registrar_marca_kiosko(text,uuid,uuid,boolean) to anon,authenticated;
notify pgrst, 'reload schema';
