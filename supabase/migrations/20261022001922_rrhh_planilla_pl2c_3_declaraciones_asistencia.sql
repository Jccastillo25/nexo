-- =============================================================================
-- PL2c de Planilla, parte 3 de 3: declaraciones, importación desde Asistencia, privilegios y poscheques
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10. Declaraciones del mes (planillas aprobadas o pagadas por periodo_fin)
-- -----------------------------------------------------------------------------
-- Montos = suma de las líneas ya redondeadas de las planillas, igual que en la
-- colilla. El formato del archivo oficial (SIE, VET) queda para PL6.
create function public.planilla_declaracion_inss(p_company_id uuid, p_mes date)
returns table (empleado_id uuid, empleado_nombre text, documento_identidad text, numero_inss text, dias numeric,
               salario_inss numeric, inss_laboral numeric, inss_patronal numeric)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.declaraciones.generar');
  v_ini date;
  v_fin date;
  v_n integer;
begin
  if p_mes is null then
    raise exception 'Indica el mes de la declaración.';
  end if;
  v_ini := date_trunc('month', p_mes)::date;
  v_fin := (v_ini + interval '1 month - 1 day')::date;
  return query
  with q as (
    -- Solo planillas ordinarias: el aguinaldo no cotiza (art. 97).
    select pl.id, pl.periodo_fin
    from rrhh.planillas pl join rrhh.planilla_tipos t on t.id = pl.planilla_tipo_id and t.company_id = pl.company_id
    where pl.company_id = p_company_id and pl.estado in ('aprobada', 'pagada') and pl.periodo_fin between v_ini and v_fin
      and t.clase = 'ordinaria'
  ), e as (
    -- Solo contratos que cotizan.
    select pe.id as peid, pe.empleado_id as eid, pe.dias_pagados as dp, q.periodo_fin as pf
    from rrhh.planilla_empleados pe join q on q.id = pe.planilla_id
    where pe.company_id = p_company_id and pe.regimen_inss <> 'ninguno'
  ), l as (
    -- La base del INSS es la de la línea (ya con el techo por persona).
    select e.peid,
           coalesce(sum(li.base) filter (where li.concepto_codigo = 'INSS_LABORAL'), 0) as base,
           coalesce(sum(li.monto) filter (where li.concepto_codigo = 'INSS_LABORAL'), 0) as lab,
           coalesce(sum(li.monto) filter (where li.concepto_codigo = 'INSS_PATRONAL'), 0) as pat
    from e join rrhh.planilla_lineas li on li.planilla_empleado_id = e.peid and li.periodo_fin = e.pf
                                       and li.company_id = p_company_id
    where li.concepto_codigo in ('INSS_LABORAL', 'INSS_PATRONAL')
    group by e.peid
  ), s as (
    select e.eid, coalesce(sum(e.dp), 0) as dias,
           coalesce(sum(l.base), 0) as base, coalesce(sum(l.lab), 0) as lab, coalesce(sum(l.pat), 0) as pat
    from e left join l on l.peid = e.peid
    group by e.eid
  )
  select s.eid, em.nombre || ' ' || em.apellido, em.documento_identidad,
         null::text,  -- numero_inss: el expediente todavía no guarda el número de afiliación al INSS.
         s.dias, s.base, s.lab, s.pat
  from s join rrhh.empleados em on em.id = s.eid and em.company_id = p_company_id
  where s.base <> 0 or s.lab <> 0 or s.pat <> 0   -- sin filas en cero
  order by 2, 1;
  get diagnostics v_n = row_count;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.declaracion_generada', 'rrhh.planillas',
    to_char(v_ini, 'YYYY-MM'), jsonb_build_object('declaracion', 'inss', 'mes', to_char(v_ini, 'YYYY-MM'), 'filas', v_n));
end;
$$;

create function public.planilla_declaracion_inatec(p_company_id uuid, p_mes date)
returns table (base numeric, tasa numeric, monto numeric, empleados integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.declaraciones.generar');
  v_ini date;
  v_fin date;
  v_n integer;
begin
  if p_mes is null then
    raise exception 'Indica el mes de la declaración.';
  end if;
  v_ini := date_trunc('month', p_mes)::date;
  v_fin := (v_ini + interval '1 month - 1 day')::date;
  -- Una fila por tasa (más de una solo si la tasa cambió dentro del mes).
  return query
  select sum(l.base), l.tasa, sum(l.monto), count(distinct pe.empleado_id)::integer
  from rrhh.planillas pl
  join rrhh.planilla_empleados pe on pe.planilla_id = pl.id and pe.company_id = pl.company_id
  join rrhh.planilla_lineas l on l.planilla_empleado_id = pe.id and l.periodo_fin = pl.periodo_fin
                             and l.company_id = pl.company_id and l.concepto_codigo = 'INATEC'
  where pl.company_id = p_company_id and pl.estado in ('aprobada', 'pagada') and pl.periodo_fin between v_ini and v_fin
  group by l.tasa
  order by l.tasa;
  get diagnostics v_n = row_count;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.declaracion_generada', 'rrhh.planillas',
    to_char(v_ini, 'YYYY-MM'), jsonb_build_object('declaracion', 'inatec', 'mes', to_char(v_ini, 'YYYY-MM'), 'filas', v_n));
end;
$$;

-- Una fila por persona y régimen (rentas del trabajo y servicios profesionales
-- se declaran distinto). renta_neta = devengado que afecta IR − INSS laboral.
create function public.planilla_declaracion_ir(p_company_id uuid, p_mes date)
returns table (empleado_id uuid, empleado_nombre text, documento_identidad text, renta_bruta numeric,
               inss_laboral numeric, renta_neta numeric, ir_retenido numeric, regimen text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.declaraciones.generar');
  v_ini date;
  v_fin date;
  v_n integer;
begin
  if p_mes is null then
    raise exception 'Indica el mes de la declaración.';
  end if;
  v_ini := date_trunc('month', p_mes)::date;
  v_fin := (v_ini + interval '1 month - 1 day')::date;
  return query
  with s as (
    select pe.empleado_id as eid, pe.regimen as reg,
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_ir), 0) as bruta,
           coalesce(sum(l.monto) filter (where l.concepto_codigo = 'INSS_LABORAL'), 0) as inss,
           coalesce(sum(l.monto) filter (where l.concepto_codigo in ('IR', 'IR_SP')), 0) as ir
    from rrhh.planillas pl
    -- Solo planillas ordinarias: el aguinaldo no retiene IR (art. 97).
    join rrhh.planilla_tipos t on t.id = pl.planilla_tipo_id and t.company_id = pl.company_id and t.clase = 'ordinaria'
    join rrhh.planilla_empleados pe on pe.planilla_id = pl.id and pe.company_id = pl.company_id
    left join rrhh.planilla_lineas l on l.planilla_empleado_id = pe.id and l.periodo_fin = pl.periodo_fin
                                    and l.company_id = pl.company_id
    where pl.company_id = p_company_id and pl.estado in ('aprobada', 'pagada') and pl.periodo_fin between v_ini and v_fin
    group by pe.empleado_id, pe.regimen
  )
  select s.eid, em.nombre || ' ' || em.apellido, em.documento_identidad, s.bruta, s.inss, s.bruta - s.inss, s.ir, s.reg
  from s join rrhh.empleados em on em.id = s.eid and em.company_id = p_company_id
  where s.bruta <> 0 or s.inss <> 0 or s.ir <> 0   -- sin filas en cero
  order by 2, 8, 1;
  get diagnostics v_n = row_count;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.declaracion_generada', 'rrhh.planillas',
    to_char(v_ini, 'YYYY-MM'), jsonb_build_object('declaracion', 'ir', 'mes', to_char(v_ini, 'YYYY-MM'), 'filas', v_n));
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Horas extra y ausencias desde Asistencia
-- -----------------------------------------------------------------------------
-- Núcleo interno (sin EXECUTE para la API). rrhh.fn_asistencia_dias exige
-- rrhh.asistencia.reportes.ver a auth.uid(): el llamador debe tenerlo. p_hoy
-- excluye el día en curso y los siguientes. Devuelve también el concepto y la
-- clave de idempotencia para la importación.
create function rrhh.fn_planilla_asistencia_propuesta(p_company_id uuid, p_planilla_id uuid, p_hoy date)
returns table (contrato_id uuid, numero_contrato bigint, empleado_nombre text, fecha date, concepto_codigo text,
               concepto_id uuid, cantidad numeric, clave uuid, ya_importada boolean, detalle text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  p rrhh.planillas;
  v_hasta date;
  v_max_dia numeric;
  v_max_semana numeric;
  v_frac numeric;
begin
  select * into p from rrhh.planillas x where x.id = p_planilla_id and x.company_id = p_company_id;
  if not found then
    return;
  end if;
  v_hasta := least(p.periodo_fin, p_hoy - 1);
  if v_hasta < p.periodo_inicio then
    return;
  end if;
  v_max_dia := rrhh.fn_planilla_parametro(p_company_id, 'horas_extra_max_dia', p.periodo_fin);
  v_max_semana := rrhh.fn_planilla_parametro(p_company_id, 'horas_extra_max_semana', p.periodo_fin);
  v_frac := rrhh.fn_planilla_parametro(p_company_id, 'horas_extra_fraccion_minutos', p.periodo_fin);
  if v_frac <= 0 then
    raise exception 'El parámetro horas extra fraccion minutos debe ser mayor que cero.';
  end if;

  return query
  with k as (
    select x.contrato_id as cid, x.empleado_id as eid, x.numero_contrato as num, x.ini, x.fin
    from rrhh.fn_planilla_contratos(p.id) x
  ), d as (
    select a.contrato_id as cid, a.fecha as f, a.estado as est, a.minutos_sobre_jornada as msj
    from rrhh.fn_asistencia_dias(p_company_id, p.periodo_inicio, v_hasta) a
  ), pr as (
    -- Horas extra: minutos sobre la jornada redondeados hacia abajo a la fracción del parámetro.
    select k.cid, k.eid, k.num, d.f, 'HORAS_EXTRA'::text as cod,
           round(floor(d.msj::numeric / v_frac) * v_frac / 60, 4) as cant, d.msj, false as vac_solicitada
    from k join d on d.cid = k.cid and d.f between k.ini and k.fin
    where d.msj >= v_frac
    union all
    -- Ausencia: día laborable con jornada, sin feriado y sin marcas, que no está
    -- en un goce de vacaciones aprobado (si solo está solicitado, se avisa).
    select k.cid, k.eid, k.num, d.f, 'AUSENCIA'::text, 1::numeric, null::integer,
           exists (select 1 from rrhh.vacaciones_movimientos v
                   where v.company_id = p_company_id and v.contrato_id = k.cid and v.tipo = 'goce'
                     and v.estado = 'solicitada' and v.fecha_inicio <= d.f and v.fecha_fin >= d.f)
    from k join d on d.cid = k.cid and d.f between k.ini and k.fin
    where d.est = 'sin_marcas'
      and not exists (select 1 from rrhh.vacaciones_movimientos v
                      where v.company_id = p_company_id and v.contrato_id = k.cid and v.tipo = 'goce'
                        and v.estado = 'aprobada' and v.fecha_inicio <= d.f and v.fecha_fin >= d.f)
  ), pc as (
    select pr.*, co.id as coid,
           md5('asistencia:' || pr.cid::text || ':' || to_char(pr.f, 'YYYY-MM-DD') || ':' || pr.cod)::uuid as cla
    from pr join rrhh.conceptos co on co.company_id = p_company_id and co.codigo = pr.cod
  ), ex as (
    select pc.*, n.estado as nest, n.origen as norig, date_trunc('week', pc.f::timestamp)::date as sem,
           (select coalesce(sum(o.cantidad), 0) from rrhh.novedades o
            where o.company_id = p_company_id and o.contrato_id = pc.cid and o.concepto_id = pc.coid
              and o.fecha = pc.f and o.estado <> 'anulada') as dia_existente,
           (select count(*) from rrhh.novedades o
            where o.company_id = p_company_id and o.contrato_id = pc.cid and o.concepto_id = pc.coid
              and o.fecha = pc.f and o.estado <> 'anulada' and o.clave_idempotencia is distinct from pc.cla) as otras
    from pc
    left join rrhh.novedades n on n.company_id = p_company_id and n.clave_idempotencia = pc.cla and n.fecha = pc.f
  ), t as (
    -- Lo que vería el motor si se importa lo pendiente: lo ya registrado más lo propuesto sin importar.
    select ex.*,
           (case when ex.nest is null then ex.cant else 0 end) + ex.dia_existente as dia_total,
           sum(case when ex.nest is null then ex.cant else 0 end) over (partition by ex.cid, ex.cod, ex.sem)
             + (select coalesce(sum(o.cantidad), 0) from rrhh.novedades o
                where o.company_id = p_company_id and o.contrato_id = ex.cid and o.concepto_id = ex.coid
                  and o.estado <> 'anulada' and o.fecha between ex.sem and ex.sem + 6) as sem_total
    from ex
  )
  select t.cid, t.num, em.nombre || ' ' || em.apellido, t.f, t.cod, t.coid, t.cant, t.cla, t.nest is not null,
         concat_ws('. ',
           case when t.cod = 'HORAS_EXTRA' then format('%s min sobre la jornada. Confirma que fueron autorizadas', t.msj)
                else 'Día laborable sin marcas: confirma que no fue permiso ni vacaciones' end,
           case when t.vac_solicitada then 'Hay vacaciones solicitadas ese día: si se aprueban, no es una ausencia' end,
           -- La clave ya está tomada (no se vuelve a importar); solo es "importada" si vino de asistencia.
           case when t.nest is not null and t.norig <> 'asistencia' then 'Ya hay una novedad manual con la clave de esta fila'
                when t.nest = 'anulada' then 'Ya importada y anulada' when t.nest is not null then 'Ya importada' end,
           case when t.otras > 0 then 'Ya hay otra novedad de este concepto ese día' end,
           case when t.cod = 'HORAS_EXTRA' and t.dia_total > v_max_dia
                then format('Supera el tope de %s h por día: el cálculo la rechazará', trim_scale(v_max_dia)) end,
           case when t.cod = 'HORAS_EXTRA' and t.sem_total > v_max_semana
                then format('La semana suma %s h y supera el tope de %s h: el cálculo la rechazará',
                            trim_scale(t.sem_total), trim_scale(v_max_semana)) end)
  from t join rrhh.empleados em on em.id = t.eid and em.company_id = p_company_id;
end;
$$;

create function public.planilla_asistencia_propuesta(p_company_id uuid, p_planilla_id uuid)
returns table (contrato_id uuid, numero_contrato bigint, empleado_nombre text, fecha date, concepto_codigo text,
               cantidad numeric, ya_importada boolean, detalle text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.crear');
  v_estado text;
  v_clase text;
begin
  -- Leer marcas exige el permiso de reportes de Asistencia.
  perform core.fn_exigir_permiso(p_company_id, 'rrhh.asistencia.reportes.ver');
  select q.estado, t.clase into v_estado, v_clase
  from rrhh.planillas q join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id and t.company_id = q.company_id
  where q.id = p_planilla_id and q.company_id = p_company_id;
  if v_estado is null then
    raise exception 'Planilla no encontrada.';
  end if;
  if v_clase <> 'ordinaria' then
    raise exception 'La asistencia se importa solo en planillas ordinarias.';
  end if;
  if v_estado not in ('borrador', 'calculada') then
    raise exception 'La planilla está % y ya no recibe novedades. Regístralas en el período siguiente.', v_estado;
  end if;
  return query
  select z.contrato_id, z.numero_contrato, z.empleado_nombre, z.fecha, z.concepto_codigo, z.cantidad, z.ya_importada,
         z.detalle
  from rrhh.fn_planilla_asistencia_propuesta(p_company_id, p_planilla_id, (now() at time zone 'America/Managua')::date) z
  order by z.empleado_nombre, z.numero_contrato, z.fecha, z.concepto_codigo;
end;
$$;

-- Crea las novedades elegidas de la propuesta. Idempotente: una fila ya
-- importada (aunque después se haya anulado) no se vuelve a crear. Todo o nada.
-- Rechaza una ausencia en un día con vacaciones aprobadas o con otra ausencia.
create function public.planilla_asistencia_importar(p_company_id uuid, p_planilla_id uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.crear');
  p rrhh.planillas;
  v_clase text;
  v_prop jsonb;
  v_fila jsonb;
  it record;
  v_filas integer;
  v_distintas integer;
  v_id uuid;
  v_nuevas integer := 0;
  v_marcadas integer;
  v_lote uuid := gen_random_uuid();
  v_frac numeric;
  v_otras numeric;
begin
  perform core.fn_exigir_permiso(p_company_id, 'rrhh.asistencia.reportes.ver');
  -- Mismo orden de bloqueo que planilla_novedad_crear (planillas, después novedades).
  select * into p from rrhh.planillas x where x.id = p_planilla_id and x.company_id = p_company_id for share;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  select t.clase into v_clase from rrhh.planilla_tipos t where t.id = p.planilla_tipo_id and t.company_id = p_company_id;
  if v_clase <> 'ordinaria' then
    raise exception 'La asistencia se importa solo en planillas ordinarias.';
  end if;
  if p.estado not in ('borrador', 'calculada') then
    raise exception 'La planilla está % y ya no recibe novedades. Regístralas en el período siguiente.', p.estado;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 1000 then
    raise exception 'Indica entre 1 y 1000 filas para importar.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x) <> 'object') then
    raise exception 'Hay filas con datos no válidos: cada una lleva contrato, fecha, concepto y cantidad.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x, jsonb_object_keys(x) k
             where k not in ('contrato_id', 'fecha', 'concepto_codigo', 'cantidad'))
     or exists (select 1 from jsonb_array_elements(p_items) x
                where jsonb_typeof(x->'contrato_id') is distinct from 'string'
                   or jsonb_typeof(x->'fecha') is distinct from 'string'
                   or jsonb_typeof(x->'concepto_codigo') is distinct from 'string'
                   or jsonb_typeof(x->'cantidad') is distinct from 'number'
                   or (x->>'contrato_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                   or (x->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                   or (x->>'concepto_codigo') not in ('HORAS_EXTRA', 'AUSENCIA')) then
    raise exception 'Hay filas con datos no válidos: cada una lleva contrato, fecha, concepto (horas extra o ausencia) y cantidad.';
  end if;
  begin
    select count(*), count(distinct y.cid::text || '|' || y.f::text || '|' || y.cod) into v_filas, v_distintas
    from (select (x->>'contrato_id')::uuid as cid, (x->>'fecha')::date as f, x->>'concepto_codigo' as cod,
                 (x->>'cantidad')::numeric as cant
          from jsonb_array_elements(p_items) x) y;
  exception when data_exception then
    raise exception 'Hay filas con fechas o cantidades no válidas.';
  end;
  if v_distintas <> v_filas then
    raise exception 'Hay filas repetidas en la importación.';
  end if;

  -- La propuesta vigente, una sola vez: solo se importa lo que muestra la asistencia.
  select coalesce(jsonb_object_agg(z.contrato_id::text || '|' || to_char(z.fecha, 'YYYY-MM-DD') || '|' || z.concepto_codigo,
           jsonb_build_object('cantidad', z.cantidad, 'concepto_id', z.concepto_id, 'clave', z.clave,
                              'ya', z.ya_importada)), '{}'::jsonb)
    into v_prop
  from rrhh.fn_planilla_asistencia_propuesta(p_company_id, p.id, (now() at time zone 'America/Managua')::date) z;

  v_frac := rrhh.fn_planilla_parametro(p_company_id, 'horas_extra_fraccion_minutos', p.periodo_fin);

  for it in select (x->>'contrato_id')::uuid as cid, (x->>'fecha')::date as f, x->>'concepto_codigo' as cod,
                   (x->>'cantidad')::numeric as cant
            from jsonb_array_elements(p_items) x
            order by 1, 2, 3 loop
    -- Un día con goce de vacaciones aprobado no es ausencia (la persona perdería salario).
    if it.cod = 'AUSENCIA' and exists (select 1 from rrhh.vacaciones_movimientos v
                                       where v.company_id = p_company_id and v.contrato_id = it.cid and v.tipo = 'goce'
                                         and v.estado = 'aprobada' and v.fecha_inicio <= it.f and v.fecha_fin >= it.f) then
      raise exception 'El % el contrato tiene vacaciones aprobadas: no es una ausencia.', to_char(it.f, 'DD/MM/YYYY');
    end if;
    v_fila := v_prop -> (it.cid::text || '|' || to_char(it.f, 'YYYY-MM-DD') || '|' || it.cod);
    if v_fila is null then
      raise exception 'La fila de % del % ya no está en la propuesta de asistencia de esta planilla. Vuelve a cargarla.',
        case it.cod when 'HORAS_EXTRA' then 'horas extra' else 'ausencia' end, to_char(it.f, 'DD/MM/YYYY');
    end if;
    if it.cod = 'HORAS_EXTRA' and (it.cant <= 0 or it.cant > (v_fila->>'cantidad')::numeric
                                   or round(round(it.cant * 60 / v_frac) * v_frac / 60, 4) <> it.cant) then
      raise exception 'Las horas extra del % no son válidas: van en fracciones de % minutos, mayores que cero y hasta lo que muestra la asistencia (% h).',
        to_char(it.f, 'DD/MM/YYYY'), trim_scale(v_frac), trim_scale((v_fila->>'cantidad')::numeric);
    end if;
    if it.cod = 'AUSENCIA' and it.cant <> (v_fila->>'cantidad')::numeric then
      raise exception 'La ausencia del % desde asistencia es de un día completo.', to_char(it.f, 'DD/MM/YYYY');
    end if;
    if (v_fila->>'ya')::boolean then
      continue;
    end if;
    -- No se descuentan dos ausencias por la misma fecha (lo ya registrado, no anulado, más lo nuevo hasta un día).
    if it.cod = 'AUSENCIA' then
      select coalesce(sum(n.cantidad), 0) into v_otras from rrhh.novedades n
      where n.company_id = p_company_id and n.contrato_id = it.cid and n.fecha = it.f
        and n.concepto_id = (v_fila->>'concepto_id')::uuid and n.estado <> 'anulada'
        and n.clave_idempotencia is distinct from (v_fila->>'clave')::uuid;
      if v_otras + it.cant > 1 then
        raise exception 'Ya hay una ausencia registrada el % para este contrato: no se descuenta dos veces el mismo día.',
          to_char(it.f, 'DD/MM/YYYY');
      end if;
    end if;
    -- Mismas validaciones que una novedad manual (contrato, concepto, planilla aprobada, partición).
    v_id := public.planilla_novedad_crear(p_company_id, it.cid, (v_fila->>'concepto_id')::uuid, it.f, it.cant, null,
              'Importada de asistencia', p.planilla_tipo_id, (v_fila->>'clave')::uuid);
    -- Solo la que creó esta transacción: no toma una novedad manual con la misma
    -- clave ni recuenta la de una importación simultánea.
    update rrhh.novedades n set origen = 'asistencia', lote = v_lote
    where n.id = v_id and n.fecha = it.f and n.company_id = p_company_id
      and n.origen = 'manual' and n.lote is null and n.creado_por = v_uid and n.created_at = now();
    get diagnostics v_marcadas = row_count;
    v_nuevas := v_nuevas + v_marcadas;
  end loop;

  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.asistencia_importada', 'rrhh.planillas', p.id::text,
    jsonb_build_object('lote', v_lote, 'filas', v_filas, 'nuevas', v_nuevas));
  return v_nuevas;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Privilegios de funciones
-- -----------------------------------------------------------------------------
revoke all on function rrhh.fn_planilla_asistencia_propuesta(uuid, uuid, date) from public, anon, authenticated;

revoke all on function
  public.planilla_detalle(uuid, uuid),
  public.planilla_comparar(uuid, uuid),
  public.planilla_contratos_opciones(uuid),
  public.planilla_novedades_listado(uuid, date, date, uuid),
  public.planilla_regimen_listado(uuid),
  public.planilla_simular_regimen(uuid, date),
  public.planilla_concepto_guardar(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean,
    boolean, boolean, boolean, integer, text, boolean),
  public.planilla_tipo_guardar(uuid, uuid, text, text, text, text, boolean),
  public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text),
  public.planilla_declaracion_inss(uuid, date),
  public.planilla_declaracion_inatec(uuid, date),
  public.planilla_declaracion_ir(uuid, date),
  public.planilla_asistencia_propuesta(uuid, uuid),
  public.planilla_asistencia_importar(uuid, uuid, jsonb)
from public, anon;
grant execute on function
  public.planilla_detalle(uuid, uuid),
  public.planilla_comparar(uuid, uuid),
  public.planilla_contratos_opciones(uuid),
  public.planilla_novedades_listado(uuid, date, date, uuid),
  public.planilla_regimen_listado(uuid),
  public.planilla_simular_regimen(uuid, date),
  public.planilla_concepto_guardar(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean,
    boolean, boolean, boolean, integer, text, boolean),
  public.planilla_tipo_guardar(uuid, uuid, text, text, text, text, boolean),
  public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text),
  public.planilla_declaracion_inss(uuid, date),
  public.planilla_declaracion_inatec(uuid, date),
  public.planilla_declaracion_ir(uuid, date),
  public.planilla_asistencia_propuesta(uuid, uuid),
  public.planilla_asistencia_importar(uuid, uuid, jsonb)
to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Poscheques
-- -----------------------------------------------------------------------------
do $$
declare
  v_f text;
begin
  foreach v_f in array array[
      'public.planilla_detalle(uuid,uuid)', 'public.planilla_comparar(uuid,uuid)',
      'public.planilla_contratos_opciones(uuid)', 'public.planilla_novedades_listado(uuid,date,date,uuid)',
      'public.planilla_regimen_listado(uuid)', 'public.planilla_simular_regimen(uuid,date)',
      'public.planilla_concepto_guardar(uuid,uuid,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,integer,text,boolean)',
      'public.planilla_tipo_guardar(uuid,uuid,text,text,text,text,boolean)',
      'public.planilla_ir_tabla_nueva(uuid,date,jsonb,text,text)',
      'public.planilla_declaracion_inss(uuid,date)', 'public.planilla_declaracion_inatec(uuid,date)',
      'public.planilla_declaracion_ir(uuid,date)', 'public.planilla_asistencia_propuesta(uuid,uuid)',
      'public.planilla_asistencia_importar(uuid,uuid,jsonb)'] loop
    if to_regprocedure(v_f) is null then
      raise exception 'postcheck: falta %', v_f;
    end if;
    if has_function_privilege('anon', v_f, 'EXECUTE') or not has_function_privilege('authenticated', v_f, 'EXECUTE') then
      raise exception 'postcheck: EXECUTE incorrecto en %', v_f;
    end if;
    if not exists (select 1 from pg_proc pr where pr.oid = to_regprocedure(v_f) and pr.prosecdef
                   and pr.proconfig @> array['search_path=""']) then
      raise exception 'postcheck: % sin security definer o sin search_path vacío', v_f;
    end if;
  end loop;
  if exists (select 1 from (select distinct company_id from rrhh.parametros_ley) e
             where (select count(*) from rrhh.parametros_ley pl where pl.company_id = e.company_id
                    and pl.codigo = 'horas_extra_fraccion_minutos' and pl.vigente_hasta is null) <> 1) then
    raise exception 'postcheck: falta horas_extra_fraccion_minutos en alguna empresa';
  end if;
  v_f := 'rrhh.fn_planilla_asistencia_propuesta(uuid,uuid,date)';
  if has_function_privilege('authenticated', v_f, 'EXECUTE') or has_function_privilege('anon', v_f, 'EXECUTE') then
    raise exception 'postcheck: el núcleo % es ejecutable por la API', v_f;
  end if;
  if not exists (select 1 from pg_proc pr where pr.oid = to_regprocedure(v_f) and pr.prosecdef
                 and pr.proconfig @> array['search_path=""']) then
    raise exception 'postcheck: % sin security definer o sin search_path vacío', v_f;
  end if;
end;
$$;
