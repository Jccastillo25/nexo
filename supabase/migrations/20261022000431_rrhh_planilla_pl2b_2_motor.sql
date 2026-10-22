-- =============================================================================
-- PL2b de Planilla, parte 2 de 5: motor (contratos, novedades, huella, cálculo ordinario y aguinaldo)
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5. Motor: contratos, novedades, huella y cálculo
-- -----------------------------------------------------------------------------
-- El aguinaldo toma los contratos de todas las frecuencias.
create or replace function rrhh.fn_planilla_contratos(p_planilla_id uuid)
returns table (contrato_id uuid, empleado_id uuid, numero_contrato bigint, ini date, fin date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.empleado_id, c.numero_contrato,
         greatest(p.periodo_inicio, c.fecha_inicio),
         least(p.periodo_fin, coalesce(c.fecha_fin_real, p.periodo_fin))
  from rrhh.planillas p
  join rrhh.planilla_tipos t on t.id = p.planilla_tipo_id and t.company_id = p.company_id
  join rrhh.contratos c on c.company_id = p.company_id
  join rrhh.contrato_compensacion cc on cc.contrato_id = c.id and cc.company_id = c.company_id
  where p.id = p_planilla_id
    and c.estado in ('activo', 'finalizado')
    and c.fecha_inicio is not null and c.fecha_inicio <= p.periodo_fin
    and (c.fecha_fin_real is null or c.fecha_fin_real >= p.periodo_inicio)
    and (t.clase = 'aguinaldo' or cc.frecuencia_pago = t.frecuencia)
$$;

-- Novedades de una planilla ordinaria: las del período, libres o ya suyas, y las
-- cuotas de préstamo vencidas que siguen pendientes.
drop function rrhh.fn_planilla_novedades(uuid);
create function rrhh.fn_planilla_novedades(p_planilla_id uuid)
returns table (id uuid, fecha date, contrato_id uuid, concepto_id uuid, codigo text, tipo text, metodo text,
               orden integer, cantidad numeric, monto numeric, updated_at timestamptz, prestamo_id uuid)
language sql stable security definer set search_path = '' as $$
  select n.id, n.fecha, n.contrato_id, n.concepto_id, co.codigo, co.tipo, co.metodo, co.orden,
         n.cantidad, n.monto, n.updated_at, n.prestamo_id
  from rrhh.planillas p
  join rrhh.planilla_tipos t on t.id = p.planilla_tipo_id and t.company_id = p.company_id and t.clase = 'ordinaria'
  join rrhh.novedades n on n.company_id = p.company_id
       and (n.fecha between p.periodo_inicio and p.periodo_fin
            or (n.prestamo_id is not null and n.fecha < p.periodo_inicio))
  join rrhh.conceptos co on co.id = n.concepto_id and co.company_id = n.company_id
  where p.id = p_planilla_id
    and n.estado <> 'anulada'
    and (n.planilla_id is null or n.planilla_id = p.id)
    and (n.planilla_tipo_id is null or n.planilla_tipo_id = p.planilla_tipo_id)
$$;

-- Huella de insumos (PL2a) + embargos con lo ya aplicado y las liquidaciones
-- aprobadas del período (aguinaldo).
create or replace function rrhh.fn_planilla_huella_insumos(p_planilla_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  p rrhh.planillas;
  v jsonb;
begin
  select * into p from rrhh.planillas where id = p_planilla_id;
  v := jsonb_build_object(
    'planilla', jsonb_build_object('tipo', p.planilla_tipo_id, 'ini', p.periodo_inicio, 'fin', p.periodo_fin),
    'contratos', (select coalesce(jsonb_agg(jsonb_build_object('id', k.contrato_id, 'e', k.empleado_id, 'ini', k.ini,
                    'fin', k.fin, 'ant', c.fecha_antiguedad, 'prev', c.fecha_fin_prevista, 'sal', cc.salario_base,
                    'frec', cc.frecuencia_pago, 'upd', extract(epoch from cc.updated_at)) order by k.contrato_id), '[]'::jsonb)
                  from rrhh.fn_planilla_contratos(p.id) k
                  join rrhh.contratos c on c.id = k.contrato_id
                  join rrhh.contrato_compensacion cc on cc.contrato_id = k.contrato_id),
    'regimen', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'desde', r.vigente_desde, 'hasta', r.vigente_hasta,
                  'r', r.regimen, 'i', r.regimen_inss, 'm', r.metodo_ir, 'p', r.porcentaje_ir, 'v', r.paga_vacaciones,
                  'a', r.paga_aguinaldo, 'x', r.paga_indemnizacion,
                  'aviso', extract(epoch from r.aviso_descartado_en)) order by r.id), '[]'::jsonb)
                from rrhh.contrato_regimen r join rrhh.fn_planilla_contratos(p.id) k on k.contrato_id = r.contrato_id
                where r.vigente_desde <= p.periodo_fin and (r.vigente_hasta is null or r.vigente_hasta >= p.periodo_inicio)),
    'jornadas', (select coalesce(jsonb_agg(jsonb_build_object('id', cj.id, 'desde', cj.vigente_desde, 'hasta', cj.vigente_hasta,
                   'dias', (select jsonb_agg(jsonb_build_object('d', jd.dia_semana, 'l', jd.laborable, 'e', jd.hora_entrada,
                              's', jd.hora_salida, 'm', jd.minutos_descanso) order by jd.dia_semana)
                            from rrhh.jornada_dias jd where jd.jornada_id = cj.jornada_id)) order by cj.id), '[]'::jsonb)
                 from rrhh.contrato_jornadas cj join rrhh.fn_planilla_contratos(p.id) k on k.contrato_id = cj.contrato_id
                 where cj.vigente_desde <= p.periodo_fin and (cj.vigente_hasta is null or cj.vigente_hasta >= p.periodo_inicio)),
    'novedades', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'c', n.contrato_id, 'k', n.concepto_id,
                    'f', n.fecha, 'q', n.cantidad, 'm', n.monto, 'u', extract(epoch from n.updated_at)) order by n.id), '[]'::jsonb)
                  from rrhh.fn_planilla_novedades(p.id) n join rrhh.fn_planilla_contratos(p.id) k on k.contrato_id = n.contrato_id),
    'embargos', (select coalesce(jsonb_agg(jsonb_build_object('id', em.id, 't', em.tipo, 'm', em.metodo, 'v', em.valor,
                   'tope', em.tope_total, 'desde', em.vigente_desde, 'hasta', em.vigente_hasta, 'est', em.estado,
                   'apl', (select coalesce(sum(l.monto), 0) from rrhh.planilla_lineas l join rrhh.planillas q on q.id = l.planilla_id
                           where l.company_id = p.company_id and l.contrato_id = em.contrato_id and em.id = any (l.origen_ids)
                             and q.estado in ('aprobada', 'pagada') and q.id <> p.id)) order by em.id), '[]'::jsonb)
                 from rrhh.embargos em join rrhh.fn_planilla_contratos(p.id) k on k.contrato_id = em.contrato_id
                 where em.vigente_desde <= p.periodo_fin and (em.vigente_hasta is null or em.vigente_hasta >= p.periodo_inicio)),
    'liquidaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'e', l.estado, 'f', l.fecha_egreso) order by l.id), '[]'::jsonb)
                      from rrhh.liquidaciones l
                      where l.company_id = p.company_id and l.estado in ('aprobada', 'pagada')
                        and l.fecha_egreso between p.periodo_inicio and p.periodo_fin
                        and l.empleado_id in (select k.empleado_id from rrhh.fn_planilla_contratos(p.id) k)),
    'parametros', (select coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'v', pl.valor) order by pl.codigo, pl.id), '[]'::jsonb)
                   from rrhh.parametros_ley pl
                   where pl.company_id = p.company_id and pl.vigente_desde <= p.periodo_fin
                     and (pl.vigente_hasta is null or pl.vigente_hasta >= p.periodo_fin)),
    'ir', (select coalesce(jsonb_agg(jsonb_build_array(it.id, it.desde, it.hasta, it.impuesto_base, it.porcentaje, it.sobre_exceso)
             order by it.desde), '[]'::jsonb)
           from rrhh.ir_tramos it
           where it.company_id = p.company_id and it.vigente_desde <= p.periodo_fin
             and (it.vigente_hasta is null or it.vigente_hasta >= p.periodo_fin)),
    -- Reglas de los conceptos: un cambio de reglas mientras se calcula o antes de aprobar invalida la huella.
    'conceptos', (select coalesce(jsonb_agg(jsonb_build_array(co.id, co.tipo, co.metodo, co.afecta_inss, co.afecta_ir,
                    co.afecta_inatec, co.cuenta_aguinaldo, co.cuenta_vacaciones, co.cuenta_indemnizacion, co.activo)
                    order by co.id), '[]'::jsonb)
                  from rrhh.conceptos co where co.company_id = p.company_id),
    'quincena1', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'h', q.hash_aprobado) order by q.id), '[]'::jsonb)
                  from rrhh.planillas q
                  where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id and q.id <> p.id
                    and q.estado <> 'anulada' and q.periodo_inicio = date_trunc('month', p.periodo_inicio)::date
                    and q.periodo_fin < p.periodo_inicio)
  );
  return encode(extensions.digest(v::text, 'sha256'), 'hex');
end;
$$;

-- Motor de la planilla ordinaria (PL2a) con: aguinaldo despachado aparte,
-- guarda de solape solo entre planillas ordinarias, devengados y deducciones
-- por días u horas de cualquier concepto, embargos, cuotas de préstamo que no
-- bloquean y cuotas vencidas.
create or replace function rrhh.fn_planilla_calcular_nucleo(p_planilla_id uuid, p_uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p rrhh.planillas;
  t rrhh.planilla_tipos;
  k record;
  r rrhh.contrato_regimen;
  nv record;
  em rrhh.embargos;
  n_reg integer;
  v_hash_ini text;
  v_pe uuid;
  v_dias_mes numeric;
  v_dias_base numeric;
  v_dias_contrato numeric;
  v_mensual numeric;
  v_diario numeric;
  v_horas_jornada numeric;
  v_fuera numeric;
  v_ausencias numeric;
  v_dias_pag numeric;
  v_ids uuid[];
  v_ids_usados uuid[];
  v_hx numeric;
  v_max numeric;
  v_factor numeric;
  v_tarifa numeric;
  v_dev_inss numeric;
  v_dev_ir numeric;
  v_dev_inatec numeric;
  v_dev numeric;
  v_dev_ag numeric;
  v_dev_ind numeric;
  v_base_inss numeric;
  v_prev_base numeric;
  v_techo numeric;
  v_tasa numeric;
  v_inss numeric;
  v_neta numeric;
  v_prev_neta numeric;
  v_prev_ir numeric;
  v_ir numeric;
  v_q1 rrhh.planillas;
  v_q1_neta numeric;
  v_q1_ir numeric;
  v_mes_ini date;
  v_disp numeric;
  v_base_emb numeric;
  v_emb numeric;
  v_dias_emb numeric;
  v_n_upd integer;
  v_sal_liq boolean;
  v_aplicado numeric;
  v_ded numeric;
  v_avisos text[];
  v_usados text[] := '{}';
  v_avisos_pl text[] := '{}';
  v_vac_pagadas boolean := false;
  v_emb_judicial boolean := false;
  v_sin_salario integer;
  v_otra_frec integer;
  v_n integer := 0;
  v_tot jsonb;
begin
  select * into p from rrhh.planillas where id = p_planilla_id for update;
  select * into t from rrhh.planilla_tipos where id = p.planilla_tipo_id;
  if t.clase = 'aguinaldo' then
    return rrhh.fn_planilla_calcular_aguinaldo(p_planilla_id, p_uid);
  end if;
  v_hash_ini := rrhh.fn_planilla_huella_insumos(p.id);
  v_mes_ini := date_trunc('month', p.periodo_inicio)::date;

  -- Regenerar desde cero: libera novedades (también cuotas vencidas) y borra renglones.
  update rrhh.novedades set estado = 'pendiente', planilla_id = null
  where planilla_id = p.id and estado = 'aplicada' and fecha <= p.periodo_fin;
  delete from rrhh.planilla_empleados where planilla_id = p.id;

  v_dias_mes := rrhh.fn_planilla_parametro(p.company_id, 'dias_mes_comercial', p.periodo_fin);
  v_usados := v_usados || 'dias_mes_comercial'::text;
  v_dias_base := case t.frecuencia when 'mensual' then v_dias_mes when 'quincenal' then v_dias_mes / 2 else 7 end;

  for k in select * from rrhh.fn_planilla_contratos(p.id) order by empleado_id, contrato_id loop
    v_n := v_n + 1;
    v_avisos := '{}';
    v_ids_usados := '{}';

    -- Un contrato no entra en dos planillas ordinarias vivas que se solapan.
    if exists (select 1 from rrhh.planilla_empleados e2 join rrhh.planillas q on q.id = e2.planilla_id
               join rrhh.planilla_tipos t2 on t2.id = q.planilla_tipo_id and t2.clase = 'ordinaria'
               where e2.contrato_id = k.contrato_id and q.id <> p.id and q.estado <> 'anulada'
                 and q.periodo_inicio <= p.periodo_fin and q.periodo_fin >= p.periodo_inicio) then
      raise exception 'El contrato % ya está en otra planilla del mismo período.', k.numero_contrato;
    end if;
    -- El salario hasta el egreso no se paga dos veces (planilla y liquidación).
    -- Una liquidación todavía calculada se corrige; una aprobada o pagada ya lo
    -- pagó: la planilla no paga días de salario a ese contrato y lo avisa.
    if exists (select 1 from rrhh.liquidaciones l where l.contrato_id = k.contrato_id and l.estado = 'calculada'
               and l.dias_salario_pendiente > 0 and l.fecha_egreso between p.periodo_inicio and p.periodo_fin) then
      raise exception 'El contrato % tiene una liquidación calculada que paga el salario pendiente de este período. Anúlala y créala con salario pendiente 0, o apruébala antes de calcular.', k.numero_contrato;
    end if;
    v_sal_liq := exists (select 1 from rrhh.liquidaciones l where l.contrato_id = k.contrato_id
                         and l.estado in ('aprobada', 'pagada') and l.dias_salario_pendiente > 0
                         and l.fecha_egreso between p.periodo_inicio and p.periodo_fin);

    -- Régimen: una sola vigencia que cubra todo el tramo del contrato.
    select count(*) into n_reg from rrhh.contrato_regimen cr
    where cr.contrato_id = k.contrato_id and cr.company_id = p.company_id
      and cr.vigente_desde <= k.fin and (cr.vigente_hasta is null or cr.vigente_hasta >= k.ini);
    if n_reg = 0 then
      raise exception 'El contrato % no tiene régimen de contratación vigente en el período. Asígnalo antes de calcular.', k.numero_contrato;
    elsif n_reg > 1 then
      raise exception 'El régimen del contrato % cambia dentro del período. Corrige la fecha del régimen para que empiece con un período.', k.numero_contrato;
    end if;
    select cr.* into r from rrhh.contrato_regimen cr
    where cr.contrato_id = k.contrato_id and cr.company_id = p.company_id
      and cr.vigente_desde <= k.fin and (cr.vigente_hasta is null or cr.vigente_hasta >= k.ini);
    if r.vigente_desde > k.ini then
      raise exception 'El régimen del contrato % empieza después del inicio del período. Corrige su fecha.', k.numero_contrato;
    end if;

    select cc.salario_base into v_mensual from rrhh.contrato_compensacion cc where cc.contrato_id = k.contrato_id;
    v_diario := round(v_mensual / v_dias_mes, 4);

    select round(max(case when jd.hora_salida > jd.hora_entrada
                          then extract(epoch from (jd.hora_salida - jd.hora_entrada)) / 3600
                          else 24 + extract(epoch from (jd.hora_salida - jd.hora_entrada)) / 3600 end
                     - jd.minutos_descanso / 60.0), 2)
      into v_horas_jornada
    from rrhh.contrato_jornadas cj
    join rrhh.jornada_dias jd on jd.jornada_id = cj.jornada_id and jd.laborable
    where cj.contrato_id = k.contrato_id and cj.vigente_desde <= k.fin
      and (cj.vigente_hasta is null or cj.vigente_hasta >= k.fin);

    insert into rrhh.planilla_empleados (company_id, planilla_id, contrato_id, empleado_id, contrato_regimen_id,
      periodo_inicio, periodo_fin, salario_mensual, salario_diario, horas_jornada, frecuencia, regimen, regimen_inss,
      metodo_ir, porcentaje_ir, paga_vacaciones, paga_aguinaldo, paga_indemnizacion)
    values (p.company_id, p.id, k.contrato_id, k.empleado_id, r.id, k.ini, k.fin, v_mensual, v_diario,
      v_horas_jornada, t.frecuencia, r.regimen, r.regimen_inss, r.metodo_ir, r.porcentaje_ir,
      r.paga_vacaciones, r.paga_aguinaldo, r.paga_indemnizacion)
    returning id into v_pe;

    -- 1. Días pagables (regla 30/360) y salario ordinario.
    if t.frecuencia = 'semanal' then
      v_dias_contrato := k.fin - k.ini + 1;
    else
      v_dias_contrato := rrhh.fn_planilla_dia_comercial(k.fin, v_dias_mes) - rrhh.fn_planilla_dia_comercial(k.ini, v_dias_mes) + 1;
    end if;
    v_fuera := greatest(0, v_dias_base - v_dias_contrato);
    select coalesce(sum(n.cantidad), 0), coalesce(array_agg(n.id), '{}') into v_ausencias, v_ids
    from rrhh.fn_planilla_novedades(p.id) n where n.contrato_id = k.contrato_id and n.codigo = 'AUSENCIA';
    v_ids_usados := v_ids_usados || v_ids;
    if v_ausencias > v_dias_base - v_fuera then
      v_avisos := v_avisos || 'Las ausencias superan los días del período'::text;
    end if;
    v_dias_pag := greatest(0, v_dias_base - v_fuera - v_ausencias);
    if v_sal_liq then
      v_dias_pag := 0;
      v_avisos := v_avisos || 'El salario hasta el egreso se pagó en la liquidación'::text;
    end if;
    perform rrhh.fn_planilla_linea(v_pe, 'SALARIO', v_dias_pag, 'dias', v_diario, null,
      case when v_sal_liq then 0
           when v_fuera = 0 and v_ausencias = 0 then v_mensual * v_dias_base / v_dias_mes else v_diario * v_dias_pag end,
      'sistema', v_ids, jsonb_build_object('dias_base', v_dias_base, 'dias_fuera', v_fuera, 'dias_ausencia', v_ausencias,
                                           'salario_en_liquidacion', v_sal_liq));

    -- 2. Devengados: horas extra, novedades por días u horas y de monto fijo.
    select coalesce(sum(n.cantidad), 0), coalesce(array_agg(n.id), '{}') into v_hx, v_ids
    from rrhh.fn_planilla_novedades(p.id) n where n.contrato_id = k.contrato_id and n.codigo = 'HORAS_EXTRA';
    if v_hx > 0 then
      v_max := rrhh.fn_planilla_parametro(p.company_id, 'horas_extra_max_dia', p.periodo_fin);
      if exists (select 1 from rrhh.fn_planilla_novedades(p.id) n where n.contrato_id = k.contrato_id
                 and n.codigo = 'HORAS_EXTRA' group by n.fecha having sum(n.cantidad) > v_max) then
        raise exception 'El contrato % tiene más de % horas extra en un día.', k.numero_contrato, trim_scale(v_max);
      end if;
      v_max := rrhh.fn_planilla_parametro(p.company_id, 'horas_extra_max_semana', p.periodo_fin);
      if exists (select 1 from rrhh.novedades n join rrhh.conceptos co on co.id = n.concepto_id
                 where n.company_id = p.company_id and n.contrato_id = k.contrato_id and co.codigo = 'HORAS_EXTRA'
                   and n.estado <> 'anulada'
                   and n.fecha between date_trunc('week', p.periodo_inicio)::date and date_trunc('week', p.periodo_fin)::date + 6
                 group by date_trunc('week', n.fecha) having sum(n.cantidad) > v_max) then
        raise exception 'El contrato % tiene más de % horas extra en una semana.', k.numero_contrato, trim_scale(v_max);
      end if;
      if v_horas_jornada is null or v_horas_jornada <= 0 then
        raise exception 'El contrato % no tiene jornada para calcular la tarifa por hora.', k.numero_contrato;
      end if;
      v_factor := rrhh.fn_planilla_parametro(p.company_id, 'factor_horas_extra', p.periodo_fin);
      perform rrhh.fn_planilla_linea(v_pe, 'HORAS_EXTRA', v_hx, 'horas', round(v_diario / v_horas_jornada, 4), v_factor,
        v_hx * (v_diario / v_horas_jornada) * v_factor, 'novedad', v_ids, jsonb_build_object('horas_jornada', v_horas_jornada));
      v_ids_usados := v_ids_usados || v_ids;
    end if;

    for nv in select * from rrhh.fn_planilla_novedades(p.id) n
              where n.contrato_id = k.contrato_id and n.tipo = 'devengado' and n.metodo in ('dias', 'horas')
                and n.codigo <> 'HORAS_EXTRA'
              order by n.orden, n.fecha, n.id loop
      if nv.metodo = 'horas' and (v_horas_jornada is null or v_horas_jornada <= 0) then
        raise exception 'El contrato % no tiene jornada para calcular la tarifa por hora.', k.numero_contrato;
      end if;
      v_tarifa := case nv.metodo when 'dias' then v_diario else round(v_diario / v_horas_jornada, 4) end;
      perform rrhh.fn_planilla_linea(v_pe, nv.codigo, nv.cantidad, nv.metodo, v_tarifa, null,
        case nv.metodo when 'dias' then nv.cantidad * v_diario else nv.cantidad * v_diario / v_horas_jornada end,
        'novedad', array[nv.id]);
      v_ids_usados := v_ids_usados || nv.id;
      if nv.codigo = 'VACACIONES_PAGADAS' then
        v_vac_pagadas := true;
      end if;
    end loop;

    for nv in select * from rrhh.fn_planilla_novedades(p.id) n
              where n.contrato_id = k.contrato_id and n.tipo = 'devengado' and n.metodo = 'fijo'
              order by n.orden, n.fecha, n.id loop
      perform rrhh.fn_planilla_linea(v_pe, nv.codigo, null, 'monto', null, null, nv.monto, 'novedad', array[nv.id]);
      v_ids_usados := v_ids_usados || nv.id;
    end loop;

    select coalesce(sum(l.monto) filter (where l.tipo = 'devengado'), 0),
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_inss), 0),
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_ir), 0),
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_inatec), 0),
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.cuenta_aguinaldo), 0),
           coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.cuenta_indemnizacion), 0)
      into v_dev, v_dev_inss, v_dev_ir, v_dev_inatec, v_dev_ag, v_dev_ind
    from rrhh.planilla_lineas l where l.planilla_empleado_id = v_pe and l.periodo_fin = p.periodo_fin;

    -- 3 y 4. Base INSS (techo prorrateado al período, por persona) e INSS laboral.
    v_inss := 0;
    v_base_inss := 0;
    if r.regimen_inss <> 'ninguno' then
      v_techo := rrhh.fn_planilla_parametro(p.company_id, 'techo_inss', p.periodo_fin);
      select coalesce(sum(l.base), 0) into v_prev_base
      from rrhh.planilla_lineas l join rrhh.planilla_empleados e2 on e2.id = l.planilla_empleado_id
      where l.planilla_id = p.id and l.periodo_fin = p.periodo_fin and e2.empleado_id = k.empleado_id
        and e2.id <> v_pe and l.concepto_codigo = 'INSS_LABORAL';
      v_base_inss := least(v_dev_inss, greatest(0, round(v_techo * v_dias_base / v_dias_mes, 2) - v_prev_base));
      v_tasa := rrhh.fn_planilla_parametro(p.company_id,
        case r.regimen_inss when 'integral' then 'inss_laboral' else 'inss_laboral_ivm' end, p.periodo_fin);
      v_usados := v_usados || array['techo_inss', case r.regimen_inss when 'integral' then 'inss_laboral' else 'inss_laboral_ivm' end];
      if v_base_inss > 0 then
        v_inss := rrhh.fn_planilla_linea(v_pe, 'INSS_LABORAL', null, 'porcentaje', v_base_inss, v_tasa, v_base_inss * v_tasa);
      end if;
    end if;

    -- 5. IR, por persona: suma la renta y resta lo retenido en sus otros
    -- contratos de esta planilla y, en la 2.ª quincena, en la 1.ª del mes.
    v_ir := 0;
    if r.metodo_ir = 'tabla_progresiva' then
      v_neta := v_dev_ir - v_inss;
      select coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_ir), 0)
             - coalesce(sum(l.monto) filter (where l.concepto_codigo = 'INSS_LABORAL'), 0),
             coalesce(sum(l.monto) filter (where l.concepto_codigo = 'IR'), 0)
        into v_prev_neta, v_prev_ir
      from rrhh.planilla_lineas l join rrhh.planilla_empleados e2 on e2.id = l.planilla_empleado_id
      where l.planilla_id = p.id and l.periodo_fin = p.periodo_fin and e2.empleado_id = k.empleado_id
        and e2.id <> v_pe and e2.metodo_ir = 'tabla_progresiva';
      if t.frecuencia = 'mensual' then
        v_ir := round(rrhh.fn_planilla_ir_anual(p.company_id, (v_neta + v_prev_neta) * 12, p.periodo_fin) / 12, 2) - v_prev_ir;
      elsif t.frecuencia = 'quincenal' and extract(day from p.periodo_fin) <= 15 then
        -- 1.ª quincena: mitad del IR proyectado (decisión 2026-10-21).
        v_ir := round(rrhh.fn_planilla_ir_anual(p.company_id, (v_neta + v_prev_neta) * 24, p.periodo_fin) / 24, 2) - v_prev_ir;
      elsif t.frecuencia = 'quincenal' then
        -- 2.ª quincena: IR del mes con todo lo devengado menos lo retenido en la 1.ª.
        v_q1_neta := 0;
        v_q1_ir := 0;
        v_q1 := null;
        select q.* into v_q1 from rrhh.planillas q
        where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id and q.estado <> 'anulada'
          and q.periodo_inicio = v_mes_ini and q.periodo_fin < p.periodo_inicio;
        if v_q1.id is null then
          if exists (select 1 from rrhh.contratos c2 where c2.company_id = p.company_id and c2.empleado_id = k.empleado_id
                     and c2.estado in ('activo', 'finalizado') and c2.fecha_inicio < p.periodo_inicio
                     and (c2.fecha_fin_real is null or c2.fecha_fin_real >= v_mes_ini)) then
            raise exception 'Falta la planilla de la primera quincena del mes: el IR de la segunda depende de ella.';
          end if;
        elsif v_q1.estado not in ('aprobada', 'pagada') then
          raise exception 'Aprueba primero la planilla de la primera quincena del mes: el IR de la segunda depende de ella.';
        else
          select coalesce(sum(l.monto) filter (where l.tipo = 'devengado' and l.afecta_ir), 0)
                 - coalesce(sum(l.monto) filter (where l.concepto_codigo = 'INSS_LABORAL'), 0),
                 coalesce(sum(l.monto) filter (where l.concepto_codigo = 'IR'), 0)
            into v_q1_neta, v_q1_ir
          from rrhh.planilla_lineas l join rrhh.planilla_empleados e2 on e2.id = l.planilla_empleado_id
          where l.planilla_id = v_q1.id and l.periodo_fin = v_q1.periodo_fin and e2.empleado_id = k.empleado_id
            and e2.metodo_ir = 'tabla_progresiva';
        end if;
        v_ir := round(rrhh.fn_planilla_ir_anual(p.company_id, (v_neta + v_prev_neta + v_q1_neta) * 12, p.periodo_fin) / 12, 2)
                - v_prev_ir - v_q1_ir;
      else
        raise exception 'La retención de IR en planilla semanal no está definida. Consúltalo con el contador.';
      end if;
      v_ir := greatest(0, v_ir);
      if v_ir > 0 then
        v_ir := rrhh.fn_planilla_linea(v_pe, 'IR', null, 'monto', v_neta, null, v_ir);
      end if;
    elsif r.metodo_ir = 'retencion_fija' then
      if round(v_dev_ir * r.porcentaje_ir, 2) > 0 then
        v_ir := rrhh.fn_planilla_linea(v_pe, 'IR_SP', null, 'porcentaje', v_dev_ir, r.porcentaje_ir, v_dev_ir * r.porcentaje_ir);
      end if;
    end if;

    -- 6. Deducciones en orden (skill nexo-planilla-legal §5): embargos
    -- (alimentos primero), cuotas de préstamo y otras deducciones. El neto
    -- nunca queda negativo.
    v_disp := v_dev - v_inss - v_ir;
    v_base_emb := v_disp;
    for em in select e.* from rrhh.embargos e
              where e.contrato_id = k.contrato_id and e.company_id = p.company_id and e.estado <> 'anulado'
                and e.vigente_desde <= k.fin and (e.vigente_hasta is null or e.vigente_hasta >= k.ini)
              order by (e.tipo = 'alimentos') desc, e.vigente_desde, e.id loop
      -- El monto mensual se prorratea por los días de vigencia dentro del tramo (30/360).
      if t.frecuencia = 'semanal' then
        v_dias_emb := least(k.fin, coalesce(em.vigente_hasta, k.fin)) - greatest(k.ini, em.vigente_desde) + 1;
      else
        v_dias_emb := rrhh.fn_planilla_dia_comercial(least(k.fin, coalesce(em.vigente_hasta, k.fin)), v_dias_mes)
                      - rrhh.fn_planilla_dia_comercial(greatest(k.ini, em.vigente_desde), v_dias_mes) + 1;
      end if;
      v_emb := case em.metodo when 'porcentaje' then v_base_emb * em.valor else em.valor * v_dias_emb / v_dias_mes end;
      if em.tope_total is not null then
        select coalesce(sum(l.monto), 0) into v_aplicado
        from rrhh.planilla_lineas l join rrhh.planillas q on q.id = l.planilla_id
        where l.company_id = p.company_id and l.contrato_id = k.contrato_id and em.id = any (l.origen_ids)
          and q.estado in ('aprobada', 'pagada') and q.id <> p.id;
        v_emb := least(v_emb, greatest(0, em.tope_total - v_aplicado));
      end if;
      v_emb := round(v_emb, 2);
      if v_emb > v_disp then
        v_emb := greatest(0, v_disp);
        v_avisos := v_avisos || 'El embargo no cabe completo en el neto: se descontó lo disponible'::text;
      end if;
      if v_emb > 0 then
        v_ded := rrhh.fn_planilla_linea(v_pe, case em.tipo when 'alimentos' then 'EMBARGO_ALIMENTOS' else 'EMBARGO_JUDICIAL' end,
          null, case em.metodo when 'porcentaje' then 'porcentaje' else 'monto' end,
          case em.metodo when 'porcentaje' then v_base_emb end, case em.metodo when 'porcentaje' then em.valor end,
          v_emb, 'embargo', array[em.id], jsonb_build_object('referencia', em.referencia));
        v_disp := v_disp - v_ded;
      end if;
      if em.tipo = 'judicial' then
        v_emb_judicial := true;
      end if;
    end loop;

    for nv in select * from rrhh.fn_planilla_novedades(p.id) n
              where n.contrato_id = k.contrato_id and n.prestamo_id is not null
              order by n.fecha, n.orden, n.id loop
      if nv.monto > v_disp then
        v_avisos := v_avisos || 'Una cuota de préstamo no cabe en el neto: pasa a la siguiente planilla'::text;
        continue;
      end if;
      v_ded := rrhh.fn_planilla_linea(v_pe, nv.codigo, null, 'monto', null, null, nv.monto, 'novedad', array[nv.id]);
      v_disp := v_disp - v_ded;
      v_ids_usados := v_ids_usados || nv.id;
    end loop;

    for nv in select * from rrhh.fn_planilla_novedades(p.id) n
              where n.contrato_id = k.contrato_id and n.tipo = 'deduccion' and n.prestamo_id is null
                and (n.metodo = 'fijo' or (n.metodo in ('dias', 'horas') and n.codigo <> 'AUSENCIA'))
              order by n.orden, n.fecha, n.id loop
      if nv.metodo = 'horas' and (v_horas_jornada is null or v_horas_jornada <= 0) then
        raise exception 'El contrato % no tiene jornada para calcular la tarifa por hora.', k.numero_contrato;
      end if;
      v_ded := round(case nv.metodo when 'fijo' then nv.monto when 'dias' then nv.cantidad * v_diario
                     else nv.cantidad * v_diario / v_horas_jornada end, 2);
      if v_ded > v_disp then
        raise exception 'Las deducciones del contrato % superan lo disponible del período.', k.numero_contrato;
      end if;
      if nv.metodo = 'fijo' then
        v_ded := rrhh.fn_planilla_linea(v_pe, nv.codigo, null, 'monto', null, null, nv.monto, 'novedad', array[nv.id]);
      else
        v_ded := rrhh.fn_planilla_linea(v_pe, nv.codigo, nv.cantidad, nv.metodo,
          case nv.metodo when 'dias' then v_diario else round(v_diario / v_horas_jornada, 4) end, null,
          case nv.metodo when 'dias' then nv.cantidad * v_diario else nv.cantidad * v_diario / v_horas_jornada end,
          'novedad', array[nv.id]);
      end if;
      v_disp := v_disp - v_ded;
      v_ids_usados := v_ids_usados || nv.id;
    end loop;

    -- 8. Aportes patronales.
    if r.regimen_inss <> 'ninguno' then
      v_tasa := rrhh.fn_planilla_parametro(p.company_id,
        case r.regimen_inss when 'integral' then 'inss_patronal' else 'inss_patronal_ivm' end, p.periodo_fin);
      v_usados := v_usados || case r.regimen_inss when 'integral' then 'inss_patronal' else 'inss_patronal_ivm' end;
      if v_base_inss > 0 then
        perform rrhh.fn_planilla_linea(v_pe, 'INSS_PATRONAL', null, 'porcentaje', v_base_inss, v_tasa, v_base_inss * v_tasa);
      end if;
      v_tasa := rrhh.fn_planilla_parametro(p.company_id, 'inatec', p.periodo_fin);
      v_usados := v_usados || 'inatec'::text;
      if v_dev_inatec > 0 then
        perform rrhh.fn_planilla_linea(v_pe, 'INATEC', null, 'porcentaje', v_dev_inatec, v_tasa, v_dev_inatec * v_tasa);
      end if;
    end if;

    -- 9. Provisiones, si el régimen las lleva.
    if r.paga_vacaciones and v_dias_pag > 0 then
      v_tasa := rrhh.fn_planilla_parametro(p.company_id, 'vacaciones_dias_por_mes', p.periodo_fin) * v_dias_pag / v_dias_mes;
      perform rrhh.fn_planilla_linea(v_pe, 'PROV_VACACIONES', round(v_tasa, 4), 'dias', v_diario, null, v_tasa * v_diario);
    end if;
    if r.paga_aguinaldo and v_dev_ag > 0 then
      -- Sin tasa guardada: una tasa redondeada (0.083333) no reproduce el monto.
      v_tasa := rrhh.fn_planilla_parametro(p.company_id, 'aguinaldo_dias_por_mes', p.periodo_fin);
      perform rrhh.fn_planilla_linea(v_pe, 'PROV_AGUINALDO', null, 'monto', v_dev_ag, null, v_dev_ag * v_tasa / v_dias_mes,
        'sistema', null, jsonb_build_object('dias_por_mes', v_tasa, 'dias_mes', v_dias_mes));
    end if;
    if r.paga_indemnizacion and v_dev_ind > 0 then
      v_tasa := rrhh.fn_planilla_parametro(p.company_id, 'provision_indemnizacion_divisor', p.periodo_fin);
      v_usados := v_usados || 'provision_indemnizacion_divisor'::text;
      perform rrhh.fn_planilla_linea(v_pe, 'PROV_INDEMNIZACION', null, 'monto', v_dev_ind, null, v_dev_ind / v_tasa,
        'sistema', null, jsonb_build_object('divisor', v_tasa));
    end if;

    -- 10. Aviso, no bloqueo (plan 20 §8.3).
    if r.regimen = 'servicios_profesionales' and r.aviso_descartado_en is null
       and (exists (select 1 from rrhh.contrato_jornadas cj where cj.contrato_id = k.contrato_id
                    and cj.vigente_desde <= k.fin and (cj.vigente_hasta is null or cj.vigente_hasta >= k.ini))
            or exists (select 1 from rrhh.asistencia_marcas m where m.company_id = p.company_id
                       and m.contrato_id = k.contrato_id
                       and m.marcado_en >= k.ini::timestamp at time zone 'America/Managua'
                       and m.marcado_en < (k.fin + 1)::timestamp at time zone 'America/Managua')) then
      v_avisos := v_avisos || 'Revisar régimen con el contador'::text;
    end if;

    -- Solo novedades libres o ya suyas: si otra planilla tomó una cuota vencida
    -- mientras se calculaba, se aborta en vez de reasignarla.
    update rrhh.novedades set estado = 'aplicada', planilla_id = p.id
    where id = any (v_ids_usados) and fecha <= p.periodo_fin and (planilla_id is null or planilla_id = p.id)
      and estado <> 'anulada';
    get diagnostics v_n_upd = row_count;
    if v_n_upd <> (select count(distinct x) from unnest(v_ids_usados) x) then
      raise exception 'Los datos cambiaron durante el cálculo. Vuelve a calcular.';
    end if;

    update rrhh.planilla_empleados e set
      dias_pagados = v_dias_pag,
      devengado = s.dev, deducciones = s.ded, neto = s.dev - s.ded, aportes = s.apo, provisiones = s.pro,
      avisos = v_avisos
    from (select coalesce(sum(l.monto) filter (where l.tipo = 'devengado'), 0) dev,
                 coalesce(sum(l.monto) filter (where l.tipo = 'deduccion'), 0) ded,
                 coalesce(sum(l.monto) filter (where l.tipo = 'aporte_patronal'), 0) apo,
                 coalesce(sum(l.monto) filter (where l.tipo = 'provision'), 0) pro
          from rrhh.planilla_lineas l where l.planilla_empleado_id = v_pe and l.periodo_fin = p.periodo_fin) s
    where e.id = v_pe;
  end loop;

  select count(*) filter (where cc.contrato_id is null),
         count(*) filter (where cc.contrato_id is not null and cc.frecuencia_pago <> t.frecuencia)
    into v_sin_salario, v_otra_frec
  from rrhh.contratos c left join rrhh.contrato_compensacion cc on cc.contrato_id = c.id
  where c.company_id = p.company_id and c.estado = 'activo';
  if v_n = 0 then
    raise exception 'Ningún contrato entra en esta planilla. Contratos activos con otra frecuencia de pago: %. Sin salario: %.',
      v_otra_frec, v_sin_salario;
  end if;
  if v_sin_salario > 0 then
    v_avisos_pl := v_avisos_pl || format('Contratos activos sin salario, fuera de la planilla: %s', v_sin_salario);
  end if;
  if v_otra_frec > 0 then
    v_avisos_pl := v_avisos_pl || format('Contratos activos con otra frecuencia de pago, fuera de esta planilla: %s', v_otra_frec);
  end if;
  if v_vac_pagadas then
    v_avisos_pl := v_avisos_pl || 'Vacaciones pagadas: el INSS y el IR que llevan están pendientes de confirmar con el contador'::text;
  end if;
  if v_emb_judicial then
    v_avisos_pl := v_avisos_pl || 'Embargo judicial: confirmar el mínimo inembargable con el contador'::text;
  end if;
  select v_avisos_pl || coalesce(array_agg('Valor pendiente de confirmar con el contador: ' || replace(x.codigo, '_', ' ')
                                          order by x.codigo), '{}')
    into v_avisos_pl
  from (select distinct pl.codigo from rrhh.parametros_ley pl
        where pl.company_id = p.company_id and pl.certeza = 'verificar' and pl.codigo = any (v_usados)
          and pl.vigente_desde <= p.periodo_fin and (pl.vigente_hasta is null or pl.vigente_hasta >= p.periodo_fin)) x;

  select jsonb_build_object(
      'empleados', count(*), 'devengado', coalesce(sum(e.devengado), 0), 'deducciones', coalesce(sum(e.deducciones), 0),
      'neto', coalesce(sum(e.neto), 0), 'aportes', coalesce(sum(e.aportes), 0), 'provisiones', coalesce(sum(e.provisiones), 0),
      'costo_total', coalesce(sum(e.devengado + e.aportes + e.provisiones), 0),
      'avisos', to_jsonb(v_avisos_pl),
      'empleados_con_aviso', count(*) filter (where cardinality(e.avisos) > 0))
    into v_tot
  from rrhh.planilla_empleados e where e.planilla_id = p.id;

  if rrhh.fn_planilla_huella_insumos(p.id) is distinct from v_hash_ini then
    raise exception 'Los datos cambiaron durante el cálculo. Vuelve a calcular.';
  end if;

  update rrhh.planillas set
    estado = 'calculada', calculada_por = p_uid, calculada_en = now(),
    hash_insumos = v_hash_ini,
    totales = v_tot, total = (v_tot->>'neto')::numeric, updated_at = now()
  where id = p.id;
  return v_tot;
end;
$$;

-- Planilla de aguinaldo (arts. 93–97): días del período × diario del salario
-- actual, solo mientras el régimen lo lleve. Sin INSS, IR, INATEC ni
-- deducciones. Lo ya pagado en una liquidación aprobada de la persona dentro
-- del período no se repite.
create or replace function rrhh.fn_planilla_calcular_aguinaldo(p_planilla_id uuid, p_uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p rrhh.planillas;
  t rrhh.planilla_tipos;
  k record;
  r rrhh.contrato_regimen;
  v_hash_ini text;
  v_pe uuid;
  v_dias_mes numeric;
  v_mensual numeric;
  v_diario numeric;
  v_desde date;
  v_dias numeric;
  v_n integer := 0;
  v_liquidados integer := 0;
  v_sin_aguinaldo integer := 0;
  v_avisos text[];
  v_avisos_pl text[] := '{}';
  v_tot jsonb;
begin
  select * into p from rrhh.planillas where id = p_planilla_id for update;
  select * into t from rrhh.planilla_tipos where id = p.planilla_tipo_id;
  v_hash_ini := rrhh.fn_planilla_huella_insumos(p.id);
  delete from rrhh.planilla_empleados where planilla_id = p.id;
  v_dias_mes := rrhh.fn_planilla_parametro(p.company_id, 'dias_mes_comercial', p.periodo_fin);

  for k in select * from rrhh.fn_planilla_contratos(p.id) order by empleado_id, contrato_id loop
    v_avisos := '{}';
    if exists (select 1 from rrhh.planilla_empleados e2 join rrhh.planillas q on q.id = e2.planilla_id
               join rrhh.planilla_tipos t2 on t2.id = q.planilla_tipo_id and t2.clase = 'aguinaldo'
               where e2.contrato_id = k.contrato_id and q.id <> p.id and q.estado <> 'anulada'
                 and q.periodo_inicio <= p.periodo_fin and q.periodo_fin >= p.periodo_inicio) then
      raise exception 'El contrato % ya está en otra planilla de aguinaldo del mismo período.', k.numero_contrato;
    end if;
    select greatest(k.ini, max(l.fecha_egreso) + 1) into v_desde from rrhh.liquidaciones l
    where l.company_id = p.company_id and l.empleado_id = k.empleado_id and l.estado in ('aprobada', 'pagada')
      and l.fecha_egreso between p.periodo_inicio and p.periodo_fin;
    v_desde := coalesce(v_desde, k.ini);
    if v_desde > k.fin then
      v_liquidados := v_liquidados + 1;
      continue;
    end if;
    r := null;
    select cr.* into r from rrhh.contrato_regimen cr
    where cr.contrato_id = k.contrato_id and cr.company_id = p.company_id
      and cr.vigente_desde <= k.fin and (cr.vigente_hasta is null or cr.vigente_hasta >= k.fin);
    if r.id is null then
      raise exception 'El contrato % no tiene régimen de contratación vigente al final del período.', k.numero_contrato;
    end if;
    v_dias := rrhh.fn_planilla_aguinaldo_dias(k.contrato_id, v_desde, k.fin);
    if v_dias <= 0 then
      v_sin_aguinaldo := v_sin_aguinaldo + 1;
      continue;
    end if;
    v_n := v_n + 1;
    select cc.salario_base into v_mensual from rrhh.contrato_compensacion cc where cc.contrato_id = k.contrato_id;
    v_diario := round(v_mensual / v_dias_mes, 4);
    insert into rrhh.planilla_empleados (company_id, planilla_id, contrato_id, empleado_id, contrato_regimen_id,
      periodo_inicio, periodo_fin, salario_mensual, salario_diario, horas_jornada, frecuencia, regimen, regimen_inss,
      metodo_ir, porcentaje_ir, paga_vacaciones, paga_aguinaldo, paga_indemnizacion, dias_pagados)
    values (p.company_id, p.id, k.contrato_id, k.empleado_id, r.id, v_desde, k.fin, v_mensual, v_diario,
      null, t.frecuencia, r.regimen, r.regimen_inss, r.metodo_ir, r.porcentaje_ir,
      r.paga_vacaciones, r.paga_aguinaldo, r.paga_indemnizacion, v_dias)
    returning id into v_pe;
    perform rrhh.fn_planilla_linea(v_pe, 'AGUINALDO', v_dias, 'dias', v_diario, null, v_dias * v_diario,
      'sistema', null, jsonb_build_object('desde', v_desde, 'hasta', k.fin));
    if k.fin < p.periodo_fin then
      v_avisos := v_avisos || 'Contrato terminado en el período: aguinaldo proporcional'::text;
    end if;
    update rrhh.planilla_empleados e set devengado = s.dev, neto = s.dev, avisos = v_avisos
    from (select coalesce(sum(l.monto), 0) dev from rrhh.planilla_lineas l
          where l.planilla_empleado_id = v_pe and l.periodo_fin = p.periodo_fin) s
    where e.id = v_pe;
  end loop;

  if v_n = 0 then
    raise exception 'Ningún contrato tiene aguinaldo pendiente en este período.';
  end if;
  if v_liquidados > 0 then
    v_avisos_pl := v_avisos_pl || format('Contratos con el aguinaldo ya pagado en su liquidación: %s', v_liquidados);
  end if;
  if v_sin_aguinaldo > 0 then
    v_avisos_pl := v_avisos_pl || format('Contratos cuyo régimen no lleva aguinaldo: %s', v_sin_aguinaldo);
  end if;
  if rrhh.fn_planilla_parametro(p.company_id, 'aguinaldo_mes_inicio', p.periodo_fin) = 1 then
    v_avisos_pl := v_avisos_pl || 'Período del aguinaldo por año calendario: pendiente de confirmar con el contador'::text;
  end if;
  select v_avisos_pl || coalesce(array_agg('Valor pendiente de confirmar con el contador: ' || replace(x.codigo, '_', ' ')
                                          order by x.codigo), '{}')
    into v_avisos_pl
  from (select distinct pl.codigo from rrhh.parametros_ley pl
        where pl.company_id = p.company_id and pl.certeza = 'verificar'
          and pl.codigo in ('dias_mes_comercial', 'aguinaldo_dias_por_mes', 'aguinaldo_mes_inicio')
          and pl.vigente_desde <= p.periodo_fin and (pl.vigente_hasta is null or pl.vigente_hasta >= p.periodo_fin)) x;

  select jsonb_build_object(
      'empleados', count(*), 'devengado', coalesce(sum(e.devengado), 0), 'deducciones', 0,
      'neto', coalesce(sum(e.neto), 0), 'aportes', 0, 'provisiones', 0,
      'costo_total', coalesce(sum(e.devengado), 0),
      'avisos', to_jsonb(v_avisos_pl),
      'empleados_con_aviso', count(*) filter (where cardinality(e.avisos) > 0))
    into v_tot
  from rrhh.planilla_empleados e where e.planilla_id = p.id;

  if rrhh.fn_planilla_huella_insumos(p.id) is distinct from v_hash_ini then
    raise exception 'Los datos cambiaron durante el cálculo. Vuelve a calcular.';
  end if;
  update rrhh.planillas set
    estado = 'calculada', calculada_por = p_uid, calculada_en = now(),
    hash_insumos = v_hash_ini,
    totales = v_tot, total = (v_tot->>'neto')::numeric, updated_at = now()
  where id = p.id;
  return v_tot;
end;
$$;

-- Sin EXECUTE para la API mientras se aplican las demás partes.
revoke all on function
  rrhh.fn_planilla_novedades(uuid),
  rrhh.fn_planilla_calcular_aguinaldo(uuid, uuid)
from public, anon, authenticated;
