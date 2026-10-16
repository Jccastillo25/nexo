-- P6: consulta minima, autorizada por marcas.ver y empresa, sin mutaciones.
-- Rollback: retirar wrapper nuevo y pagina; conservar marcas y sus vinculos.
-- No ampliar SELECT a empleados/credenciales; exponer solo datos minimos aqui.
create function rrhh.fn_consultar_marcas(
 p_company_id uuid,p_desde date,p_hasta date,
 p_empleado_id uuid default null,p_contrato_id uuid default null,
 p_estado text default null,p_limit integer default 50,p_offset integer default 0
) returns table(
 marca_id uuid,empleado_id uuid,empleado_label text,contrato_id uuid,
 contrato_numero bigint,fecha_local date,tipo text,marcado_en timestamptz,estado text
) language plpgsql security definer set search_path=rrhh,core,pg_temp as $$
begin
 if core.has_permission(auth.uid(),p_company_id,'rrhh.asistencia.marcas.ver') is distinct from true then
  raise exception 'Sin permiso';
 end if;
 if p_desde is null or p_hasta is null or p_desde>p_hasta or p_hasta-p_desde>61
  or p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0
  or (p_estado is not null and p_estado not in ('registrada','entrada_abierta_hoy','falta_salida')) then
  raise exception 'Filtros invalidos';
 end if;
 return query
 with marcas as (
  select am.id marca_id,am.empleado_id,
   coalesce(e.codigo_empleado::text||' — ','')||e.nombre||' '||coalesce(e.apellido,'') empleado_label,
   am.contrato_id,c.numero_contrato contrato_numero,
   (am.marcado_en at time zone 'America/Managua')::date fecha_local,
   am.tipo,am.marcado_en,
   case when am.tipo='entrada' and not exists(
    select 1 from rrhh.asistencia_marcas s where s.company_id=p_company_id
     and s.contrato_id=am.contrato_id and s.tipo='salida'
     and s.marcado_en>=((am.marcado_en at time zone 'America/Managua')::date)::timestamp at time zone 'America/Managua'
     and s.marcado_en<(((am.marcado_en at time zone 'America/Managua')::date)+1)::timestamp at time zone 'America/Managua'
   ) then case
     when (am.marcado_en at time zone 'America/Managua')::date=(clock_timestamp() at time zone 'America/Managua')::date then 'entrada_abierta_hoy'
     when (am.marcado_en at time zone 'America/Managua')::date<(clock_timestamp() at time zone 'America/Managua')::date then 'falta_salida'
     else 'registrada' end
    else 'registrada' end estado
  from rrhh.asistencia_marcas am
  join rrhh.empleados e on e.id=am.empleado_id and e.company_id=p_company_id
  join rrhh.contratos c on c.id=am.contrato_id and c.company_id=p_company_id and c.empleado_id=am.empleado_id
  where am.company_id=p_company_id
   and am.marcado_en>=p_desde::timestamp at time zone 'America/Managua'
   and am.marcado_en<(p_hasta+1)::timestamp at time zone 'America/Managua'
   and (p_empleado_id is null or am.empleado_id=p_empleado_id)
   and (p_contrato_id is null or am.contrato_id=p_contrato_id)
 )
 select m.marca_id,m.empleado_id,m.empleado_label,m.contrato_id,m.contrato_numero,m.fecha_local,m.tipo,m.marcado_en,m.estado
 from marcas m where p_estado is null or m.estado=p_estado
 order by m.marcado_en desc,m.marca_id desc limit p_limit offset p_offset;
end $$;
create function public.consultar_marcas(
 p_company_id uuid,p_desde date,p_hasta date,
 p_empleado_id uuid default null,p_contrato_id uuid default null,
 p_estado text default null,p_limit integer default 50,p_offset integer default 0
) returns table(
 marca_id uuid,empleado_id uuid,empleado_label text,contrato_id uuid,
 contrato_numero bigint,fecha_local date,tipo text,marcado_en timestamptz,estado text
) language sql security definer set search_path=rrhh,pg_temp as $$
 select * from rrhh.fn_consultar_marcas(p_company_id,p_desde,p_hasta,p_empleado_id,p_contrato_id,p_estado,p_limit,p_offset);
$$;
revoke execute on function rrhh.fn_consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.consultar_marcas(uuid,date,date,uuid,uuid,text,integer,integer) to authenticated;
