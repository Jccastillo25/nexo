begin;
do $$
declare empresa uuid:=gen_random_uuid(); otra uuid:=gen_random_uuid(); usuario uuid:=gen_random_uuid();
 empleado uuid; ajeno uuid; contrato uuid; nuevo uuid; kiosco uuid; valor text; revocado text; fallo boolean:=false;
begin
 insert into core.companies values(empresa,'PRUEBA empresa'),(otra,'PRUEBA otra');
 insert into rrhh.empleados(company_id,nombre,apellido) values(empresa,'PRUEBA','uno') returning id into empleado;
 insert into rrhh.empleados(company_id,nombre,apellido) values(otra,'PRUEBA','ajeno') returning id into ajeno;
 insert into rrhh.kiosko_dispositivos(company_id,nombre) values(empresa,'PRUEBA') returning id into kiosco;
 insert into rrhh.contratos(company_id,empleado_id) values(empresa,empleado) returning id into contrato;
 insert into rrhh.contrato_jornadas values(contrato);
 perform set_config('request.jwt.claim.sub',usuario::text,true);
 insert into core.prueba_permisos values(usuario,empresa,'rrhh.expedientes.contratos.activar'),(usuario,empresa,'rrhh.expedientes.contratos.finalizar');
 select pin_kiosko into valor from rrhh.fn_activar_contrato(contrato,empresa);
 perform public.registrar_marca_kiosko(valor,kiosco);
 if (select count(*) from rrhh.asistencia_marcas where contrato_id=contrato and empleado_id=empleado and company_id=empresa)<>1
 then raise exception 'FALLO P3: vinculo'; end if;
 begin insert into rrhh.asistencia_marcas(company_id,empleado_id,kiosko_id,contrato_id,tipo)
 values(empresa,ajeno,kiosco,contrato,'entrada'); exception when foreign_key_violation then fallo:=true; end;
 if not fallo then raise exception 'FALLO P3: FK compuesta'; end if;
 perform rrhh.fn_finalizar_contrato(contrato,empresa);
 perform public.registrar_marca_kiosko(valor,kiosco);
 if (select count(*) from rrhh.asistencia_marcas)<>1 then raise exception 'FALLO P3: PIN revocado'; end if;
 insert into rrhh.contratos(company_id,empleado_id) values(empresa,empleado) returning id into nuevo;
 insert into rrhh.contrato_jornadas values(nuevo);
 select pin_kiosko into valor from rrhh.fn_activar_contrato(nuevo,empresa);
 perform public.registrar_marca_kiosko(valor,kiosco);
 if (select count(*) from rrhh.asistencia_marcas where contrato_id=contrato)<>1 or
    (select count(*) from rrhh.asistencia_marcas where contrato_id=nuevo and tipo='entrada')<>1
 then raise exception 'FALLO P3: recontratacion'; end if;
 if has_table_privilege('authenticated','rrhh.asistencia_marcas','INSERT') or
    has_table_privilege('authenticated','rrhh.asistencia_marcas','UPDATE') or
    has_table_privilege('authenticated','rrhh.asistencia_marcas','DELETE')
 then raise exception 'FALLO P3: escritura directa'; end if;
end $$;
rollback;
