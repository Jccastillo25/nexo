-- P7.1 — SOLO OPERADOR, despues de aprobar/aplicar P1 -> P2 -> P3 -> P4a -> P4b -> P6.
-- NO lo ejecuta test:db. No conecta, no crea fixtures ni cambia datos de negocio.
-- Ejecutar A primero. Para B preparar DOS contratos borrador PRUEBA de empleados
-- distintos con jornada; revisar IDs/nombres/empresa en manifiesto privado.
-- La carrera real se ejecuta con rrhh_p7_concurrencia.mjs (dos llamadas HTTP
-- simultaneas, transacciones PostgREST independientes); despues ejecutar B.
-- No comparar hashes bcrypt entre si: no demuestra unicidad. El arnes compara
-- los dos PIN devueltos exclusivamente en memoria, nunca los imprime/guarda.

-- A. Catalogo, grants, RLS y particiones. Todo dentro de ROLLBACK.
begin;
create function pg_temp.exigir(ok boolean, motivo text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALLO P7: %',motivo; end if; end $$;

select pg_temp.exigir(to_regprocedure('public.registrar_marca_kiosko(text,uuid)') is null,'firma antigua ausente');
select pg_temp.exigir(has_function_privilege('anon','public.registrar_marca_kiosko(text,uuid,uuid,boolean)','EXECUTE'),'wrapper anonimo disponible');
select pg_temp.exigir(not has_function_privilege('anon','rrhh.fn_registrar_marca_kiosko(text,uuid,uuid,boolean)','EXECUTE'),'interna no accesible');
select pg_temp.exigir(not has_function_privilege('anon','public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE'),'lectura no anonima');
select pg_temp.exigir(has_function_privilege('authenticated','public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer)','EXECUTE'),'lectura autenticada disponible');
select pg_temp.exigir(not has_table_privilege('authenticated','rrhh.asistencia_marcas','INSERT,UPDATE,DELETE'),'sin escritura directa');
select pg_temp.exigir(not has_any_column_privilege('authenticated','rrhh.asistencia_marcas','INSERT,UPDATE'),'sin grants por columna');
select pg_temp.exigir(not has_table_privilege('anon','rrhh.kiosko_solicitudes','SELECT'),'solicitudes privadas');
select pg_temp.exigir(not exists(select 1 from pg_policies where schemaname='rrhh' and tablename='asistencia_marcas' and cmd<>'SELECT'),'sin policies de escritura');
select pg_temp.exigir((select relrowsecurity from pg_class where oid='rrhh.asistencia_marcas'::regclass),'RLS padre marcas');
select pg_temp.exigir((select relrowsecurity from pg_class where oid='rrhh.kiosko_solicitudes'::regclass),'RLS padre solicitudes');
select pg_temp.exigir(not exists(
 select 1 from pg_inherits i join pg_class c on c.oid=i.inhrelid
 where i.inhparent in ('rrhh.asistencia_marcas'::regclass,'rrhh.kiosko_solicitudes'::regclass)
 and (not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'))
),'particiones protegidas');
select pg_temp.exigir(exists(select 1 from core.tablas_particionadas where schema_nombre='rrhh' and tabla_nombre='kiosko_solicitudes'
 and fn_asegurar_particion='rrhh.fn_asegurar_particion_kiosko_solicitudes'),'registro automatico');
do $$ declare i integer; mes date; begin
 for i in 0..3 loop
  mes:=(date_trunc('month',now())+make_interval(months=>i))::date;
  perform pg_temp.exigir(to_regclass('rrhh.kiosko_solicitudes_'||to_char(mes,'YYYY_MM')) is not null,'particion mensual existente');
 end loop;
end $$;

-- Sin JWT, ninguna fila de empresa debe escapar al rol authenticated.
select set_config('request.jwt.claims','{}',true);
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.exigir((select count(*)=0 from rrhh.asistencia_marcas),'RLS sin identidad');
do $$ declare denegado boolean:=false; begin
 begin insert into rrhh.asistencia_marcas(company_id,empleado_id,contrato_id,tipo)
 values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'entrada');
 exception when insufficient_privilege then denegado:=true; end;
 perform pg_temp.exigir(denegado,'INSERT directo denegado');
 denegado:=false;
 begin perform public.consultar_marcas(gen_random_uuid(),current_date,current_date);
 exception when raise_exception then
  if sqlerrm='Sin permiso' then denegado:=true; else raise; end if;
 end;
 perform pg_temp.exigir(denegado,'RPC sin identidad denegada');
end $$;
reset role;
set local role anon;
do $$ declare denegado boolean:=false; begin
 begin perform rrhh.fn_registrar_marca_kiosko(null,null,null,false);
 exception when insufficient_privilege then denegado:=true; end;
 perform pg_temp.exigir(denegado,'anon sin acceso a interna');
 denegado:=false;
 begin perform count(*) from rrhh.kiosko_solicitudes;
 exception when insufficient_privilege then denegado:=true; end;
 perform pg_temp.exigir(denegado,'anon no lee resultados');
end $$;
reset role;
rollback;

-- B. Ejecutar POR SEPARADO tras rrhh_p7_concurrencia.mjs, con los UUID exactos
-- del manifiesto privado (sin PIN). No ejecutar B antes de completar la carrera.
-- Configurar en ESTA misma transaccion con set_config:
-- nexo.prueba.empresa, nexo.prueba.contrato_secuencia, nexo.prueba.contrato_idempotencia,
-- nexo.prueba.kiosco y nexo.prueba.solicitud_idempotente.
-- Las GUC son parametros de sesion, no datos persistentes.
/*
begin;
-- AQUI: select set_config('nexo.prueba.empresa', UUID_DEL_MANIFIESTO, true); etc.
do $$
declare empresa uuid:=current_setting('nexo.prueba.empresa')::uuid;
 secuencia uuid:=current_setting('nexo.prueba.contrato_secuencia')::uuid;
 idempotencia uuid:=current_setting('nexo.prueba.contrato_idempotencia')::uuid;
 kiosco uuid:=current_setting('nexo.prueba.kiosco')::uuid;
 solicitud uuid:=current_setting('nexo.prueba.solicitud_idempotente')::uuid;
begin
 if not exists(select 1 from rrhh.kiosko_dispositivos where id=kiosco and company_id=empresa and nombre like 'PRUEBA%')
 or (select count(*) from rrhh.contratos c join rrhh.empleados e on e.id=c.empleado_id
     where c.id in(secuencia,idempotencia) and c.company_id=empresa and e.nombre like 'PRUEBA%')<>2
 then raise exception 'FALLO P7: fixtures fuera del manifiesto'; end if;
 if (select count(*) from rrhh.asistencia_marcas where contrato_id=secuencia and company_id=empresa)<>2
 or (select count(*) from rrhh.asistencia_marcas where contrato_id=secuencia and company_id=empresa and tipo='entrada')<>1
 or (select count(*) from rrhh.asistencia_marcas where contrato_id=secuencia and company_id=empresa and tipo='salida')<>1
 then raise exception 'FALLO P7: carrera de secuencia'; end if;
 if (select count(*) from rrhh.asistencia_marcas where contrato_id=idempotencia and company_id=empresa)<>1
 or (select count(*) from rrhh.kiosko_solicitudes where kiosko_id=kiosco and solicitud_id=solicitud)<>1
 then raise exception 'FALLO P7: carrera de idempotencia'; end if;
end $$;
rollback;
*/

-- C. Con usuarios REALES autorizados/sin permiso/empresa ajena:
-- arnes HTTP verifica las tres respuestas. Ademas repetir /rrhh/marcas con
-- esas sesiones en P7.2. No simular un owner para declarar aprobado otro rol.
-- D. Operador: correr get_advisors(security), comparar con linea base y registrar
-- cada hallazgo; un archivo SQL no puede invocar esa herramienta MCP.
