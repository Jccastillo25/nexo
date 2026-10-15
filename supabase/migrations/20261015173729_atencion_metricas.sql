-- Atención: métricas para los dashboards (plan 13 §6.2, aprobado 2026-10-15).
--
-- public.atencion_metricas(company, desde, hasta, sucursal?, solo_mias)
--   * solo_mias = true  → métricas del usuario de la sesión. Exige
--     atencion.reportes.mis_metricas.ver o atencion.reportes.turno.ver.
--   * solo_mias = false → todas las sucursales permitidas (o la indicada), con
--     desglose por agente y por puesto. Exige atencion.reportes.turno.ver.
--   * Sucursales: solo las que el usuario puede ver (atencion.fn_puede_sucursal).
--   * Rango por fecha local del turno, máximo 92 días.
--
-- Reglas (decisión del usuario): "no se presentó" no entra en espera ni en
-- atención; se cuenta aparte (eventos 'ausente', así un turno reactivado que
-- vuelve a faltar cuenta dos veces). Tiempos en segundos:
--   espera   = inicio_atencion_en - en_fila_desde   (solo atendidos)
--   atención = finalizado_en      - inicio_atencion_en (solo atendidos)
-- Sin DROP ni UPDATE: solo funciones nuevas.
do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'atencion.reportes.mis_metricas.ver') then
    raise exception 'precheck: falta el Paso Cero de métricas (20261015165620)';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'atencion' and table_name = 'turnos' and column_name = 'en_fila_desde') then
    raise exception 'precheck: falta atencion.turnos.en_fila_desde (20261015172012)';
  end if;
end;
$$;

create or replace function public.atencion_metricas(
  p_company_id uuid,
  p_desde date,
  p_hasta date,
  p_sucursal_id uuid default null,
  p_solo_mias boolean default false
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_global boolean;
  v_sucursales uuid[];
  v_agente uuid;
  v_ini timestamptz;
  v_fin timestamptz;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Iniciá sesión.';
  end if;
  v_global := core.has_permission(v_uid, p_company_id, 'atencion.reportes.turno.ver');
  if p_solo_mias then
    if not (v_global or core.has_permission(v_uid, p_company_id, 'atencion.reportes.mis_metricas.ver')) then
      raise exception using errcode = '42501', message = 'No tenés permiso para ver tus métricas.';
    end if;
    v_agente := v_uid;
  elsif not v_global then
    raise exception using errcode = '42501', message = 'No tenés permiso para ver los reportes de Atención.';
  end if;

  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas inválido.';
  end if;
  if p_hasta - p_desde > 92 then
    raise exception 'El rango no puede superar 92 días.';
  end if;

  select array_agg(s.id) into v_sucursales
  from core.sucursales s
  where s.company_id = p_company_id
    and (p_sucursal_id is null or s.id = p_sucursal_id)
    and atencion.fn_puede_sucursal(v_uid, p_company_id, s.id);
  if v_sucursales is null then
    raise exception 'No tenés sucursales para consultar.';
  end if;

  -- Margen de ±2 días sobre la fecha local para que el planificador recorte particiones.
  v_ini := (p_desde - 2)::timestamptz;
  v_fin := (p_hasta + 3)::timestamptz;

  with turnos as (
    select t.*, s.zona_horaria
    from atencion.turnos t
    join core.sucursales s on s.id = t.sucursal_id
    where t.company_id = p_company_id
      and t.sucursal_id = any (v_sucursales)
      and t.fecha_local between p_desde and p_hasta
      and t.creado_en >= v_ini and t.creado_en < v_fin
  ),
  atendidos as (
    select t.*,
           extract(epoch from (t.inicio_atencion_en - t.en_fila_desde)) as espera_s,
           extract(epoch from (t.finalizado_en - t.inicio_atencion_en)) as atencion_s
    from turnos t
    where t.estado = 'atendido'
      and t.inicio_atencion_en is not null and t.finalizado_en is not null
      and t.finalizado_en >= t.inicio_atencion_en
      and t.inicio_atencion_en >= t.en_fila_desde
      and (v_agente is null or t.atendido_por = v_agente)
  ),
  ausencias as (
    select e.user_id, e.puesto_id, t.fecha_local
    from atencion.turno_eventos e
    join turnos t on t.id = e.turno_id
    where e.tipo = 'ausente'
      and e.creado_en >= v_ini and e.creado_en < v_fin
      and (v_agente is null or e.user_id = v_agente)
  ),
  sesiones as (
    select se.user_id,
           sum(extract(epoch from (coalesce(se.fin, now()) - se.inicio))) as segundos
    from atencion.sesiones se
    where se.company_id = p_company_id
      and se.sucursal_id = any (v_sucursales)
      and se.tipo = 'puesto'
      and se.fecha_local between p_desde and p_hasta
      and se.inicio >= v_ini and se.inicio < v_fin
      and (v_agente is null or se.user_id = v_agente)
    group by se.user_id
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'solo_mias', p_solo_mias,
    'resumen', jsonb_build_object(
      'turnos', case when v_agente is null then (select count(*) from turnos) end,
      'atendidos', (select count(*) from atendidos),
      'no_se_presento', (select count(*) from ausencias),
      'anulados', case when v_agente is null then (select count(*) from turnos where estado = 'anulado') end,
      'vencidos', case when v_agente is null then (select count(*) from turnos where estado = 'expirado') end,
      'en_curso', case when v_agente is null then (select count(*) from turnos where estado in ('esperando', 'llamado')) end,
      'reactivados', (select count(*) from turnos t where t.reactivaciones > 0
                       and (v_agente is null or t.atendido_por = v_agente)),
      'fuera_de_orden', (select count(*) from atendidos where fuera_de_orden),
      'espera_prom', (select round(avg(espera_s)) from atendidos),
      'espera_mediana', (select round(percentile_cont(0.5) within group (order by espera_s)) from atendidos),
      'espera_max', (select round(max(espera_s)) from atendidos),
      'atencion_prom', (select round(avg(atencion_s)) from atendidos),
      'atencion_mediana', (select round(percentile_cont(0.5) within group (order by atencion_s)) from atendidos),
      'atencion_max', (select round(max(atencion_s)) from atendidos),
      'sesion_segundos', (select round(coalesce(sum(segundos), 0)) from sesiones)
    ),
    -- Global: llegada de clientes (alta del turno). Mis métricas: inicio de cada atención.
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', h.hora, 'turnos', h.n) order by h.hora)
      from (
        select extract(hour from (x.momento at time zone x.zona_horaria))::int as hora, count(*) as n
        from (
          select t.creado_en as momento, t.zona_horaria from turnos t where v_agente is null
          union all
          select a.inicio_atencion_en, a.zona_horaria from atendidos a where v_agente is not null
        ) x
        group by 1
      ) h
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', d.fecha, 'atendidos', d.atendidos, 'no_se_presento', d.ausentes,
               'espera_prom', d.espera_prom, 'atencion_prom', d.atencion_prom) order by d.fecha)
      from (
        select f.fecha,
               (select count(*) from atendidos a where a.fecha_local = f.fecha) as atendidos,
               (select count(*) from ausencias u where u.fecha_local = f.fecha) as ausentes,
               (select round(avg(a.espera_s)) from atendidos a where a.fecha_local = f.fecha) as espera_prom,
               (select round(avg(a.atencion_s)) from atendidos a where a.fecha_local = f.fecha) as atencion_prom
        from (select generate_series(p_desde, p_hasta, interval '1 day')::date as fecha) f
      ) d
    ), '[]'::jsonb),
    'por_agente', case when v_agente is null then coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', g.user_id,
               'nombre', coalesce(pf.nombre_completo, 'Usuario sin nombre'),
               'atendidos', g.atendidos, 'no_se_presento', g.ausentes,
               'espera_prom', g.espera_prom, 'atencion_prom', g.atencion_prom,
               'atencion_mediana', g.atencion_mediana, 'fuera_de_orden', g.fuera_de_orden,
               'sesion_segundos', round(coalesce(se.segundos, 0)))
             order by g.atendidos desc, pf.nombre_completo)
      from (
        select u.user_id,
               count(a.id) as atendidos,
               (select count(*) from ausencias x where x.user_id = u.user_id) as ausentes,
               round(avg(a.espera_s)) as espera_prom,
               round(avg(a.atencion_s)) as atencion_prom,
               round(percentile_cont(0.5) within group (order by a.atencion_s)) as atencion_mediana,
               count(*) filter (where a.fuera_de_orden) as fuera_de_orden
        from (
          select atendido_por as user_id from atendidos
          union select user_id from ausencias
          union select user_id from sesiones
        ) u
        left join atendidos a on a.atendido_por = u.user_id
        where u.user_id is not null
        group by u.user_id
      ) g
      left join core.perfiles pf on pf.user_id = g.user_id
      left join sesiones se on se.user_id = g.user_id
    ), '[]'::jsonb) end,
    'por_puesto', case when v_agente is null then coalesce((
      select jsonb_agg(jsonb_build_object(
               'puesto', q.nombre, 'atendidos', q.atendidos, 'atencion_prom', q.atencion_prom) order by q.nombre)
      from (
        select p.nombre, count(a.id) as atendidos, round(avg(a.atencion_s)) as atencion_prom
        from atendidos a
        join atencion.puestos p on p.id = a.puesto_id
        group by p.id, p.nombre
      ) q
    ), '[]'::jsonb) end
  ) into v_res;

  return v_res;
end;
$$;
revoke all on function public.atencion_metricas(uuid, date, date, uuid, boolean) from public, anon;
grant execute on function public.atencion_metricas(uuid, date, date, uuid, boolean) to authenticated;

-- Sucursales para el filtro de los reportes (las que el usuario puede ver).
create or replace function public.atencion_sucursales_reportes(p_company_id uuid)
returns table (id uuid, nombre text) language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (
    core.has_permission(v_uid, p_company_id, 'atencion.reportes.turno.ver')
    or core.has_permission(v_uid, p_company_id, 'atencion.reportes.mis_metricas.ver')
  ) then
    raise exception using errcode = '42501', message = 'No tenés permiso para ver los reportes de Atención.';
  end if;
  return query
  select s.id, s.nombre from core.sucursales s
  where s.company_id = p_company_id and atencion.fn_puede_sucursal(v_uid, p_company_id, s.id)
  order by s.nombre;
end;
$$;
revoke all on function public.atencion_sucursales_reportes(uuid) from public, anon;
grant execute on function public.atencion_sucursales_reportes(uuid) to authenticated;
