begin;
do $$
declare
 empresa uuid := gen_random_uuid(); otra uuid := gen_random_uuid(); usuario uuid := gen_random_uuid();
 empleado uuid; contrato uuid; otro_contrato uuid; valor text; anterior text; valores text[] := '{}';
 i integer; denegado boolean := false;
begin
 insert into core.companies values (empresa,'PRUEBA empresa'),(otra,'PRUEBA otra');
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 insert into core.prueba_permisos values
 (usuario,empresa,'rrhh.expedientes.contratos.activar'),
 (usuario,empresa,'rrhh.expedientes.credenciales.regenerar');
 for i in 1..6 loop
  insert into rrhh.empleados(company_id,nombre,apellido) values(empresa,'PRUEBA','empleado') returning id into empleado;
  insert into rrhh.contratos(company_id,empleado_id) values(empresa,empleado) returning id into contrato;
  insert into rrhh.contrato_jornadas values(contrato);
  select pin_kiosko into valor from rrhh.fn_activar_contrato(contrato,empresa);
  if valor is null or valor !~ '^[0-9]{4}$' or valor=any(valores) then raise exception 'FALLO P2: unicidad'; end if;
  valores := array_append(valores,valor);
 end loop;
 anterior:=valor;
 select pin_kiosko into valor from rrhh.fn_regenerar_pin_contrato(contrato,empresa);
 if valor=any(valores) or valor is null then raise exception 'FALLO P2: regeneracion'; end if;
 -- Aislamiento: misma credencial permitida en otra empresa, no se compara hash con hash.
 insert into rrhh.empleados(company_id,nombre,apellido) values(otra,'PRUEBA','otra') returning id into empleado;
 insert into rrhh.contratos(company_id,empleado_id,estado) values(otra,empleado,'activo') returning id into otro_contrato;
 insert into rrhh.contrato_credenciales(company_id,contrato_id,pin_hash)
 values(otra,otro_contrato,extensions.crypt(valor,extensions.gen_salt('bf')));
 begin perform rrhh.fn_regenerar_pin_contrato(otro_contrato,otra);
 exception when others then denegado:=true; end;
 if not denegado then raise exception 'FALLO P2: permiso empresa ajena'; end if;
end $$;
-- Control determinista de agotamiento: generador devuelve siempre el valor ya ocupado.
-- Solo en este motor efimero y dentro de la transaccion que se revierte.
create function core.prueba_bytes() returns bytea language sql stable as $$
 select decode(lpad(to_hex(current_setting('prueba.candidato')::integer),4,'0'),'hex')
$$;
do $$
declare cuerpo text; empresa uuid; contrato uuid; empleado uuid; valor text; fallo boolean:=false; rotacion integer;
begin
 select c.company_id,c.id into empresa,contrato from rrhh.contratos c join core.prueba_permisos p on p.empresa=c.company_id limit 1;
 select pin_kiosko into valor from rrhh.fn_regenerar_pin_contrato(contrato,empresa);
 perform set_config('prueba.candidato',valor,true);
 cuerpo := pg_get_functiondef('rrhh.fn_regenerar_pin_contrato(uuid,uuid)'::regprocedure);
 execute replace(cuerpo,'extensions.gen_random_bytes(2)','core.prueba_bytes()');
 select rotacion_numero into rotacion from rrhh.contrato_credenciales where contrato_id=contrato;
 begin perform rrhh.fn_regenerar_pin_contrato(contrato,empresa); exception when others then fallo:=true; end;
 if not fallo or (select rotacion_numero from rrhh.contrato_credenciales where contrato_id=contrato)<>rotacion
 then raise exception 'FALLO P2: agotamiento debe conservar credencial'; end if;
 -- Tambien al activar: el UPDATE a activo debe revertirse por completo.
 cuerpo := pg_get_functiondef('rrhh.fn_activar_contrato(uuid,uuid)'::regprocedure);
 execute replace(cuerpo,'extensions.gen_random_bytes(2)','core.prueba_bytes()');
 insert into rrhh.empleados(company_id,nombre,apellido) values(empresa,'PRUEBA','agotamiento') returning id into empleado;
 insert into rrhh.contratos(company_id,empleado_id) values(empresa,empleado) returning id into contrato;
 insert into rrhh.contrato_jornadas values(contrato);
 fallo:=false;
 begin perform rrhh.fn_activar_contrato(contrato,empresa); exception when others then fallo:=true; end;
 if not fallo or (select estado from rrhh.contratos where id=contrato)<>'borrador'
 or exists(select 1 from rrhh.contrato_credenciales where contrato_id=contrato)
 then raise exception 'FALLO P2: activacion agotada debe revertirse'; end if;
end $$;
rollback;
