begin;
do $$
declare empresa uuid:=gen_random_uuid(); otra uuid:=gen_random_uuid(); usuario uuid:=gen_random_uuid();
 empleado uuid; contrato uuid; i integer; fecha date:=(clock_timestamp() at time zone 'America/Managua')::date;
 inicio timestamptz; fallo boolean; cantidad integer; fila record;
begin
 insert into core.companies values(empresa,'PRUEBA empresa'),(otra,'PRUEBA otra');
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 insert into core.prueba_permisos values(usuario,empresa,'rrhh.asistencia.marcas.ver'),(usuario,otra,'rrhh.asistencia.marcas.ver');
 inicio:=fecha::timestamp at time zone 'America/Managua';
 for i in 1..3 loop
  insert into rrhh.empleados(company_id,nombre,apellido) values(empresa,'PRUEBA','empleado') returning id into empleado;
  insert into rrhh.contratos(company_id,empleado_id,estado) values(empresa,empleado,'activo') returning id into contrato;
  insert into rrhh.asistencia_marcas(company_id,empleado_id,contrato_id,tipo,marcado_en)
   values(empresa,empleado,contrato,'entrada',case when i=3 then inicio-interval '1 hour' else inicio+interval '1 hour' end);
  if i=1 then
   insert into rrhh.asistencia_marcas(company_id,empleado_id,contrato_id,tipo,marcado_en)
    values(empresa,empleado,contrato,'salida',inicio+interval '2 hours');
  end if;
 end loop;
 select count(*) into cantidad from public.consultar_marcas(empresa,fecha-1,fecha);
 if cantidad<>4 then raise exception 'FALLO P6: lectura autorizada'; end if;
 select count(*) into cantidad from public.consultar_marcas(otra,fecha-1,fecha);
 if cantidad<>0 then raise exception 'FALLO P6: aislamiento empresa'; end if;
 select count(*) into cantidad from public.consultar_marcas(empresa,fecha-1,fecha,null,null,'falta_salida');
 if cantidad<>1 then raise exception 'FALLO P6: falta salida'; end if;
 select count(*) into cantidad from public.consultar_marcas(empresa,fecha-1,fecha,null,null,'entrada_abierta_hoy');
 if cantidad<>1 then raise exception 'FALLO P6: entrada abierta'; end if;
 select count(*) into cantidad from public.consultar_marcas(empresa,fecha-1,fecha,null,null,'registrada');
 if cantidad<>2 then raise exception 'FALLO P6: par registrado'; end if;
 select * into fila from public.consultar_marcas(empresa,fecha-1,fecha,null,null,null,1,1);
 if fila.marca_id is null or fila.empleado_label not like '%PRUEBA%' or fila.contrato_numero is null then raise exception 'FALLO P6: paginacion y lectura minima'; end if;
 select count(*) into cantidad from public.consultar_marcas(empresa,fecha-1,fecha,gen_random_uuid());
 if cantidad<>0 then raise exception 'FALLO P6: filtro vacio'; end if;
 for i in 1..5 loop
  fallo:=false;
  begin
   perform public.consultar_marcas(empresa,case when i=1 then null else fecha end,
    case when i=2 then fecha-1 when i=3 then fecha+62 else fecha end,
    null,null,null,case when i=4 then 101 else 50 end,case when i=5 then -1 else 0 end);
  exception when others then fallo:=true; end;
  if not fallo then raise exception 'FALLO P6: limites'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 fallo:=false;
 begin perform public.consultar_marcas(empresa,fecha-1,fecha); exception when others then fallo:=true; end;
 if not fallo then raise exception 'FALLO P6: sin permiso'; end if;
 if has_function_privilege('anon','public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE')
 then raise exception 'FALLO P6: anon denegado'; end if;
end $$;
rollback;
