-- Reportes de Asistencia (2026-10-18). Especificación aprobada por el
-- usuario con las decisiones recomendadas:
--   - marcas truncadas al minuto;
--   - horas netas = salida − entrada − descanso; si no marcó descanso se
--     descuenta el programado de la jornada de ese día (D1, 2026-10-17);
--   - tardanza / salida temprana: si supera la tolerancia, cuenta completa
--     desde la hora programada (08:12 con tolerancia 10 → 12 min);
--   - trabajo en feriado o día no laborable: va en minutos_no_laborable, sin
--     tardanza ni salida temprana;
--   - tiempo sobre jornada: informativo, no son horas extra autorizadas;
--   - promedio de tardanza por tardanza; rango máximo 62 días, hasta ≤ hoy;
--   - "sin_marcas" no es falta injustificada (no hay vacaciones/permisos).
-- Detalle: docs/status-log/2026-10-18-asistencia-reportes.md.
--
-- rrhh.fn_asistencia_dias es el núcleo de cálculo (una fila por contrato y
-- día local America/Managua). Pensado para que F1.5 (consolidación) lo
-- reutilice y no haya dos motores. Riesgo conocido: usa las reglas de
-- jornada vigentes HOY (jornada_dias no guarda versiones).
--
-- Las funciones públicas devuelven jsonb {filas, total, totales} y validan
-- permiso (42501) y filtros (22023). Mobile usa las mismas RPC.
--
-- Rollback:
--   drop function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer);
--   drop function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid);
--   drop function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer);
--   drop function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer);
--   drop function public.asistencia_reporte_opciones(uuid);
--   drop function public.asistencia_registrar_exportacion(uuid,text,text,jsonb,integer);
--   drop function rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid);
--   drop function rrhh.fn_reporte_validar(uuid,date,date,text);

do $$
begin
  if (select count(*) from core.permissions_catalog
      where code in ('rrhh.asistencia.reportes.ver','rrhh.asistencia.reportes.exportar')) <> 2 then
    raise exception 'precheck: falta el Paso Cero de reportes (20261018100000)';
  end if;
  if to_regprocedure('rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid)') is not null then
    raise exception 'precheck: fn_asistencia_dias ya existe';
  end if;
end;
$$;

-- ---------------------------------------------------------------- validación

create function rrhh.fn_reporte_validar(p_company_id uuid, p_desde date, p_hasta date, p_permiso text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, p_permiso) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 61
     or p_hasta > (clock_timestamp() at time zone 'America/Managua')::date then
    raise exception 'Filtros invalidos' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------- núcleo

create function rrhh.fn_asistencia_dias(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null)
returns table(
  fecha date, es_hoy boolean,
  contrato_id uuid, contrato_numero bigint, empleado_id uuid, empleado_codigo bigint, empleado_nombre text,
  departamento_id uuid, departamento text, puesto_id uuid, puesto text,
  jornada_id uuid, jornada_nombre text, laborable boolean, es_feriado boolean, feriado_nombre text,
  hora_entrada_prog time, hora_salida_prog time, descanso_prog_min integer,
  tol_entrada_min integer, tol_salida_min integer,
  entrada timestamptz, inicio_descanso timestamptz, fin_descanso timestamptz, salida timestamptz,
  marcas_count integer, secuencia text[],
  descanso_real_min integer, descanso_aplicado_min integer, descanso_origen text,
  minutos_netos integer, minutos_programados integer, minutos_sobre_jornada integer,
  minutos_no_laborable integer, minutos_tardanza integer, minutos_salida_temprana integer,
  estado text, observaciones text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
 if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.ver') then
   raise exception 'Sin permiso' using errcode = '42501';
 end if;
 return query
 with hoy as (select (clock_timestamp() at time zone 'America/Managua')::date as d),
 ctr as (
  select c.id as cid, c.numero_contrato as cnum, c.empleado_id as eid,
         c.departamento_id as did, c.puesto_id as pid,
         coalesce(c.fecha_inicio, (c.activado_at at time zone 'America/Managua')::date) as ini,
         coalesce(c.fecha_fin_real, (c.finalizado_at at time zone 'America/Managua')::date) as fin
  from rrhh.contratos c
  where c.company_id = p_company_id and c.estado in ('activo','finalizado')
    and (p_contrato_id is null or c.id = p_contrato_id)
    and (p_empleado_id is null or c.empleado_id = p_empleado_id)
    and (p_departamento_id is null or c.departamento_id = p_departamento_id)
    and (p_puesto_id is null or c.puesto_id = p_puesto_id)
 ),
 mk as (
  select am.contrato_id as cid, (am.marcado_en at time zone 'America/Managua')::date as f,
   min(date_trunc('minute', am.marcado_en)) filter (where am.tipo = 'entrada') as e,
   min(date_trunc('minute', am.marcado_en)) filter (where am.tipo = 'inicio_descanso') as i,
   min(date_trunc('minute', am.marcado_en)) filter (where am.tipo = 'fin_descanso') as fd,
   min(date_trunc('minute', am.marcado_en)) filter (where am.tipo = 'salida') as s,
   count(*)::integer as n,
   array_agg(am.tipo order by am.marcado_en, am.id) as seq
  from rrhh.asistencia_marcas am
  where am.company_id = p_company_id
    and am.marcado_en >= p_desde::timestamp at time zone 'America/Managua'
    and am.marcado_en < (p_hasta + 1)::timestamp at time zone 'America/Managua'
    and am.contrato_id in (select ctr.cid from ctr)
  group by 1, 2
 ),
 dias as (
  select ctr.cid, g::date as f
  from ctr
  cross join lateral generate_series(greatest(p_desde, coalesce(ctr.ini, p_desde)),
                                     least(p_hasta, coalesce(ctr.fin, p_hasta)), interval '1 day') g
  union
  select mk.cid, mk.f from mk
 ),
 base as (
  select d.f, d.f = (select hoy.d from hoy) as es_hoy_,
   ctr.cid, ctr.cnum, ctr.eid, ctr.did, ctr.pid,
   e.codigo_empleado as ecod, e.apellido || ', ' || e.nombre as enom,
   dep.nombre as dnom, pu.nombre as pnom,
   jd.jornada_id as jid, j.nombre as jnom, jd.laborable as lab,
   jd.hora_entrada as he, jd.hora_salida as hs, jd.minutos_descanso as mdesc,
   jd.tolerancia_entrada_min as te, jd.tolerancia_salida_min as tsal,
   fer.nombre as fnom,
   mk.e, mk.i, mk.fd, mk.s, coalesce(mk.n, 0) as n, coalesce(mk.seq, '{}'::text[]) as seq
  from dias d
  join ctr on ctr.cid = d.cid
  join rrhh.empleados e on e.id = ctr.eid and e.company_id = p_company_id
  left join rrhh.departamentos dep on dep.id = ctr.did
  left join rrhh.puestos pu on pu.id = ctr.pid
  left join lateral (
    select cj.jornada_id from rrhh.contrato_jornadas cj
    where cj.contrato_id = ctr.cid and cj.company_id = p_company_id
      and cj.vigente_desde <= d.f and (cj.vigente_hasta is null or cj.vigente_hasta >= d.f)
    order by cj.vigente_desde desc limit 1) cj on true
  left join rrhh.jornadas j on j.id = cj.jornada_id
  left join rrhh.jornada_dias jd on jd.jornada_id = cj.jornada_id and jd.dia_semana = extract(isodow from d.f)
  left join lateral (
    select fe.nombre from rrhh.feriados fe
    where fe.company_id = p_company_id and fe.fecha = d.f limit 1) fer on true
  left join mk on mk.cid = d.cid and mk.f = d.f
 ),
 calc as (
  select b.*,
   (b.seq = '{}'::text[] or b.seq = array['entrada'] or b.seq = array['entrada','inicio_descanso']
    or b.seq = array['entrada','inicio_descanso','fin_descanso'] or b.seq = array['entrada','salida']
    or b.seq = array['entrada','inicio_descanso','fin_descanso','salida']) as valida,
   (b.seq = array['entrada','salida'] or b.seq = array['entrada','inicio_descanso','fin_descanso','salida']) as completo,
   (b.jid is not null and coalesce(b.lab, false) and b.fnom is null) as evaluable,
   case when b.i is not null and b.fd is not null
        then (extract(epoch from b.fd - b.i) / 60)::integer end as dreal,
   case when b.e is not null and b.he is not null
        then (extract(epoch from b.e - ((b.f + b.he) at time zone 'America/Managua')) / 60)::integer end as retraso,
   case when b.s is not null and b.hs is not null
        then (extract(epoch from ((b.f + b.hs) at time zone 'America/Managua') - b.s) / 60)::integer end as adelanto,
   case when b.he is not null and b.hs is not null
        then greatest(0, (extract(epoch from b.hs - b.he) / 60)::integer - coalesce(b.mdesc, 0)) end as prog_dia
  from base b
 ),
 calc2 as (
  select c.*,
   case when c.completo then (extract(epoch from c.s - c.e) / 60)::integer end as presencia,
   case when c.dreal is not null then c.dreal else coalesce(c.mdesc, 0) end as daplic,
   case when c.dreal is not null then 'marcado'
        when c.completo and coalesce(c.mdesc, 0) > 0 then 'programado'
        else 'ninguno' end as dorigen
  from calc c
 ),
 calc3 as (
  select c.*,
   case when c.completo then greatest(0, c.presencia - c.daplic) end as netos,
   case when c.evaluable then c.prog_dia end as prog,
   case when c.evaluable and c.valida and c.e is not null
        then case when c.retraso > c.te then c.retraso else 0 end end as tard,
   case when c.evaluable and c.valida and c.s is not null
        then case when c.adelanto > c.tsal then c.adelanto else 0 end end as stemp
  from calc2 c
 )
 select
  x.f, x.es_hoy_, x.cid, x.cnum, x.eid, x.ecod, x.enom, x.did, x.dnom, x.pid, x.pnom,
  x.jid, x.jnom, coalesce(x.lab, false), x.fnom is not null, x.fnom,
  x.he, x.hs, x.mdesc, x.te, x.tsal,
  x.e, x.i, x.fd, x.s, x.n, x.seq,
  x.dreal,
  case when x.completo then x.daplic end,
  x.dorigen,
  case when x.evaluable then x.netos end,
  x.prog,
  case when x.completo and x.evaluable then greatest(0, x.netos - x.prog) end,
  case when x.completo and not x.evaluable then x.netos end,
  x.tard,
  x.stemp,
  case
   when x.n > 0 and not x.valida then 'revision'
   when x.completo then 'completo'
   when x.seq = array['entrada'] or x.seq = array['entrada','inicio_descanso','fin_descanso']
     then case when x.es_hoy_ then 'en_jornada' else 'falta_salida' end
   when x.seq = array['entrada','inicio_descanso']
     then case when x.es_hoy_ then 'en_descanso' else 'descanso_sin_cerrar' end
   when x.fnom is not null then 'feriado'
   when x.jid is null then 'sin_jornada'
   when not coalesce(x.lab, false) then 'dia_descanso'
   when x.es_hoy_ then 'pendiente_hoy'
   else 'sin_marcas'
  end,
  array_remove(array[
   case when x.tard > 0 then 'tardanza' end,
   case when x.stemp > 0 then 'salida_temprana' end,
   case when x.completo and x.dorigen = 'programado' then 'sin_descanso_marcado' end,
   case when x.fnom is not null and x.n > 0 then 'trabajo_feriado' end,
   case when x.jid is not null and not coalesce(x.lab, false) and x.fnom is null and x.n > 0 then 'trabajo_dia_descanso' end,
   case when x.jid is null and x.n > 0 then 'sin_jornada' end
  ], null)
 from calc3 x;
end $$;

-- ---------------------------------------------------------------- R1 diaria

create function public.asistencia_reporte_diario(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_estado text default null, p_incluir_no_laborables boolean default false,
  p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 perform rrhh.fn_reporte_validar(p_company_id, p_desde, p_hasta, 'rrhh.asistencia.reportes.ver');
 if p_limit is null or p_limit < 1 or p_limit > 5000 or p_offset is null or p_offset < 0
    or p_incluir_no_laborables is null
    or (p_estado is not null and p_estado not in ('revision','en_jornada','en_descanso','falta_salida',
        'descanso_sin_cerrar','completo','sin_marcas','pendiente_hoy','feriado','dia_descanso','sin_jornada')) then
   raise exception 'Filtros invalidos' using errcode = '22023';
 end if;
 with d as (
  select x.* from rrhh.fn_asistencia_dias(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
                                          p_empleado_id, p_contrato_id) x
  where (p_incluir_no_laborables or x.estado not in ('feriado','dia_descanso','sin_jornada'))
    and (p_estado is null or x.estado = p_estado)
 )
 select jsonb_build_object(
  'total', (select count(*) from d),
  'totales', (select jsonb_build_object(
     'filas', count(*),
     'completos', count(*) filter (where d.estado = 'completo'),
     'incompletos', count(*) filter (where d.estado in ('falta_salida','descanso_sin_cerrar','revision')),
     'minutos_netos', coalesce(sum(d.minutos_netos), 0),
     'minutos_no_laborable', coalesce(sum(d.minutos_no_laborable), 0),
     'tardanzas', count(*) filter (where d.minutos_tardanza > 0),
     'minutos_tardanza', coalesce(sum(d.minutos_tardanza), 0),
     'salidas_tempranas', count(*) filter (where d.minutos_salida_temprana > 0),
     'minutos_salida_temprana', coalesce(sum(d.minutos_salida_temprana), 0)) from d),
  'filas', coalesce((select jsonb_agg(to_jsonb(p) order by p.fecha, p.empleado_nombre, p.contrato_numero)
                     from (select * from d order by d.fecha, d.empleado_nombre, d.contrato_numero
                           limit p_limit offset p_offset) p), '[]'::jsonb))
 into v;
 return v;
end $$;

-- ---------------------------------------------------------------- R2 resumen

create function public.asistencia_reporte_resumen(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 perform rrhh.fn_reporte_validar(p_company_id, p_desde, p_hasta, 'rrhh.asistencia.reportes.ver');
 with r as (
 select d.contrato_id, d.contrato_numero, d.empleado_id, d.empleado_codigo, d.empleado_nombre, d.departamento,
   count(*) filter (where d.laborable and not d.es_feriado and d.jornada_id is not null)::integer as dias_laborables,
   count(*) filter (where d.entrada is not null)::integer as dias_asistidos,
   count(*) filter (where d.estado = 'sin_marcas')::integer as ausencias,
   count(*) filter (where d.estado in ('falta_salida','descanso_sin_cerrar','revision'))::integer as incompletos,
   coalesce(sum(d.minutos_programados), 0)::integer as minutos_programados,
   coalesce(sum(d.minutos_netos), 0)::integer as minutos_netos,
   coalesce(sum(d.minutos_sobre_jornada), 0)::integer as minutos_sobre_jornada,
   coalesce(sum(d.minutos_no_laborable), 0)::integer as minutos_no_laborable,
   count(*) filter (where d.minutos_tardanza > 0)::integer as tardanzas,
   coalesce(sum(d.minutos_tardanza), 0)::integer as minutos_tardanza,
   count(*) filter (where d.minutos_salida_temprana > 0)::integer as salidas_tempranas,
   coalesce(sum(d.minutos_salida_temprana), 0)::integer as minutos_salida_temprana,
   count(*) filter (where d.minutos_tardanza is not null)::integer as dias_evaluables,
   count(*) filter (where d.minutos_tardanza = 0)::integer as dias_puntuales
 from rrhh.fn_asistencia_dias(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
                              p_empleado_id, p_contrato_id) d
 group by d.contrato_id, d.contrato_numero, d.empleado_id, d.empleado_codigo, d.empleado_nombre, d.departamento
 )
 select jsonb_build_object(
  'total', (select count(*) from r),
  'totales', (select jsonb_build_object(
     'personas', count(distinct r.empleado_id),
     'minutos_programados', coalesce(sum(r.minutos_programados), 0),
     'minutos_netos', coalesce(sum(r.minutos_netos), 0),
     'minutos_sobre_jornada', coalesce(sum(r.minutos_sobre_jornada), 0),
     'minutos_no_laborable', coalesce(sum(r.minutos_no_laborable), 0),
     'ausencias', coalesce(sum(r.ausencias), 0),
     'tardanzas', coalesce(sum(r.tardanzas), 0),
     'minutos_tardanza', coalesce(sum(r.minutos_tardanza), 0),
     'salidas_tempranas', coalesce(sum(r.salidas_tempranas), 0),
     'minutos_salida_temprana', coalesce(sum(r.minutos_salida_temprana), 0),
     'puntualidad', case when sum(r.dias_evaluables) > 0
                         then round(sum(r.dias_puntuales)::numeric / sum(r.dias_evaluables), 4) end)
     from r),
  'filas', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object(
       'puntualidad', case when r.dias_evaluables > 0 then round(r.dias_puntuales::numeric / r.dias_evaluables, 4) end,
       'promedio_tardanza', case when r.tardanzas > 0 then round(r.minutos_tardanza::numeric / r.tardanzas, 1) end)
     order by r.empleado_nombre, r.contrato_numero) from r), '[]'::jsonb))
 into v;
 if (v->>'total')::integer > 2000 then
   raise exception 'Demasiados contratos (%): acota con departamento o puesto', v->>'total' using errcode = '22023';
 end if;
 return v;
end $$;

-- ---------------------------------------------------------------- R3 tardanzas

create function public.asistencia_reporte_tardanzas(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_tipo text default null, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 perform rrhh.fn_reporte_validar(p_company_id, p_desde, p_hasta, 'rrhh.asistencia.reportes.ver');
 if p_limit is null or p_limit < 1 or p_limit > 5000 or p_offset is null or p_offset < 0
    or (p_tipo is not null and p_tipo not in ('tardanza','salida_temprana')) then
   raise exception 'Filtros invalidos' using errcode = '22023';
 end if;
 with d as (
  select x.* from rrhh.fn_asistencia_dias(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
                                          p_empleado_id, p_contrato_id) x
  where (p_tipo is null and (x.minutos_tardanza > 0 or x.minutos_salida_temprana > 0))
     or (p_tipo = 'tardanza' and x.minutos_tardanza > 0)
     or (p_tipo = 'salida_temprana' and x.minutos_salida_temprana > 0)
 )
 select jsonb_build_object(
  'total', (select count(*) from d),
  'totales', (select jsonb_build_object(
     'tardanzas', count(*) filter (where d.minutos_tardanza > 0),
     'minutos_tardanza', coalesce(sum(d.minutos_tardanza), 0),
     'salidas_tempranas', count(*) filter (where d.minutos_salida_temprana > 0),
     'minutos_salida_temprana', coalesce(sum(d.minutos_salida_temprana), 0),
     'personas', count(distinct d.empleado_id)) from d),
  'filas', coalesce((select jsonb_agg(to_jsonb(p) order by p.empleado_nombre, p.fecha)
                     from (select * from d order by d.empleado_nombre, d.fecha
                           limit p_limit offset p_offset) p), '[]'::jsonb))
 into v;
 return v;
end $$;

-- ---------------------------------------------------------------- R4 incidencias

create function public.asistencia_reporte_incidencias(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_tipo text default null, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 perform rrhh.fn_reporte_validar(p_company_id, p_desde, p_hasta, 'rrhh.asistencia.reportes.ver');
 if p_limit is null or p_limit < 1 or p_limit > 5000 or p_offset is null or p_offset < 0
    or (p_tipo is not null and p_tipo not in ('falta_salida','descanso_sin_cerrar','sin_marcas',
        'revision','marcas_sin_jornada')) then
   raise exception 'Filtros invalidos' using errcode = '22023';
 end if;
 with d as (
  select x.*,
   case when x.estado in ('falta_salida','descanso_sin_cerrar','sin_marcas','revision') then x.estado
        else 'marcas_sin_jornada' end as tipo
  from rrhh.fn_asistencia_dias(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
                               p_empleado_id, p_contrato_id) x
  where x.estado in ('falta_salida','descanso_sin_cerrar','sin_marcas','revision')
     or 'sin_jornada' = any(x.observaciones)
 ), f as (
  select * from d where p_tipo is null or d.tipo = p_tipo
 )
 select jsonb_build_object(
  'total', (select count(*) from f),
  'totales', coalesce((select jsonb_object_agg(t.tipo, t.n)
                       from (select d.tipo, count(*) as n from d group by d.tipo) t), '{}'::jsonb),
  'filas', coalesce((select jsonb_agg(to_jsonb(p) order by p.fecha desc, p.empleado_nombre)
                     from (select * from f order by f.fecha desc, f.empleado_nombre
                           limit p_limit offset p_offset) p), '[]'::jsonb))
 into v;
 return v;
end $$;

-- ---------------------------------------------------------------- opciones de filtros

create function public.asistencia_reporte_opciones(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.ver') then
   raise exception 'Sin permiso' using errcode = '42501';
 end if;
 return jsonb_build_object(
  'departamentos', coalesce((select jsonb_agg(jsonb_build_object('id', dp.id, 'nombre', dp.nombre) order by dp.nombre)
                             from rrhh.departamentos dp where dp.company_id = p_company_id), '[]'::jsonb),
  'puestos', coalesce((select jsonb_agg(jsonb_build_object('id', pu.id, 'nombre', pu.nombre) order by pu.nombre)
                       from rrhh.puestos pu where pu.company_id = p_company_id), '[]'::jsonb),
  'empleados', coalesce((select jsonb_agg(jsonb_build_object(
       'id', e.id,
       'label', e.apellido || ', ' || e.nombre || ' (' || e.codigo_empleado || ')',
       'contratos', (select jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero_contrato, 'estado', c.estado)
                                      order by c.numero_contrato)
                     from rrhh.contratos c
                     where c.empleado_id = e.id and c.company_id = p_company_id and c.estado in ('activo','finalizado')))
     order by e.apellido, e.nombre)
     from rrhh.empleados e
     where e.company_id = p_company_id
       and exists (select 1 from rrhh.contratos c where c.empleado_id = e.id and c.company_id = p_company_id
                   and c.estado in ('activo','finalizado'))), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- auditoría de exportación

create function public.asistencia_registrar_exportacion(
  p_company_id uuid, p_reporte text, p_formato text, p_filtros jsonb, p_filas integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_empresa text; v_ruc text; v_por text; v_ahora timestamptz := clock_timestamp();
begin
 if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.exportar') then
   raise exception 'Sin permiso' using errcode = '42501';
 end if;
 if p_reporte is null or p_reporte not in ('diaria','resumen','tardanzas','incidencias','tarjeta')
    or p_formato is null or p_formato not in ('pdf','impresion')
    or p_filas is null or p_filas < 0 or (p_filtros is not null and jsonb_typeof(p_filtros) <> 'object') then
   raise exception 'Filtros invalidos' using errcode = '22023';
 end if;
 select co.name, co.tax_id into v_empresa, v_ruc from core.companies co where co.id = p_company_id;
 select coalesce(u.raw_user_meta_data->>'full_name', u.email) into v_por from auth.users u where u.id = auth.uid();
 perform core.fn_auditar(auth.uid(), p_company_id, 'rrhh.asistencia.reporte.exportado', 'asistencia_reporte',
   p_reporte, jsonb_build_object('formato', p_formato, 'filtros', coalesce(p_filtros, '{}'::jsonb), 'filas', p_filas));
 return jsonb_build_object('emitido_en', v_ahora, 'emitido_por', v_por, 'empresa', v_empresa, 'empresa_ruc', v_ruc);
end $$;

-- ---------------------------------------------------------------- privilegios

revoke execute on function rrhh.fn_reporte_validar(uuid,date,date,text) from public, anon, authenticated;
revoke execute on function rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer) from public, anon;
revoke execute on function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid) from public, anon;
revoke execute on function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon;
revoke execute on function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon;
revoke execute on function public.asistencia_reporte_opciones(uuid) from public, anon;
revoke execute on function public.asistencia_registrar_exportacion(uuid,text,text,jsonb,integer) from public, anon;
grant execute on function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer) to authenticated;
grant execute on function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;
grant execute on function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;
grant execute on function public.asistencia_reporte_opciones(uuid) to authenticated;
grant execute on function public.asistencia_registrar_exportacion(uuid,text,text,jsonb,integer) to authenticated;

notify pgrst, 'reload schema';

do $$
begin
  if has_function_privilege('authenticated', 'rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'postcheck: el núcleo quedó ejecutable por la API';
  end if;
  if has_function_privilege('anon', 'public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)', 'execute')
     or has_function_privilege('anon', 'public.asistencia_registrar_exportacion(uuid,text,text,jsonb,integer)', 'execute') then
    raise exception 'postcheck: un reporte quedó abierto a anon';
  end if;
  if not has_function_privilege('authenticated', 'public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)', 'execute') then
    raise exception 'postcheck: authenticated no puede consultar el reporte diario';
  end if;
end;
$$;
