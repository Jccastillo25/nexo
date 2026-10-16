begin;
create function pg_temp.exigir(ok boolean,detalle text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FALLO P4: %',detalle; end if; end $$;
do $$
declare empresa uuid:=gen_random_uuid(); usuario uuid:=gen_random_uuid(); empleado uuid;
 contrato uuid; otro uuid; kiosco uuid; segundo uuid; valor text; invalido text;
 envio uuid:=gen_random_uuid(); salida uuid:=gen_random_uuid(); rechazo uuid:=gen_random_uuid();
 respuesta jsonb; original jsonb; i integer; fallos integer; antes integer; fecha date;
begin
 insert into core.companies values(empresa,'PRUEBA');
 insert into rrhh.kiosko_dispositivos(company_id,nombre) values(empresa,'PRUEBA uno') returning id into kiosco;
 insert into rrhh.kiosko_dispositivos(company_id,nombre) values(empresa,'PRUEBA dos') returning id into segundo;
 insert into rrhh.empleados(company_id,nombre,apellido) values(empresa,'PRUEBA','uno') returning id into empleado;
 insert into rrhh.contratos(company_id,empleado_id) values(empresa,empleado) returning id into contrato;
 insert into rrhh.contrato_jornadas values(contrato);
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 insert into core.prueba_permisos values(usuario,empresa,'rrhh.expedientes.contratos.activar'),(usuario,empresa,'rrhh.expedientes.contratos.finalizar');
 select pin_kiosko into valor from rrhh.fn_activar_contrato(contrato,empresa);
 original:=public.registrar_marca_kiosko(valor,kiosco,envio,false);
 perform pg_temp.exigir(original='{"estado":"registrada","tipo":"entrada"}'::jsonb,'entrada');
 perform pg_temp.exigir(public.registrar_marca_kiosko(valor,kiosco,envio,true)=original,'reintento mismo token');
 perform pg_temp.exigir((select count(*)=1 from rrhh.asistencia_marcas),'sin doble entrada');
 respuesta:=public.registrar_marca_kiosko(valor,kiosco,salida,false);
 perform pg_temp.exigir(respuesta='{"estado":"confirmacion_requerida"}'::jsonb,'vista previa');
 perform pg_temp.exigir((select count(*)=1 from rrhh.kiosko_solicitudes),'vista previa sin resultado definitivo');
 perform pg_temp.exigir((select count(*)=1 from rrhh.asistencia_marcas),'cancelar no inserta');
 respuesta:=public.registrar_marca_kiosko(valor,kiosco,salida,true);
 perform pg_temp.exigir(respuesta='{"estado":"registrada","tipo":"salida"}'::jsonb,'salida confirmada');
 perform pg_temp.exigir(public.registrar_marca_kiosko(valor,kiosco,salida,true)=respuesta,'reintento salida');
 perform pg_temp.exigir((select count(*)=2 from rrhh.asistencia_marcas),'un solo par');
 perform pg_temp.exigir(public.registrar_marca_kiosko(valor,segundo,rechazo,true)='{"estado":"rechazada"}'::jsonb,'tercer envio incluso otro kiosco');
 -- Simular otro dia SOLO con fixtures transaccionales: no modificar reloj del servidor.
 fecha:=(clock_timestamp() at time zone 'America/Managua')::date;
 update rrhh.asistencia_marcas set marcado_en=((fecha-1)::timestamp at time zone 'America/Managua')+interval '8 hours'
  where tipo='entrada';
 delete from rrhh.asistencia_marcas where tipo='salida';
 respuesta:=public.registrar_marca_kiosko(valor,kiosco,gen_random_uuid(),false);
 perform pg_temp.exigir(respuesta->>'tipo'='entrada','ayer abierto no afecta hoy');
 perform pg_temp.exigir(public.registrar_marca_kiosko(valor,segundo,rechazo,true)='{"estado":"rechazada"}'::jsonb,'rechazo definitivo reproducible');
 -- Invalidos distintos generan un solo incremento por token, nunca se registra el valor.
 invalido:=lpad(((valor::integer+1)%10000)::text,4,'0');
 envio:=gen_random_uuid();
 perform public.registrar_marca_kiosko(invalido,kiosco,envio,false);
 select intentos_en_ventana into fallos from rrhh.kiosko_rate_limits where kiosko_id=kiosco;
 perform public.registrar_marca_kiosko(invalido,kiosco,envio,false);
 perform pg_temp.exigir((select intentos_en_ventana=fallos from rrhh.kiosko_rate_limits where kiosko_id=kiosco),'reintento invalido no cuenta doble');
 for i in 2..8 loop perform public.registrar_marca_kiosko(invalido,kiosco,gen_random_uuid(),false); end loop;
 perform pg_temp.exigir((select bloqueado_hasta>clock_timestamp() from rrhh.kiosko_rate_limits where kiosko_id=kiosco),'limite ocho fallos');
 select count(*) into antes from rrhh.asistencia_marcas;
 perform public.registrar_marca_kiosko(valor,kiosco,gen_random_uuid(),true);
 perform pg_temp.exigir((select count(*)=antes from rrhh.asistencia_marcas),'bloqueo sin marca');
 perform pg_temp.exigir(not exists(select 1 from rrhh.kiosko_solicitudes s where s.respuesta ? 'empleado_id' or s.respuesta ? 'pin' or s.respuesta ? 'contrato_id'),'sin identidad ni PIN');
 perform rrhh.fn_finalizar_contrato(contrato,empresa);
 perform pg_temp.exigir(public.registrar_marca_kiosko(valor,segundo,gen_random_uuid(),true)='{"estado":"rechazada"}'::jsonb,'finalizado no marca');
 perform pg_temp.exigir(to_regprocedure('public.registrar_marca_kiosko(text,uuid)') is null,'firma antigua cerrada');
 perform pg_temp.exigir(not has_function_privilege('anon','rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean)','EXECUTE'),'interna no accesible');
 perform pg_temp.exigir((select count(*)=4 from pg_inherits where inhparent='rrhh.kiosko_solicitudes'::regclass),'cuatro particiones');
end $$;
rollback;
