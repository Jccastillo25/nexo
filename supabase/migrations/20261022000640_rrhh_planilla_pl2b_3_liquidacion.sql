-- =============================================================================
-- PL2b de Planilla, parte 3 de 5: liquidación pura, preparación e inmutabilidad
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- Liquidación pura (PL2a) con el inicio del aguinaldo que se puede adelantar
-- (p_aguinaldo_desde) cuando una parte del período ya se pagó.
drop function rrhh.fn_liquidacion_calcular(uuid, numeric, date, date, text, boolean, numeric, numeric, numeric, boolean, boolean, boolean);
create function rrhh.fn_liquidacion_calcular(
  p_company_id uuid, p_salario_mensual numeric, p_fecha_antiguedad date, p_fecha_egreso date,
  p_causa text, p_indeterminado boolean, p_dias_vacaciones numeric, p_dias_salario_pendiente numeric,
  p_meses_confianza numeric, p_paga_vacaciones boolean, p_paga_aguinaldo boolean, p_paga_indemnizacion boolean,
  p_aguinaldo_desde date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_dias_mes numeric;
  v_diario numeric;
  v_edad interval;
  v_meses numeric;
  v_anios_ini numeric;
  v_dias_ind numeric := 0;
  v_min numeric;
  v_max numeric;
  v_mes_inicio integer;
  v_ag_inicio date;
  v_ag_desde date;
  v_meses_ag numeric;
  v_dias_ag numeric;
  v_lineas jsonb := '[]'::jsonb;
  v_avisos text[] := '{}';
  v_monto numeric;
  v_total numeric := 0;
  v_ind_total numeric := 0;
  v_paga_ind boolean;
begin
  if p_causa is null or p_causa not in ('despido_sin_causa', 'renuncia', 'mutuo_acuerdo', 'despido_causa_justa',
                                        'confianza', 'vencimiento', 'fallecimiento') then
    raise exception 'Causa de terminación no válida.';
  end if;
  if p_causa in ('vencimiento', 'fallecimiento') then
    raise exception 'La liquidación por % está pendiente de definir con el contador.',
      case p_causa when 'vencimiento' then 'vencimiento de contrato' else 'fallecimiento' end;
  end if;
  if p_salario_mensual is null or p_salario_mensual <= 0 then
    raise exception 'El contrato no tiene salario.';
  end if;
  if p_fecha_antiguedad is null or p_fecha_egreso is null or p_fecha_egreso < p_fecha_antiguedad then
    raise exception 'La fecha de egreso debe ser posterior al inicio de la antigüedad.';
  end if;
  if coalesce(p_dias_vacaciones, 0) < 0 or coalesce(p_dias_vacaciones, 0) > 366
     or coalesce(p_dias_salario_pendiente, 0) < 0 or coalesce(p_dias_salario_pendiente, 0) > 31 then
    raise exception 'Días de vacaciones o de salario pendiente fuera de rango.';
  end if;

  v_paga_ind := p_paga_indemnizacion and p_causa in ('despido_sin_causa', 'renuncia', 'mutuo_acuerdo', 'confianza');
  if v_paga_ind and not p_indeterminado then
    raise exception 'La indemnización de un contrato por tiempo determinado está pendiente de definir con el contador.';
  end if;

  v_dias_mes := rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', p_fecha_egreso);
  v_diario := round(p_salario_mensual / v_dias_mes, 4);
  v_edad := age(p_fecha_egreso, p_fecha_antiguedad);
  v_meses := extract(year from v_edad) * 12 + extract(month from v_edad) + extract(day from v_edad) / v_dias_mes;

  -- Indemnización por antigüedad (art. 45; renuncia por art. 43).
  if v_paga_ind then
    v_anios_ini := rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_anios_iniciales', p_fecha_egreso);
    v_dias_ind := least(v_meses, v_anios_ini * 12)
                    * rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_anio_inicial', p_fecha_egreso) / 12
                + greatest(0, v_meses - v_anios_ini * 12)
                    * rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_anio_siguiente', p_fecha_egreso) / 12;
    v_min := rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_minimo', p_fecha_egreso);
    v_max := rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_maximo', p_fecha_egreso);
    if v_dias_ind < v_min then
      v_avisos := v_avisos || 'Se aplicó el mínimo de indemnización: pendiente de confirmar con el contador'::text;
    end if;
    v_dias_ind := round(least(v_max, greatest(v_min, v_dias_ind)), 4);
    v_monto := round(v_dias_ind * v_diario, 2);
    v_ind_total := v_monto;
    v_lineas := v_lineas || jsonb_build_object('concepto', 'INDEMNIZACION', 'nombre', 'Indemnización por antigüedad',
      'dias', v_dias_ind, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT arts. 43 y 45');
    v_total := v_total + v_monto;
  end if;

  -- Personal de confianza (art. 47): 2 a 6 meses adicionales, decisión de la empresa.
  if p_causa = 'confianza' and p_paga_indemnizacion then
    if p_meses_confianza is null
       or p_meses_confianza < rrhh.fn_planilla_parametro(p_company_id, 'confianza_meses_minimo', p_fecha_egreso)
       or p_meses_confianza > rrhh.fn_planilla_parametro(p_company_id, 'confianza_meses_maximo', p_fecha_egreso) then
      raise exception 'Indica los meses adicionales del art. 47 dentro del rango permitido.';
    end if;
    v_monto := round(p_meses_confianza * v_dias_mes * v_diario, 2);
    v_ind_total := v_ind_total + v_monto;
    v_lineas := v_lineas || jsonb_build_object('concepto', 'INDEMNIZACION_CONFIANZA', 'nombre', 'Indemnización de confianza',
      'dias', p_meses_confianza * v_dias_mes, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT art. 47');
    v_total := v_total + v_monto;
  end if;
  if v_ind_total > rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_exencion_ir', p_fecha_egreso) then
    v_avisos := v_avisos || 'La indemnización supera la exención de IR: la retención del excedente está pendiente de confirmar'::text;
  end if;

  -- Aguinaldo proporcional (art. 93, intocable por el art. 97: sin descuentos).
  if p_paga_aguinaldo then
    v_mes_inicio := rrhh.fn_planilla_parametro(p_company_id, 'aguinaldo_mes_inicio', p_fecha_egreso)::int;
    v_ag_inicio := make_date(extract(year from p_fecha_egreso)::int, v_mes_inicio, 1);
    if v_ag_inicio > p_fecha_egreso then
      v_ag_inicio := (v_ag_inicio - interval '1 year')::date;
    end if;
    v_ag_desde := greatest(v_ag_inicio, p_fecha_antiguedad, coalesce(p_aguinaldo_desde, v_ag_inicio));
    if v_ag_desde > p_fecha_egreso then
      v_avisos := v_avisos || 'El aguinaldo del período ya se pagó'::text;
    else
      v_edad := age(p_fecha_egreso, v_ag_desde);
      v_meses_ag := extract(year from v_edad) * 12 + extract(month from v_edad) + extract(day from v_edad) / v_dias_mes;
      v_dias_ag := round(v_meses_ag * rrhh.fn_planilla_parametro(p_company_id, 'aguinaldo_dias_por_mes', p_fecha_egreso), 4);
      v_monto := round(v_dias_ag * v_diario, 2);
      v_lineas := v_lineas || jsonb_build_object('concepto', 'AGUINALDO', 'nombre', 'Aguinaldo proporcional',
        'dias', v_dias_ag, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT arts. 93 y 97', 'desde', v_ag_desde);
      v_total := v_total + v_monto;
    end if;
    v_avisos := v_avisos || case when v_mes_inicio = 1
      then 'Período del aguinaldo por año calendario: pendiente de confirmar con el contador'
      else format('Período del aguinaldo desde el mes %s: pendiente de confirmar con el contador', v_mes_inicio) end;
  end if;

  -- Vacaciones no gozadas (arts. 76 y 77).
  if p_paga_vacaciones and coalesce(p_dias_vacaciones, 0) > 0 then
    v_monto := round(p_dias_vacaciones * v_diario, 2);
    v_lineas := v_lineas || jsonb_build_object('concepto', 'VACACIONES', 'nombre', 'Vacaciones no gozadas',
      'dias', p_dias_vacaciones, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT arts. 76 y 77');
    v_total := v_total + v_monto;
  end if;

  if coalesce(p_dias_salario_pendiente, 0) > 0 then
    v_monto := round(p_dias_salario_pendiente * v_diario, 2);
    v_lineas := v_lineas || jsonb_build_object('concepto', 'SALARIO_PENDIENTE', 'nombre', 'Salario pendiente',
      'dias', p_dias_salario_pendiente, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT art. 42');
    v_total := v_total + v_monto;
  end if;

  return jsonb_build_object('diario', v_diario, 'meses_antiguedad', round(v_meses, 4), 'causa', p_causa,
    'lineas', v_lineas, 'total', v_total, 'avisos', to_jsonb(v_avisos));
end;
$$;

-- Prepara una liquidación de un contrato (simulación o documento): vacaciones
-- del saldo (o las indicadas), inicio del aguinaldo según lo ya pagado y
-- préstamos pendientes, descontados solo de lo que no es aguinaldo (art. 97).
create or replace function rrhh.fn_liquidacion_preparar(
  p_company_id uuid, p_contrato_id uuid, p_fecha_egreso date, p_causa text,
  p_dias_salario_pendiente numeric, p_meses_confianza numeric, p_dias_vacaciones numeric,
  p_documento boolean, p_excluir uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  r rrhh.contrato_regimen;
  pr record;
  v jsonb;
  v_saldo numeric;
  v_dias_vac numeric := 0;
  v_ag_ini date;
  v_ag_desde date;
  v_pagado_hasta date;
  v_total numeric;
  v_aguinaldo numeric;
  v_max_ded numeric;
  v_ded jsonb := '[]'::jsonb;
  v_ded_total numeric := 0;
  v_monto numeric;
  v_avisos text[] := '{}';
begin
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real, ct.fecha_antiguedad,
         ct.fecha_fin_prevista, cc.salario_base, cc.frecuencia_pago
    into c
  from rrhh.contratos ct left join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id
  where ct.id = p_contrato_id and ct.company_id = p_company_id;
  if not found or c.estado not in ('activo', 'finalizado') then
    raise exception 'Contrato no encontrado o no vigente.';
  end if;
  if p_fecha_egreso is null or c.fecha_inicio is null or p_fecha_egreso < c.fecha_inicio then
    raise exception 'La fecha de egreso debe ser posterior al inicio del contrato.';
  end if;
  if p_documento and c.estado = 'finalizado' and p_fecha_egreso <> c.fecha_fin_real then
    raise exception 'El contrato terminó el %: usa esa fecha de egreso.', to_char(c.fecha_fin_real, 'YYYY-MM-DD');
  end if;
  -- El salario hasta el egreso lo paga la planilla ordinaria del período (el
  -- motor la prorratea a la fecha de fin). El salario pendiente de la
  -- liquidación es solo para cuando esa planilla no se va a hacer.
  if coalesce(p_dias_salario_pendiente, 0) > 0 and exists (
       select 1 from rrhh.planillas q join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id and t.clase = 'ordinaria'
       where q.company_id = p_company_id and q.estado <> 'anulada' and t.frecuencia = c.frecuencia_pago
         and p_fecha_egreso between q.periodo_inicio and q.periodo_fin) then
    raise exception 'Ya hay una planilla del período del egreso y en ella se paga el salario hasta esa fecha. Deja el salario pendiente en 0.';
  end if;
  select v_avisos || coalesce(array_agg(format('La planilla del %s al %s pagó días posteriores al egreso: revisa el cobro con el contador',
                                              to_char(pe.periodo_inicio, 'YYYY-MM-DD'), to_char(pe.periodo_fin, 'YYYY-MM-DD'))
                                       order by pe.periodo_inicio), '{}')
    into v_avisos
  from rrhh.planilla_empleados pe
  join rrhh.planillas q on q.id = pe.planilla_id
  join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id and t.clase = 'ordinaria'
  where pe.contrato_id = c.id and q.estado in ('aprobada', 'pagada') and pe.periodo_fin > p_fecha_egreso;
  select cr.* into r from rrhh.contrato_regimen cr where cr.contrato_id = p_contrato_id and cr.vigente_desde <= p_fecha_egreso
    and (cr.vigente_hasta is null or cr.vigente_hasta >= p_fecha_egreso);
  if not found then
    raise exception 'El contrato no tiene régimen de contratación vigente a esa fecha.';
  end if;

  select s.saldo into v_saldo from rrhh.fn_vacaciones_saldo(c.id, p_fecha_egreso) s;
  if p_dias_vacaciones is not null then
    v_dias_vac := p_dias_vacaciones;
  elsif r.paga_vacaciones then
    v_dias_vac := greatest(0, v_saldo);
    if v_saldo < 0 then
      v_avisos := v_avisos || format('El saldo de vacaciones es negativo (%s días): no se descuenta; revísalo con el contador',
                                     trim_scale(v_saldo));
    end if;
  end if;

  -- Aguinaldo: no se repite lo pagado en otra liquidación aprobada de la persona
  -- ni en una planilla de aguinaldo aprobada del período.
  select x.ini into v_ag_ini from rrhh.fn_planilla_aguinaldo_periodo(p_company_id, p_fecha_egreso) x;
  select max(l.fecha_egreso) + 1 into v_ag_desde from rrhh.liquidaciones l
  where l.company_id = p_company_id and l.empleado_id = c.empleado_id and l.estado in ('aprobada', 'pagada')
    and l.id is distinct from p_excluir and l.fecha_egreso between v_ag_ini and p_fecha_egreso;
  select max(q.periodo_fin) + 1 into v_pagado_hasta from rrhh.planilla_empleados pe
  join rrhh.planillas q on q.id = pe.planilla_id
  join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id and t.clase = 'aguinaldo'
  where pe.empleado_id = c.empleado_id and q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
    and q.periodo_inicio = v_ag_ini;
  v_ag_desde := greatest(v_ag_desde, v_pagado_hasta);

  v := rrhh.fn_liquidacion_calcular(p_company_id, c.salario_base, coalesce(c.fecha_antiguedad, c.fecha_inicio),
    p_fecha_egreso, p_causa, c.fecha_fin_prevista is null, v_dias_vac, coalesce(p_dias_salario_pendiente, 0),
    p_meses_confianza, r.paga_vacaciones, r.paga_aguinaldo, r.paga_indemnizacion, v_ag_desde);
  v_total := (v->>'total')::numeric;
  select coalesce(sum((x->>'monto')::numeric), 0) into v_aguinaldo
  from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'AGUINALDO';
  v_max_ded := v_total - v_aguinaldo;

  -- Préstamos: cuotas no aplicadas en planillas aprobadas ni saldadas.
  for pr in
    select pt.id, pt.tipo, co.codigo, co.nombre, sum(n.monto) as pendiente
    from rrhh.prestamos pt
    join rrhh.novedades n on n.prestamo_id = pt.id and n.company_id = pt.company_id
    join rrhh.conceptos co on co.id = n.concepto_id
    where pt.contrato_id = c.id and pt.company_id = p_company_id and pt.estado = 'activo'
      and n.estado <> 'anulada'
      and (n.planilla_id is null or not exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                                 and q.estado in ('aprobada', 'pagada')))
    group by pt.id, pt.tipo, co.codigo, co.nombre, pt.created_at
    order by pt.created_at, pt.id
  loop
    v_monto := least(pr.pendiente, greatest(0, v_max_ded - v_ded_total));
    if v_monto < pr.pendiente then
      v_avisos := v_avisos || format('El saldo de un préstamo supera lo que se puede descontar sin tocar el aguinaldo: quedan C$ %s sin descontar',
                                     to_char(pr.pendiente - v_monto, 'FM999999990.00'));
    end if;
    if v_monto > 0 then
      v_ded := v_ded || jsonb_build_object('concepto', pr.codigo, 'nombre', pr.nombre || ' (saldo)', 'monto', v_monto,
        'origen_id', pr.id, 'pendiente', pr.pendiente, 'articulo', 'CT art. 97: no se descuenta del aguinaldo');
      v_ded_total := v_ded_total + v_monto;
    end if;
  end loop;
  if exists (select 1 from rrhh.embargos e where e.contrato_id = c.id and e.estado <> 'anulado' and e.vigente_desde <= p_fecha_egreso
             and (e.vigente_hasta is null or e.vigente_hasta >= p_fecha_egreso)) then
    v_avisos := v_avisos || 'El contrato tiene embargos vigentes: aplica el descuento de la liquidación según la orden, con el contador'::text;
  end if;

  return jsonb_build_object(
    'contrato_id', c.id, 'empleado_id', c.empleado_id, 'contrato_regimen_id', r.id, 'regimen', r.regimen,
    'salario_mensual', c.salario_base, 'diario', v->'diario', 'fecha_antiguedad', coalesce(c.fecha_antiguedad, c.fecha_inicio),
    'meses_antiguedad', v->'meses_antiguedad', 'causa', p_causa, 'fecha_egreso', p_fecha_egreso,
    'dias_vacaciones', v_dias_vac, 'dias_vacaciones_saldo', v_saldo, 'aguinaldo_desde', v_ag_desde,
    'lineas', v->'lineas', 'deducciones', v_ded,
    'total', v_total, 'total_devengado', v_total, 'total_deducciones', v_ded_total, 'neto', v_total - v_ded_total,
    'avisos', (v->'avisos') || to_jsonb(v_avisos));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Inmutabilidad de liquidaciones (defensa en profundidad)
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_liquidacion_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las liquidaciones no se eliminan: se anulan con motivo.';
  end if;
  if old.estado = 'calculada' then
    return new;
  end if;
  if old.estado = 'aprobada' and new.estado in ('pagada', 'anulada')
     and (new.contrato_id, new.fecha_egreso, new.causa, new.total_devengado, new.total_deducciones, new.neto,
          new.hash_insumos, new.calculada_por, new.aprobada_por)
         is not distinct from
         (old.contrato_id, old.fecha_egreso, old.causa, old.total_devengado, old.total_deducciones, old.neto,
          old.hash_insumos, old.calculada_por, old.aprobada_por) then
    return new;
  end if;
  raise exception '%', case old.estado
    when 'aprobada' then 'La liquidación está aprobada y ya no se modifica. Para corregirla, anúlala y haz otra.'
    when 'pagada' then 'La liquidación está pagada y ya no se modifica.'
    else 'La liquidación está anulada y ya no se modifica.' end;
end;
$$;
create trigger trg_liquidacion_proteger before update or delete on rrhh.liquidaciones
  for each row execute function rrhh.fn_liquidacion_proteger();

create or replace function rrhh.fn_liquidacion_lineas_proteger()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_estado text;
begin
  select l.estado into v_estado from rrhh.liquidaciones l
  where l.id = case when tg_op = 'DELETE' then old.liquidacion_id else new.liquidacion_id end;
  if v_estado is not null and v_estado <> 'calculada' then
    raise exception 'La liquidación está % y su detalle ya no se modifica.', v_estado;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger trg_liquidacion_lineas_proteger before insert or update or delete on rrhh.liquidacion_lineas
  for each row execute function rrhh.fn_liquidacion_lineas_proteger();

-- Sin EXECUTE para la API mientras se aplican las demás partes.
revoke all on function
  rrhh.fn_liquidacion_calcular(uuid, numeric, date, date, text, boolean, numeric, numeric, numeric, boolean, boolean, boolean, date),
  rrhh.fn_liquidacion_preparar(uuid, uuid, date, text, numeric, numeric, numeric, boolean, uuid),
  rrhh.fn_liquidacion_proteger(),
  rrhh.fn_liquidacion_lineas_proteger()
from public, anon, authenticated;
