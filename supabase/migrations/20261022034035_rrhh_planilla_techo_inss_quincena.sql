-- =============================================================================
-- Planilla: techo del INSS por persona en el mes (techo acumulado)
--
-- Qué hace: reemplaza rrhh.fn_planilla_calcular_nucleo (versión de
-- 20261022000431, parte 2 de PL2b) con un solo cambio, en el paso 3 (base del
-- INSS). Antes, cada planilla topaba la base con el techo prorrateado al
-- período (la mitad en una quincena) y solo sumaba los otros contratos de la
-- persona en la misma planilla. Con ingresos desiguales entre quincenas el mes
-- quedaba por debajo del techo: C$80,000 y C$20,000 con techo de C$100,000
-- cotizaban sobre C$70,000 y no sobre C$100,000.
--
-- Ahora el techo es del mes (plan 20 §3, "el IR y el techo del INSS se
-- calculan por persona"): cada planilla cotiza lo devengado en ella hasta el
-- techo del mes, menos la base que la persona ya usó en sus otros contratos de
-- la planilla y, en la 2.ª quincena, en la 1.ª (que tiene que estar aprobada).
-- El mes queda siempre en min(devengado del mes, techo) y ninguna planilla
-- cotiza más de lo devengado en ella, así que el INSS nunca deja el neto
-- negativo. Por debajo del techo nada cambia. Por encima, la 1.ª quincena
-- cotiza más que la 2.ª (C$150,000 fijos: C$75,000 y C$25,000 en vez de
-- C$50,000 y C$50,000). Quien entra el 16 se topa con el techo del mes, como en
-- la planilla mensual. La semanal sigue con el techo prorrateado a 7 días.
--
-- Por qué y aprobación: hallazgo P1 de la revisión automática del PR #50
-- (2026-10-22). Se probó primero el ajuste en la 2.ª quincena, como el IR, y la
-- revisión independiente mostró que deja netos negativos cuando la 2.ª devenga
-- poco; por eso, techo acumulado. El usuario aprobó en el chat el techo
-- acumulado y aplicar esta migración en nexo-core (2026-10-22, "Si"). En
-- nexo-core no había planillas: no cambia ningún cálculo ya hecho.
--
-- Rollback: volver a crear la función con el texto de 20261022000431 y
-- revocar su EXECUTE como al final de esta migración.
-- =============================================================================

-- Prechequeo: se reemplaza exactamente la versión de 20261022000431.
do $$
begin
  if coalesce((select md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'rrhh' and p.proname = 'fn_planilla_calcular_nucleo'), '')
     <> '65399c69409bdd6a2527076406fdb2ea' then
    raise exception 'precheck: rrhh.fn_planilla_calcular_nucleo no es la versión de 20261022000431';
  end if;
end;
$$;

-- Motor de la planilla ordinaria (PL2a y PL2b) con el techo del INSS por
-- persona en el mes (techo acumulado).
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
  v_q1_n integer;
  v_q1_base numeric;
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

    -- 3 y 4. Base INSS por persona e INSS laboral. El techo es del mes (plan 20
    -- §3): se resta la base que la persona ya usó en sus otros contratos de esta
    -- planilla y, en la 2.ª quincena, en la 1.ª (que tiene que estar aprobada).
    -- Ninguna planilla cotiza más de lo devengado en ella, así que el INSS no
    -- deja el neto negativo. La semanal sigue con el techo prorrateado a 7 días.
    v_inss := 0;
    v_base_inss := 0;
    if r.regimen_inss <> 'ninguno' then
      v_techo := rrhh.fn_planilla_parametro(p.company_id, 'techo_inss', p.periodo_fin);
      select coalesce(sum(l.base), 0) into v_prev_base
      from rrhh.planilla_lineas l join rrhh.planilla_empleados e2 on e2.id = l.planilla_empleado_id
      where l.planilla_id = p.id and l.periodo_fin = p.periodo_fin and e2.empleado_id = k.empleado_id
        and e2.id <> v_pe and l.concepto_codigo = 'INSS_LABORAL';
      v_q1_n := 0;
      v_q1_base := 0;
      if t.frecuencia = 'quincenal' and extract(day from p.periodo_fin) > 15 then
        v_q1 := null;
        select q.* into v_q1 from rrhh.planillas q
        where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id and q.estado <> 'anulada'
          and q.periodo_inicio = v_mes_ini and q.periodo_fin < p.periodo_inicio;
        if v_q1.id is not null then
          select count(distinct e2.id), coalesce(sum(l.base) filter (where l.concepto_codigo = 'INSS_LABORAL'), 0)
            into v_q1_n, v_q1_base
          from rrhh.planilla_empleados e2
          left join rrhh.planilla_lineas l on l.planilla_empleado_id = e2.id and l.periodo_fin = v_q1.periodo_fin
          where e2.planilla_id = v_q1.id and e2.empleado_id = k.empleado_id and e2.regimen_inss <> 'ninguno';
          if v_q1_n > 0 and v_q1.estado not in ('aprobada', 'pagada') then
            raise exception 'Aprueba primero la planilla de la primera quincena del mes: el INSS y el IR de la segunda dependen de ella.';
          end if;
        end if;
      end if;
      v_base_inss := least(v_dev_inss, greatest(0,
        case t.frecuencia when 'semanal' then round(v_techo * v_dias_base / v_dias_mes, 2) else round(v_techo, 2) end
        - v_prev_base - v_q1_base));
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

-- El núcleo sigue sin EXECUTE para la API: solo lo llaman las RPC públicas.
revoke all on function rrhh.fn_planilla_calcular_nucleo(uuid, uuid) from public, anon, authenticated;

-- Poscheques.
do $$
begin
  if has_function_privilege('authenticated', 'rrhh.fn_planilla_calcular_nucleo(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'rrhh.fn_planilla_calcular_nucleo(uuid,uuid)', 'EXECUTE') then
    raise exception 'poscheque: el núcleo del motor quedó ejecutable por la API';
  end if;
  if position('v_q1_base' in (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'rrhh' and p.proname = 'fn_planilla_calcular_nucleo')) = 0 then
    raise exception 'poscheque: el motor no quedó con el ajuste del techo del INSS';
  end if;
end;
$$;
