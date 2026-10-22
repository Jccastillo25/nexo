-- Pruebas de PL2a (motor de planilla y simulador de liquidación). Solo PGlite:
-- entorno rrhh_planilla_entorno.sql + migración 20261021191441. Todo dentro de
-- una transacción que se revierte. Empresas y personas con prefijo PRUEBA.
-- Casos dorados: .claude/skills/nexo-planilla-legal/references/caso-dorado.md.
-- No prueba RLS efectiva, roles reales de Supabase ni concurrencia.
begin;

create temp table t_ids (k text primary key, v uuid) on commit drop;

create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from t_ids where k = p_k $$;
create function pg_temp.como(p_usuario text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(pg_temp.id(p_usuario)::text, ''), true)
$$;
create function pg_temp.limpio(p text) returns text language sql as $$
  select btrim(regexp_replace(coalesce(p, ''), '[^[:alpha:][:digit:] .,:]', ' ', 'g'))
$$;
create function pg_temp.monto(p_planilla uuid, p_contrato uuid, p_codigo text) returns numeric language sql as $$
  select coalesce(sum(monto), 0) from rrhh.planilla_lineas
  where planilla_id = p_planilla and contrato_id = p_contrato and concepto_codigo = p_codigo
$$;
create function pg_temp.tipo(p_planilla uuid, p_contrato uuid, p_tipo text) returns numeric language sql as $$
  select coalesce(sum(monto), 0) from rrhh.planilla_lineas
  where planilla_id = p_planilla and contrato_id = p_contrato and tipo = p_tipo
$$;
create function pg_temp.concepto(p_codigo text) returns uuid language sql as $$
  select id from rrhh.conceptos where company_id = '00000000-0000-4000-8000-00000000000a' and codigo = p_codigo
$$;
-- Ejecuta una sentencia y exige que falle con un mensaje que contenga p_esperado.
create function pg_temp.debe_fallar(p_sql text, p_esperado text, p_caso text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_esperado || '%' then
      raise exception 'FALLO PL2: % dio otro error: %', p_caso, pg_temp.limpio(sqlerrm);
    end if;
    return;
  end;
  raise exception 'FALLO PL2: % no fue rechazado', p_caso;
end;
$$;
-- Crea persona, contrato y compensación. p_fin no nulo deja el contrato finalizado.
create function pg_temp.contrato(p_k text, p_salario numeric, p_frecuencia text, p_inicio date,
                                 p_fin date default null, p_empleado text default null) returns uuid language plpgsql as $$
declare
  a uuid := pg_temp.id('A');
  v_e uuid := pg_temp.id(p_empleado);
  v_c uuid;
begin
  if v_e is null then
    insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', p_k) returning id into v_e;
    insert into t_ids values ('E' || p_k, v_e);
  end if;
  insert into rrhh.contratos (company_id, empleado_id, estado, fecha_inicio, fecha_fin_real)
  values (a, v_e, case when p_fin is null then 'activo' else 'finalizado' end, p_inicio, p_fin) returning id into v_c;
  insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, frecuencia_pago) values (v_c, a, p_salario, p_frecuencia);
  insert into t_ids values (p_k, v_c);
  return v_c;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos de prueba y efectos de la migración
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  v_j uuid;
  v_t uuid;
begin
  insert into t_ids values ('A', a), ('B', b),
    ('ESP', '00000000-0000-4000-8000-000000000001'), ('ADM', '00000000-0000-4000-8000-000000000002'),
    ('NADA', '00000000-0000-4000-8000-000000000003'), ('APR', '00000000-0000-4000-8000-000000000004');
  insert into auth.users select v from t_ids where k in ('ESP', 'ADM', 'NADA', 'APR');

  insert into core.prueba_permisos select pg_temp.id('ESP'), a, 'rrhh.planillas.' || c from unnest(array[
    'planilla.ver', 'planilla.generar', 'movimientos.ver', 'movimientos.crear', 'movimientos.eliminar',
    'liquidaciones.calcular', 'conceptos.ver']) c;
  insert into core.prueba_permisos select pg_temp.id('ADM'), a, code from core.permissions_catalog where code like 'rrhh.planillas.%';
  insert into core.prueba_permisos select pg_temp.id('APR'), a, 'rrhh.planillas.' || c from unnest(array[
    'planilla.ver', 'planilla.aprobar', 'planilla.pagar']) c;
  insert into core.prueba_permisos select pg_temp.id('ESP'), b, 'rrhh.planillas.' || c from unnest(array[
    'planilla.generar', 'movimientos.crear', 'liquidaciones.calcular']) c;

  -- Efectos de la migración sobre el contrato que ya existía (empresa B, en mensual).
  if (select frecuencia_pago from rrhh.contrato_compensacion where contrato_id = '00000000-0000-4000-8000-0000000000c0') <> 'quincenal'
     or not exists (select 1 from rrhh.contrato_regimen where contrato_id = '00000000-0000-4000-8000-0000000000c0'
                    and regimen = 'servicios_profesionales' and metodo_ir = 'exento' and vigente_desde = '2025-03-15' and vigente_hasta is null)
     or not exists (select 1 from core.audit_log where action = 'rrhh.planilla.frecuencia_migrada'
                    and entity_id = '00000000-0000-4000-8000-0000000000c0') then
    raise exception 'FALLO PL2: la migración no pasó a quincenal o no dio régimen al contrato existente';
  end if;
  -- Los 16 de PL2a (PL2b agrega otros; esta prueba también corre después de PL2b).
  if (select count(*) from rrhh.conceptos where company_id = a and codigo in ('SALARIO', 'AUSENCIA', 'HORAS_EXTRA',
        'COMISION', 'BONO', 'INSS_LABORAL', 'IR', 'IR_SP', 'ADELANTO', 'FALTANTE', 'DEDUCCION_OTRA', 'INSS_PATRONAL',
        'INATEC', 'PROV_VACACIONES', 'PROV_AGUINALDO', 'PROV_INDEMNIZACION')) <> 16 then
    raise exception 'FALLO PL2: catálogo de conceptos incompleto';
  end if;
  if (select count(*) from rrhh.feriados where company_id = a and fecha between '2026-01-01' and '2026-12-31') <> 14 then
    raise exception 'FALLO PL2: faltan feriados de 2026';
  end if;

  insert into rrhh.planilla_tipos (company_id, nombre, clase, frecuencia) values (a, 'PRUEBA mensual', 'ordinaria', 'mensual')
    returning id into v_t;
  insert into t_ids values ('TMEN', v_t);
  insert into t_ids select 'TQUI', id from rrhh.planilla_tipos where company_id = a and frecuencia = 'quincenal';

  insert into rrhh.jornadas (company_id, nombre) values (a, 'PRUEBA diurna') returning id into v_j;
  insert into t_ids values ('J', v_j);
  insert into rrhh.jornada_dias (jornada_id, company_id, dia_semana, laborable, hora_entrada, hora_salida, minutos_descanso)
  select v_j, a, d, d between 1 and 6, case when d between 1 and 6 then time '08:00' end,
         case when d between 1 and 6 then time '17:00' end, case when d between 1 and 6 then 60 else 0 end
  from generate_series(0, 6) d;

  -- C1: servicios profesionales exento, quincenal (G1, G2, G7). C2 y C3: laboral,
  -- mensual (G3, G4, G5). C4: laboral, quincenal (IR quincenal). K1 → K2: la misma
  -- persona con un contrato nuevo por aumento de salario desde el 16 de octubre.
  perform pg_temp.contrato('C1', 11350.00, 'quincenal', date '2023-06-01');
  perform pg_temp.contrato('C2', 11350.00, 'mensual', date '2025-01-01');
  perform pg_temp.contrato('C3', 20000.00, 'mensual', date '2025-01-01');
  perform pg_temp.contrato('C4', 11350.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('K1', 11350.00, 'quincenal', date '2025-01-01', date '2026-10-15');
  perform pg_temp.contrato('K2', 12000.00, 'quincenal', date '2026-10-16', null, 'EK1');
  insert into rrhh.contrato_jornadas (company_id, contrato_id, jornada_id, vigente_desde)
  select a, pg_temp.id(k), v_j, date '2023-06-01' from unnest(array['C1', 'C4']) k;

  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C1'), 'servicios_profesionales', 'ninguno', 'exento', null,
    true, true, true, date '2023-06-01', 'PRUEBA igual que AG');
  perform public.planilla_regimen_cambiar(a, pg_temp.id(k), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2025-01-01', 'PRUEBA régimen laboral') from unnest(array['C2', 'C3', 'C4', 'K1']) k;
  perform public.planilla_regimen_cambiar(a, pg_temp.id('K2'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2026-10-16', 'PRUEBA régimen laboral');
end;
$$;

-- -----------------------------------------------------------------------------
-- G1, G6 y G8: liquidación (simulador, no guarda nada)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v jsonb;
  l jsonb;
begin
  perform pg_temp.como('ESP');
  v := public.planilla_liquidacion_simular(a, pg_temp.id('C1'), date '2026-09-01', 'despido_sin_causa', 4);
  if (v->>'diario')::numeric <> 378.3333 then raise exception 'FALLO PL2: G1 diario distinto de 378.3333'; end if;
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'INDEMNIZACION';
  if (l->>'dias')::numeric <> 95 or (l->>'monto')::numeric <> 35941.66 then
    raise exception 'FALLO PL2: G1 indemnización % días y % C', l->>'dias', l->>'monto';
  end if;
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'AGUINALDO';
  if (l->>'dias')::numeric <> 20 or (l->>'monto')::numeric <> 7566.67 then
    raise exception 'FALLO PL2: G1 aguinaldo % días y % C', l->>'dias', l->>'monto';
  end if;
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'VACACIONES';
  if (l->>'monto')::numeric <> 1513.33 then raise exception 'FALLO PL2: G1 vacaciones % C', l->>'monto'; end if;
  if (v->>'total')::numeric <> 45021.66 then raise exception 'FALLO PL2: G1 total % en vez de 45021.66', v->>'total'; end if;
  if exists (select 1 from rrhh.planilla_lineas) then raise exception 'FALLO PL2: el simulador guardó líneas'; end if;

  -- Renuncia (art. 43): igual a G1. Despido con causa justa (art. 48): solo aguinaldo y vacaciones.
  v := public.planilla_liquidacion_simular(a, pg_temp.id('C1'), date '2026-09-01', 'renuncia', 4);
  if (v->>'total')::numeric <> 45021.66 then raise exception 'FALLO PL2: G8 renuncia % en vez de 45021.66', v->>'total'; end if;
  v := public.planilla_liquidacion_simular(a, pg_temp.id('C1'), date '2026-09-01', 'despido_causa_justa', 4);
  if (v->>'total')::numeric <> 9080.00 then raise exception 'FALLO PL2: G8 causa justa % en vez de 9080.00', v->>'total'; end if;

  -- G6: 10 años, tope de 150 días.
  v := rrhh.fn_liquidacion_calcular(a, 11350, date '2016-09-01', date '2026-09-01', 'despido_sin_causa', true, 0, 0, null, true, false, true);
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'INDEMNIZACION';
  if (l->>'dias')::numeric <> 150 or (l->>'monto')::numeric <> 56750.00 then
    raise exception 'FALLO PL2: G6 tope % días y % C', l->>'dias', l->>'monto';
  end if;
  -- G8: 4 meses, mínimo de 30 días con aviso.
  v := rrhh.fn_liquidacion_calcular(a, 11350, date '2026-05-01', date '2026-09-01', 'despido_sin_causa', true, 0, 0, null, true, false, true);
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'INDEMNIZACION';
  if (l->>'dias')::numeric <> 30 or (l->>'monto')::numeric <> 11350.00 or jsonb_array_length(v->'avisos') = 0 then
    raise exception 'FALLO PL2: G8 mínimo % días y % C', l->>'dias', l->>'monto';
  end if;

  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_simular(%L, %L, '2026-09-01', 'vencimiento', 0)$q$, a, pg_temp.id('C1')),
    'pendiente de definir', 'liquidación por vencimiento');
  perform pg_temp.debe_fallar(format($q$select rrhh.fn_liquidacion_calcular(%L, 11350, '2025-01-01', '2026-09-01', 'despido_sin_causa', false, 0, 0, null, true, true, true)$q$, a),
    'tiempo determinado', 'indemnización de contrato determinado');
end;
$$;

-- -----------------------------------------------------------------------------
-- Planilla mensual: G3, G4, G5, idempotencia, separación de funciones,
-- insumo cambiado, estados, inmutabilidad y pago
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_pm uuid;
  v_h1 text;
  v_l1 jsonb;
  v_l2 jsonb;
  v_nov uuid;
begin
  perform pg_temp.como('ESP');
  v_pm := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-10-01', date '2026-10-31');
  insert into t_ids values ('PM', v_pm);
  perform public.planilla_calcular(a, v_pm);

  if pg_temp.monto(v_pm, pg_temp.id('C2'), 'SALARIO') <> 11350.00 then raise exception 'FALLO PL2: salario mensual de C2'; end if;
  if pg_temp.monto(v_pm, pg_temp.id('C2'), 'INSS_LABORAL') <> 794.50 then raise exception 'FALLO PL2: G4 INSS laboral de C2'; end if;
  if pg_temp.monto(v_pm, pg_temp.id('C2'), 'IR') <> 333.33 then
    raise exception 'FALLO PL2: G4 IR de C2 es % en vez de 333.33', pg_temp.monto(v_pm, pg_temp.id('C2'), 'IR');
  end if;
  if pg_temp.monto(v_pm, pg_temp.id('C2'), 'INSS_PATRONAL') <> 2440.25 or pg_temp.monto(v_pm, pg_temp.id('C2'), 'INATEC') <> 227.00 then
    raise exception 'FALLO PL2: G3 aportes patronales de C2';
  end if;
  if pg_temp.monto(v_pm, pg_temp.id('C3'), 'INSS_LABORAL') <> 1400.00 or pg_temp.monto(v_pm, pg_temp.id('C3'), 'IR') <> 1636.67 then
    raise exception 'FALLO PL2: G5 IR de C3 es %', pg_temp.monto(v_pm, pg_temp.id('C3'), 'IR');
  end if;
  if exists (select 1 from rrhh.planilla_empleados where planilla_id = v_pm and contrato_id in (pg_temp.id('C1'), pg_temp.id('C4'))) then
    raise exception 'FALLO PL2: entraron contratos quincenales en la planilla mensual';
  end if;
  if (select neto from rrhh.planilla_empleados where planilla_id = v_pm and contrato_id = pg_temp.id('C2')) <> 11350.00 - 794.50 - 333.33 then
    raise exception 'FALLO PL2: neto de C2 no es la suma de líneas';
  end if;
  if (select (totales->>'neto')::numeric from rrhh.planillas where id = v_pm)
     <> (select sum(neto) from rrhh.planilla_empleados where planilla_id = v_pm) then
    raise exception 'FALLO PL2: el total de la planilla no suma los renglones';
  end if;

  -- Idempotencia: recalcular da las mismas líneas y la misma huella.
  select hash_insumos into v_h1 from rrhh.planillas where id = v_pm;
  select jsonb_agg(jsonb_build_array(contrato_id, concepto_codigo, cantidad, base, tasa, monto) order by contrato_id, orden, concepto_codigo)
    into v_l1 from rrhh.planilla_lineas where planilla_id = v_pm;
  perform public.planilla_calcular(a, v_pm);
  select jsonb_agg(jsonb_build_array(contrato_id, concepto_codigo, cantidad, base, tasa, monto) order by contrato_id, orden, concepto_codigo)
    into v_l2 from rrhh.planilla_lineas where planilla_id = v_pm;
  if v_l1 is distinct from v_l2 or v_h1 is distinct from (select hash_insumos from rrhh.planillas where id = v_pm) then
    raise exception 'FALLO PL2: recalcular no es idempotente';
  end if;

  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'rrhh.planillas.planilla.aprobar', 'aprobar sin permiso');

  -- Separación de funciones: quien calcula no aprueba, aunque tenga ambos permisos.
  perform pg_temp.como('ADM');
  perform public.planilla_calcular(a, v_pm);
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'no puede aprobarla', 'aprobar lo que uno calculó');

  -- Insumo cambiado después del cálculo.
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_pm);
  v_nov := public.planilla_novedad_crear(a, pg_temp.id('C2'), pg_temp.concepto('BONO'), date '2026-10-10', null, 500);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'Hubo cambios', 'aprobar con insumo cambiado');

  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_pm);
  if pg_temp.monto(v_pm, pg_temp.id('C2'), 'BONO') <> 500 or pg_temp.monto(v_pm, pg_temp.id('C2'), 'INSS_LABORAL') <> 829.50 then
    raise exception 'FALLO PL2: la novedad no entró en la base del INSS';
  end if;
  if (select estado from rrhh.novedades where id = v_nov) <> 'aplicada' then raise exception 'FALLO PL2: novedad no quedó aplicada'; end if;

  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, v_pm);
  if (select estado from rrhh.planillas where id = v_pm) <> 'aprobada'
     or (select hash_aprobado from rrhh.planillas where id = v_pm) is null then
    raise exception 'FALLO PL2: la planilla no quedó aprobada con huella';
  end if;

  -- Estados ilegales.
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'Solo se aprueba', 'aprobar dos veces');
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_pm), 'no se recalcula', 'recalcular aprobada');
  perform pg_temp.debe_fallar(format('select public.planilla_novedad_anular(%L, %L)', a, v_nov), 'planilla aprobada', 'anular novedad de planilla aprobada');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-10-20', null, 100)$q$, a, pg_temp.id('C2'),
    pg_temp.concepto('BONO')), 'ya está aprobada', 'novedad en período aprobado');

  -- Inmutabilidad (defensa en profundidad, como superusuario).
  perform pg_temp.debe_fallar(format('update rrhh.planilla_lineas set monto = monto + 1 where planilla_id = %L', v_pm), 'ya no se modifica', 'editar línea aprobada');
  perform pg_temp.debe_fallar(format('delete from rrhh.planilla_lineas where planilla_id = %L', v_pm), 'ya no se modifica', 'borrar línea aprobada');
  perform pg_temp.debe_fallar(format('insert into rrhh.planilla_lineas select * from rrhh.planilla_lineas where planilla_id = %L limit 1', v_pm),
    'ya no se modifica', 'agregar línea a una aprobada');
  perform pg_temp.debe_fallar(format('update rrhh.planilla_empleados set neto = 0 where planilla_id = %L', v_pm), 'ya no se modifica', 'editar renglón aprobado');
  perform pg_temp.debe_fallar(format('update rrhh.planillas set total = 0 where id = %L', v_pm), 'ya no se modifica', 'editar planilla aprobada');
  perform pg_temp.debe_fallar(format('delete from rrhh.planillas where id = %L', v_pm), 'no se eliminan', 'borrar planilla');

  -- Pago con cheque; transferencia sin cuenta, rechazada. Pagada no se anula ni se edita.
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_pagar(%L, %L, 'transferencia')$q$, a, v_pm), 'cuenta bancaria', 'transferencia sin cuenta');
  perform pg_temp.debe_fallar(format($q$select public.planilla_pagar(%L, %L, 'cheque', null, '2026-09-01')$q$, a, v_pm), 'fecha de pago', 'pago con fecha anterior al período');
  perform public.planilla_pagar(a, v_pm, 'cheque', 'PRUEBA cheques 1 a 2');
  if (select estado from rrhh.planillas where id = v_pm) <> 'pagada' then raise exception 'FALLO PL2: no quedó pagada'; end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_anular(%L, %L, 'PRUEBA motivo')$q$, a, v_pm), 'pagada no se anula', 'anular pagada');
  perform pg_temp.debe_fallar(format('update rrhh.planillas set referencia_pago = null where id = %L', v_pm), 'pagada y ya no se modifica', 'editar pagada');
  perform pg_temp.debe_fallar(format('update rrhh.planilla_lineas set monto = 0 where planilla_id = %L', v_pm), 'ya no se modifica', 'editar línea pagada');

  -- Aprobar un borrador y pagar una calculada.
  perform pg_temp.como('ESP');
  v_pm := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-11-01', date '2026-11-30');
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'Solo se aprueba', 'aprobar borrador');
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_pm);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_pagar(%L, %L, 'cheque')$q$, a, v_pm), 'Solo se paga', 'pagar calculada');
end;
$$;

-- -----------------------------------------------------------------------------
-- Planilla quincenal: G2, G7, aviso, IR en dos quincenas y por persona,
-- zona horaria, anulación y reemplazo
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_q1 uuid;
  v_q2 uuid;
  v_q2b uuid;
  v_nov uuid;
  c1 uuid := pg_temp.id('C1');
  c4 uuid := pg_temp.id('C4');
begin
  perform set_config('timezone', 'UTC', true);
  perform pg_temp.como('ESP');
  v_q1 := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-01', date '2026-10-15');
  insert into t_ids values ('Q1', v_q1);
  perform public.planilla_calcular(a, v_q1);

  -- G2 y G7 (C1, servicios profesionales exento).
  if pg_temp.monto(v_q1, c1, 'SALARIO') <> 5675.00 then raise exception 'FALLO PL2: G2 quincena de C1'; end if;
  if pg_temp.monto(v_q1, c1, 'PROV_VACACIONES') <> 472.92 or pg_temp.monto(v_q1, c1, 'PROV_AGUINALDO') <> 472.92
     or pg_temp.monto(v_q1, c1, 'PROV_INDEMNIZACION') <> 472.92 or pg_temp.tipo(v_q1, c1, 'provision') <> 1418.76 then
    raise exception 'FALLO PL2: G2 provisiones de C1 suman % en vez de 1418.76', pg_temp.tipo(v_q1, c1, 'provision');
  end if;
  if pg_temp.tipo(v_q1, c1, 'deduccion') <> 0 or pg_temp.tipo(v_q1, c1, 'aporte_patronal') <> 0 then
    raise exception 'FALLO PL2: G7 servicios profesionales con INSS IR o aportes';
  end if;
  if not exists (select 1 from rrhh.planilla_empleados where planilla_id = v_q1 and contrato_id = c1
                 and 'Revisar régimen con el contador' = any (avisos)) then
    raise exception 'FALLO PL2: G7 falta el aviso de régimen';
  end if;
  if not exists (select 1 from rrhh.planillas, jsonb_array_elements_text(totales->'avisos') x
                 where id = v_q1 and x like '%provision indemnizacion divisor%') then
    raise exception 'FALLO PL2: faltan avisos de valores por verificar';
  end if;
  -- C4 y K1 laborales: mitad del IR proyectado.
  if pg_temp.monto(v_q1, c4, 'IR') <> 166.66 or pg_temp.monto(v_q1, pg_temp.id('K1'), 'IR') <> 166.66 then
    raise exception 'FALLO PL2: IR de la primera quincena es % en vez de 166.66', pg_temp.monto(v_q1, c4, 'IR');
  end if;

  -- La segunda quincena exige la primera aprobada.
  v_q2 := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-16', date '2026-10-31');
  v_nov := public.planilla_novedad_crear(a, c1, pg_temp.concepto('BONO'), date '2026-10-20', null, 250);
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_q2), 'Aprueba primero', 'IR de la segunda quincena sin la primera aprobada');

  -- Calculada en UTC y aprobada en America/Managua: la huella no depende de la zona.
  perform set_config('timezone', 'America/Managua', true);
  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, v_q1);
  perform set_config('timezone', 'UTC', true);

  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_q2);
  if pg_temp.monto(v_q2, c4, 'IR') <> 166.67 or pg_temp.monto(v_q1, c4, 'IR') + pg_temp.monto(v_q2, c4, 'IR') <> 333.33 then
    raise exception 'FALLO PL2: IR de la segunda quincena es % en vez de 166.67', pg_temp.monto(v_q2, c4, 'IR');
  end if;
  -- Por persona: K1 hasta el 15 (C$11,350) y K2 desde el 16 (C$12,000).
  if pg_temp.monto(v_q2, pg_temp.id('K2'), 'IR') <> 212.00 then
    raise exception 'FALLO PL2: IR por persona en la segunda quincena es % en vez de 212.00', pg_temp.monto(v_q2, pg_temp.id('K2'), 'IR');
  end if;
  if exists (select 1 from rrhh.planilla_empleados where planilla_id = v_q2 and contrato_id = pg_temp.id('K1')) then
    raise exception 'FALLO PL2: un contrato terminado el 15 entró en la segunda quincena';
  end if;
  if pg_temp.monto(v_q2, c1, 'SALARIO') <> 5675.00 or pg_temp.monto(v_q2, c1, 'BONO') <> 250 then
    raise exception 'FALLO PL2: segunda quincena de C1';
  end if;
  if (select estado from rrhh.novedades where id = v_nov) <> 'aplicada' then raise exception 'FALLO PL2: bono no aplicado'; end if;

  -- Duplicado, período inválido, anulación y reemplazo.
  perform pg_temp.debe_fallar(format($q$select public.planilla_crear(%L, %L, '2026-10-16', '2026-10-31')$q$, a, pg_temp.id('TQUI')),
    'Ya existe', 'planilla duplicada');
  perform pg_temp.debe_fallar(format($q$select public.planilla_crear(%L, %L, '2026-10-16', '2026-10-30')$q$, a, pg_temp.id('TQUI')),
    'no corresponde', 'período quincenal inválido');
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_anular(%L, %L, 'x')$q$, a, v_q2), 'motivo', 'anular sin motivo');
  perform pg_temp.debe_fallar(format($q$select public.planilla_anular(%L, %L, 'PRUEBA motivo')$q$, a, v_q1),
    'segunda quincena', 'anular la primera con la segunda viva');
  perform public.planilla_anular(a, v_q2, 'PRUEBA error en el bono');
  if (select estado from rrhh.novedades where id = v_nov) <> 'pendiente'
     or (select planilla_id from rrhh.novedades where id = v_nov) is not null then
    raise exception 'FALLO PL2: anular no liberó la novedad';
  end if;
  perform pg_temp.debe_fallar(format('update rrhh.planillas set total = 1 where id = %L', v_q2), 'anulada y ya no se modifica', 'editar anulada');
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_q2), 'no se recalcula', 'recalcular anulada');
  v_q2b := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-16', date '2026-10-31', null, v_q2);
  if (select reemplaza_a from rrhh.planillas where id = v_q2b) <> v_q2 then raise exception 'FALLO PL2: reemplazo sin enlace'; end if;
  perform public.planilla_calcular(a, v_q2b);
  if pg_temp.monto(v_q2b, c1, 'BONO') <> 250 then raise exception 'FALLO PL2: la regenerada no tomó la novedad liberada'; end if;
  insert into t_ids values ('Q2B', v_q2b);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_anular(%L, %L, 'PRUEBA motivo')$q$, a, v_q1),
    'segunda quincena', 'anular la primera con la regenerada viva');

  -- Descartar el aviso de régimen quita el aviso en el siguiente cálculo.
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_aviso_descartar(%L, %L, 'PRUEBA motivo')$q$, a, c1),
    'rrhh.planillas.regimen.cambiar', 'descartar aviso sin permiso');
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_aviso_descartar(a, c1, 'PRUEBA revisado con el contador');
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_q2b);
  if exists (select 1 from rrhh.planilla_empleados where planilla_id = v_q2b and contrato_id = c1 and cardinality(avisos) > 0) then
    raise exception 'FALLO PL2: el aviso descartado sigue apareciendo';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Antigüedad que continúa entre contratos (K1 → K2)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  c4 uuid := pg_temp.id('C4');
  v jsonb;
  l jsonb;
begin
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_contrato_antiguedad_fijar(%L, %L, null, 'PRUEBA continuidad')$q$, a, pg_temp.id('K2')),
    'rrhh.planillas.liquidaciones.aprobar', 'fijar antigüedad sin permiso');
  perform pg_temp.como('ADM');
  if public.planilla_contrato_antiguedad_fijar(a, pg_temp.id('K2'), null, 'PRUEBA continuidad por aumento') <> date '2025-01-01' then
    raise exception 'FALLO PL2: la antigüedad no se heredó del contrato anterior';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_contrato_antiguedad_fijar(%L, %L, null, 'PRUEBA motivo')$q$, a, pg_temp.id('C4')),
    'No hay un contrato anterior', 'heredar sin contrato anterior');
  perform pg_temp.debe_fallar(format($q$select public.planilla_contrato_antiguedad_fijar(%L, %L, '2027-01-01', 'PRUEBA motivo')$q$, a, pg_temp.id('C4')),
    'no puede empezar después', 'antigüedad posterior al contrato');

  -- 22 meses desde la antigüedad, valorados con el último salario (C$12,000, diario 400).
  perform pg_temp.como('ESP');
  v := public.planilla_liquidacion_simular(a, pg_temp.id('K2'), date '2026-11-01', 'despido_sin_causa', 0);
  select x into l from jsonb_array_elements(v->'lineas') x where x->>'concepto' = 'INDEMNIZACION';
  if (l->>'dias')::numeric <> 55 or (l->>'monto')::numeric <> 22000.00 then
    raise exception 'FALLO PL2: liquidación con antigüedad heredada da % días y % C', l->>'dias', l->>'monto';
  end if;

  -- Nadie la escribe directo desde la API.
  begin
    set local role authenticated;
    update rrhh.contratos set fecha_antiguedad = date '2020-01-01' where id = c4;
    raise exception 'FALLO PL2: authenticated cambió la fecha de antigüedad directo';
  exception when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    if sqlerrm not like '%solo se cambia desde Planilla%' then
      raise exception 'FALLO PL2: escritura directa de antigüedad dio otro error: %', pg_temp.limpio(sqlerrm);
    end if;
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Horas extra, ausencias, deducciones, marcas y reintentos (1.ª quincena de noviembre)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_p uuid;
  c1 uuid := pg_temp.id('C1');
  c4 uuid := pg_temp.id('C4');
  v_hx uuid := pg_temp.concepto('HORAS_EXTRA');
  v_n uuid;
  v_n2 uuid;
  v_ids uuid[] := '{}';
  v_clave uuid := gen_random_uuid();
  d date;
begin
  -- C9: servicios profesionales sin jornada, pero con una marca en el kiosco.
  perform pg_temp.contrato('C9', 11350.00, 'quincenal', date '2026-11-01');
  insert into rrhh.asistencia_marcas (company_id, empleado_id, contrato_id, marcado_en)
  values (a, pg_temp.id('EC9'), pg_temp.id('C9'), timestamptz '2026-11-05 08:00:00-06');
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C9'), 'servicios_profesionales', 'ninguno', 'exento', null,
    false, false, false, date '2026-11-01', 'PRUEBA sin jornada');

  perform pg_temp.como('ESP');
  v_p := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-11-01', date '2026-11-15');
  perform public.planilla_novedad_crear(a, c4, v_hx, date '2026-11-03', 2, null);
  perform public.planilla_novedad_crear(a, c1, pg_temp.concepto('AUSENCIA'), date '2026-11-04', 2, null);
  perform public.planilla_calcular(a, v_p);
  -- 2 h × (378.3333 / 8) × 2 = 189.166650
  if pg_temp.monto(v_p, c4, 'HORAS_EXTRA') <> 189.17 then
    raise exception 'FALLO PL2: horas extra % en vez de 189.17', pg_temp.monto(v_p, c4, 'HORAS_EXTRA');
  end if;
  -- 13 días × 378.3333 = 4918.3329
  if pg_temp.monto(v_p, c1, 'SALARIO') <> 4918.33 then
    raise exception 'FALLO PL2: salario con ausencias % en vez de 4918.33', pg_temp.monto(v_p, c1, 'SALARIO');
  end if;
  if not exists (select 1 from rrhh.planilla_empleados where planilla_id = v_p and contrato_id = pg_temp.id('C9')
                 and 'Revisar régimen con el contador' = any (avisos)) then
    raise exception 'FALLO PL2: falta el aviso de régimen por marcas en el kiosco';
  end if;

  -- Topes legales de horas extra: por día y por semana (9 h del lunes 9 al viernes 13).
  v_n := public.planilla_novedad_crear(a, c4, v_hx, date '2026-11-03', 2, null);
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_p), 'más de 3 horas extra en un día', 'tope diario de horas extra');
  perform public.planilla_novedad_anular(a, v_n);
  for d in select generate_series(date '2026-11-09', date '2026-11-13', interval '1 day')::date loop
    v_ids := v_ids || public.planilla_novedad_crear(a, c4, v_hx, d, 2, null);
  end loop;
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_p), 'más de 9 horas extra en una semana', 'tope semanal de horas extra');
  perform public.planilla_novedad_anular(a, x) from unnest(v_ids) x;

  -- Deducción mayor que lo disponible: nunca neto negativo.
  v_n := public.planilla_novedad_crear(a, c1, pg_temp.concepto('DEDUCCION_OTRA'), date '2026-11-05', null, 99999);
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_p), 'superan lo disponible', 'neto negativo');
  perform public.planilla_novedad_anular(a, v_n);

  -- Reintento con la misma clave (Mobile): una sola novedad.
  v_n := public.planilla_novedad_crear(a, c1, pg_temp.concepto('BONO'), date '2026-11-06', null, 100, null, null, v_clave);
  v_n2 := public.planilla_novedad_crear(a, c1, pg_temp.concepto('BONO'), date '2026-11-06', null, 100, null, null, v_clave);
  if v_n <> v_n2 or (select count(*) from rrhh.novedades where clave_idempotencia = v_clave) <> 1 then
    raise exception 'FALLO PL2: el reintento duplicó la novedad';
  end if;
  perform public.planilla_calcular(a, v_p);

  -- Validaciones de novedades.
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-11-06', null, 10)$q$, a, c4, v_hx),
    'cantidad válida', 'horas extra con monto');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-11-06', null, 10)$q$, a, c4,
    pg_temp.concepto('INSS_LABORAL')), 'no admite novedades', 'novedad de concepto de sistema');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2020-01-01', 1, null)$q$, a, c4, v_hx),
    'fuera de la vigencia', 'novedad antes del contrato');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-11-06', null, 10, null, %L)$q$, a, c4,
    pg_temp.concepto('BONO'), pg_temp.id('TMEN')), 'otra frecuencia', 'novedad para un tipo de otra frecuencia');
end;
$$;

-- -----------------------------------------------------------------------------
-- Régimen: coherencia, fecha, corrección, faltante y cambio dentro del período
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_p uuid;
  v_e uuid;
  v_c uuid;
  c3 uuid := pg_temp.id('C3');
begin
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'ninguno', 'tabla_progresiva', null, true, true, true, '2027-01-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'régimen laboral lleva', 'laboral sin INSS');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'servicios_profesionales', 'ninguno', 'retencion_fija', null, true, true, true, '2027-01-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'Servicios profesionales va', 'retención fija sin porcentaje');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'ivm', 'tabla_progresiva', null, true, true, true, '2027-01-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'IVM', 'IVM sin tasas');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2027-01-10', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'inicio de un período', 'régimen a mitad de período');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2025-01-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'ya se usó en una planilla', 'corregir una vigencia ya usada');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2026-11-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'planilla calculada o aprobada', 'cambio que pisa una planilla calculada');
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2027-01-16', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C2')), 'o 16 en quincenal', 'día 16 en un contrato mensual');

  -- Contrato finalizado con dos cambios de régimen: vigencias contiguas, sin solape.
  perform pg_temp.contrato('C11', 11350.00, 'mensual', date '2025-01-01', date '2026-12-10');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C11'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2025-01-01', 'PRUEBA primer régimen');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C11'), 'servicios_profesionales', 'ninguno', 'exento', null,
    false, false, false, date '2026-12-01', 'PRUEBA segundo régimen');
  if (select count(*) from rrhh.contrato_regimen where contrato_id = pg_temp.id('C11')) <> 2
     or not exists (select 1 from rrhh.contrato_regimen where contrato_id = pg_temp.id('C11') and vigente_hasta = '2026-11-30')
     or exists (select 1 from rrhh.contrato_regimen r1 join rrhh.contrato_regimen r2 on r2.contrato_id = r1.contrato_id and r2.id <> r1.id
                where r1.contrato_id = pg_temp.id('C11') and r1.vigente_desde <= coalesce(r2.vigente_hasta, 'infinity'::date)
                  and r2.vigente_desde <= coalesce(r1.vigente_hasta, 'infinity'::date)) then
    raise exception 'FALLO PL2: dos cambios de régimen en un contrato finalizado se solapan';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2027-01-01', 'PRUEBA motivo')$q$,
    a, pg_temp.id('C11')), 'ya terminó', 'régimen después del fin del contrato');

  -- Cambio desde el 1 de enero, todavía sin usar, y corrección al 1 de diciembre:
  -- la vigencia anterior se cierra el 30 de noviembre.
  perform public.planilla_regimen_cambiar(a, c3, 'servicios_profesionales', 'ninguno', 'retencion_fija', 0.10,
    false, false, false, date '2027-01-01', 'PRUEBA cambio de régimen');
  perform public.planilla_regimen_cambiar(a, c3, 'servicios_profesionales', 'ninguno', 'retencion_fija', 0.10,
    false, false, false, date '2026-12-01', 'PRUEBA corrección de fecha');
  perform pg_temp.como('ESP');
  v_p := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-12-01', date '2026-12-31');

  -- Defensa del motor: si un régimen cambiara a mitad de período (forzado directo en la base), no prorratea.
  begin
    update rrhh.contrato_regimen set vigente_hasta = date '2026-12-09' where contrato_id = c3 and regimen = 'laboral';
    update rrhh.contrato_regimen set vigente_desde = date '2026-12-10' where contrato_id = c3 and vigente_hasta is null;
    perform public.planilla_calcular(a, v_p);
    raise exception 'FALLO PL2: el motor prorrateó un régimen a mitad de período';
  exception when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    if sqlerrm not like '%cambia dentro del período%' then
      raise exception 'FALLO PL2: régimen a mitad de período dio otro error: %', pg_temp.limpio(sqlerrm);
    end if;
  end;
  if (select count(*) from rrhh.contrato_regimen where contrato_id = c3) <> 2
     or not exists (select 1 from rrhh.contrato_regimen where contrato_id = c3 and regimen = 'laboral' and vigente_hasta = '2026-11-30')
     or not exists (select 1 from rrhh.contrato_regimen where contrato_id = c3 and vigente_desde = '2026-12-01' and vigente_hasta is null) then
    raise exception 'FALLO PL2: la corrección del régimen no quedó bien';
  end if;

  -- Retención fija de servicios profesionales: 10% de 20000, sin aportes ni provisiones.
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_p);
  if pg_temp.monto(v_p, c3, 'IR_SP') <> 2000.00 or pg_temp.tipo(v_p, c3, 'aporte_patronal') <> 0
     or pg_temp.tipo(v_p, c3, 'provision') <> 0 then
    raise exception 'FALLO PL2: retención fija de servicios profesionales';
  end if;
  -- C11 terminó el 10 de diciembre con el segundo régimen: 10 días, sin INSS.
  if pg_temp.monto(v_p, pg_temp.id('C11'), 'SALARIO') <> 3783.33 or pg_temp.tipo(v_p, pg_temp.id('C11'), 'deduccion') <> 0 then
    raise exception 'FALLO PL2: contrato finalizado a mitad de mes da %', pg_temp.monto(v_p, pg_temp.id('C11'), 'SALARIO');
  end if;

  -- 2.ª quincena de diciembre sin planilla de la 1.ª: no calcula el IR sobre media quincena.
  v_p := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-12-16', date '2026-12-31');
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', a, v_p), 'Falta la planilla de la primera quincena', 'segunda quincena sin la primera');

  -- Contrato sin régimen: error con motivo (el bloque revierte el contrato de prueba).
  v_p := public.planilla_crear(a, pg_temp.id('TMEN'), date '2027-01-01', date '2027-01-31');
  begin
    insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', 'C5') returning id into v_e;
    insert into rrhh.contratos (company_id, empleado_id, estado, fecha_inicio) values (a, v_e, 'activo', date '2027-01-01') returning id into v_c;
    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, frecuencia_pago) values (v_c, a, 11350, 'mensual');
    perform public.planilla_calcular(a, v_p);
    raise exception 'FALLO PL2: calculó un contrato sin régimen';
  exception when others then
    if sqlerrm like 'FALLO%' then raise; end if;
    if sqlerrm not like '%no tiene régimen%' then raise exception 'FALLO PL2: contrato sin régimen dio otro error'; end if;
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Febrero de 2027: días 30/360, techo del INSS, quien crea no aprueba,
-- transferencia, un solo tipo por frecuencia y parámetros
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_p uuid;
  v_id uuid;
begin
  perform pg_temp.contrato('C7', 11350.00, 'mensual', date '2025-01-01', date '2027-02-25');
  perform pg_temp.contrato('C8', 11350.00, 'mensual', date '2027-02-16');
  perform pg_temp.contrato('C10', 150000.00, 'mensual', date '2027-02-01');
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C7'), 'servicios_profesionales', 'ninguno', 'exento', null,
    false, false, false, date '2025-01-01', 'PRUEBA contrato terminado');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C8'), 'servicios_profesionales', 'ninguno', 'exento', null,
    false, false, false, date '2027-02-16', 'PRUEBA ingreso a mitad de mes');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('C10'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2027-02-01', 'PRUEBA salario alto');

  -- Quien crea no aprueba, aunque otro haya calculado.
  v_p := public.planilla_crear(a, pg_temp.id('TMEN'), date '2027-02-01', date '2027-02-28');
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_p);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, v_p), 'no puede aprobarla', 'aprobar lo que uno creó');

  -- Egreso el 25 de febrero: 25 días. Ingreso el 16: 15 días (el 28 cuenta como 30).
  if pg_temp.monto(v_p, pg_temp.id('C7'), 'SALARIO') <> 9458.33 then
    raise exception 'FALLO PL2: egreso a mitad de febrero paga % en vez de 9458.33', pg_temp.monto(v_p, pg_temp.id('C7'), 'SALARIO');
  end if;
  if pg_temp.monto(v_p, pg_temp.id('C8'), 'SALARIO') <> 5675.00 then
    raise exception 'FALLO PL2: ingreso a mitad de febrero paga % en vez de 5675.00', pg_temp.monto(v_p, pg_temp.id('C8'), 'SALARIO');
  end if;
  -- Techo del INSS (valor de ejemplo C$100,000): 7% y 21.5% sobre el techo.
  if pg_temp.monto(v_p, pg_temp.id('C10'), 'INSS_LABORAL') <> 7000.00 or pg_temp.monto(v_p, pg_temp.id('C10'), 'INSS_PATRONAL') <> 21500.00 then
    raise exception 'FALLO PL2: techo del INSS da %', pg_temp.monto(v_p, pg_temp.id('C10'), 'INSS_LABORAL');
  end if;

  -- Otra persona aprueba y paga por transferencia, con cuentas activas.
  perform pg_temp.como('APR');
  perform public.planilla_aprobar(a, v_p);
  insert into rrhh.empleado_cuentas_bancarias (empleado_id, company_id)
  select distinct empleado_id, a from rrhh.planilla_empleados where planilla_id = v_p;
  perform public.planilla_pagar(a, v_p, 'transferencia', 'PRUEBA lote 1');
  if (select metodo_pago from rrhh.planillas where id = v_p) <> 'transferencia' then raise exception 'FALLO PL2: pago por transferencia'; end if;

  -- Un solo tipo activo por clase y frecuencia (evita pagar dos veces).
  perform pg_temp.debe_fallar(format($q$insert into rrhh.planilla_tipos (company_id, nombre, clase, frecuencia) values (%L, 'PRUEBA otra quincenal', 'ordinaria', 'quincenal')$q$, a),
    'planilla_tipos_activo_unico', 'segundo tipo quincenal activo');

  -- Parámetros: nueva vigencia auditada; sin escritura directa.
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_parametro_vigencia_nueva(%L, 'techo_inss', 120000, '2027-03-01', 'verificar', 'PRUEBA factura')$q$, a),
    'rrhh.planillas.parametros.editar', 'parámetro sin permiso');
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_parametro_vigencia_nueva(%L, 'techo_inss', 120000, '2027-02-01', 'verificar', 'PRUEBA factura')$q$, a),
    'planillas aprobadas', 'parámetro antes de una planilla aprobada');
  perform pg_temp.debe_fallar(format($q$select public.planilla_parametro_vigencia_nueva(%L, 'dias_mes_comercial', 0, '2027-06-01', 'verificar', 'PRUEBA')$q$, a),
    'valor válido', 'días del mes en cero');
  perform pg_temp.debe_fallar(format($q$select public.planilla_parametro_vigencia_nueva(%L, 'aguinaldo_mes_inicio', 13, '2027-06-01', 'verificar', 'PRUEBA')$q$, a),
    'valor válido', 'mes de aguinaldo fuera de rango');
  v_id := public.planilla_parametro_vigencia_nueva(a, 'techo_inss', 120000, date '2027-03-01', 'verificar', 'PRUEBA factura del INSS');
  if rrhh.fn_planilla_parametro(a, 'techo_inss', date '2027-02-28') <> 100000 or rrhh.fn_planilla_parametro(a, 'techo_inss', date '2027-03-01') <> 120000 then
    raise exception 'FALLO PL2: la nueva vigencia del parámetro no quedó bien';
  end if;
  if has_table_privilege('authenticated', 'rrhh.parametros_ley', 'INSERT') or has_table_privilege('authenticated', 'rrhh.parametros_ley', 'UPDATE') then
    raise exception 'FALLO PL2: parametros_ley sigue con escritura directa';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC de contrato recreadas con la frecuencia (cuerpo real, no stub)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_dep uuid;
  v_pue uuid;
  v_pla uuid;
  v_e uuid;
  v_c uuid;
begin
  insert into rrhh.departamentos (company_id) values (a) returning id into v_dep;
  insert into rrhh.puestos (company_id, departamento_id) values (a, v_dep) returning id into v_pue;
  insert into rrhh.plantillas_contrato (company_id) values (a) returning id into v_pla;
  insert into rrhh.puesto_plantillas (puesto_id, plantilla_id, company_id) values (v_pue, v_pla, a);
  insert into core.prueba_permisos select pg_temp.id('ADM'), a, 'rrhh.expedientes.' || c
  from unnest(array['contratos.crear', 'contratos.editar', 'compensacion.editar']) c;
  perform pg_temp.como('ADM');

  -- Con frecuencia (parámetro nuevo).
  insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', 'N1') returning id into v_e;
  select x.contrato_id into v_c from public.crear_contrato(a, v_e, v_pue, v_dep, v_pla, 'nomina_estandar', date '2027-03-01', 11350, 'mensual') x;
  if (select frecuencia_pago from rrhh.contrato_compensacion where contrato_id = v_c) <> 'mensual' then
    raise exception 'FALLO PL2: crear_contrato no guardó la frecuencia';
  end if;
  perform public.editar_contrato(v_c, a, p_frecuencia_pago => 'quincenal');
  if (select frecuencia_pago from rrhh.contrato_compensacion where contrato_id = v_c) <> 'quincenal' then
    raise exception 'FALLO PL2: editar_contrato no cambió la frecuencia';
  end if;
  -- La fecha de inicio no puede quedar antes de la antigüedad.
  perform public.planilla_contrato_antiguedad_fijar(a, v_c, date '2027-02-01', 'PRUEBA antigüedad previa');
  perform pg_temp.debe_fallar(format($q$select public.editar_contrato(%L, %L, p_fecha_inicio => '2027-01-15')$q$, v_c, a),
    'anterior a la fecha de antigüedad', 'inicio antes de la antigüedad');

  -- Sin frecuencia, como llama la app hoy: queda en quincenal.
  insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', 'N2') returning id into v_e;
  select x.contrato_id into v_c from public.crear_contrato(a, v_e, v_pue, v_dep, v_pla, 'nomina_estandar', date '2027-03-01', 11350) x;
  if (select frecuencia_pago from rrhh.contrato_compensacion where contrato_id = v_c) <> 'quincenal' then
    raise exception 'FALLO PL2: el default de frecuencia no es quincenal';
  end if;
  insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', 'N3') returning id into v_e;
  perform pg_temp.debe_fallar(format($q$select * from public.crear_contrato(%L, %L, %L, %L, %L, 'nomina_estandar', '2027-03-01', 11350, 'diaria')$q$,
    a, v_e, v_pue, v_dep, v_pla), 'Frecuencia de pago no válida', 'frecuencia inválida');
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos, empresa ajena, parámetro faltante, particiones y privilegios
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  b uuid := pg_temp.id('B');
  v_pm uuid := pg_temp.id('PM');
  c1 uuid := pg_temp.id('C1');
  v_bono uuid := pg_temp.concepto('BONO');
  x record;
begin
  -- Cada RPC exige su código exacto.
  perform pg_temp.como('NADA');
  for x in select * from (values
    (format($q$select public.planilla_crear(%L, %L, '2026-12-01', '2026-12-31')$q$, a, pg_temp.id('TMEN')), 'planilla.generar'),
    (format('select public.planilla_calcular(%L, %L)', a, v_pm), 'planilla.generar'),
    (format('select public.planilla_aprobar(%L, %L)', a, v_pm), 'planilla.aprobar'),
    (format($q$select public.planilla_pagar(%L, %L, 'cheque')$q$, a, v_pm), 'planilla.pagar'),
    (format($q$select public.planilla_anular(%L, %L, 'PRUEBA motivo')$q$, a, v_pm), 'planilla.anular'),
    (format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-12-02', null, 10)$q$, a, c1, v_bono), 'movimientos.crear'),
    (format('select public.planilla_novedad_anular(%L, %L)', a, (select id from rrhh.novedades limit 1)), 'movimientos.eliminar'),
    (format($q$select public.planilla_regimen_cambiar(%L, %L, 'laboral', 'integral', 'tabla_progresiva', null, true, true, true, '2027-02-01', 'PRUEBA motivo')$q$, a, c1), 'regimen.cambiar'),
    (format($q$select public.planilla_regimen_aviso_descartar(%L, %L, 'PRUEBA motivo')$q$, a, c1), 'regimen.cambiar'),
    (format($q$select public.planilla_contrato_antiguedad_fijar(%L, %L, null, 'PRUEBA motivo')$q$, a, c1), 'liquidaciones.aprobar'),
    (format($q$select public.planilla_parametro_vigencia_nueva(%L, 'techo_inss', 1, '2028-01-01', 'verificar', 'PRUEBA')$q$, a), 'parametros.editar'),
    (format($q$select public.planilla_liquidacion_simular(%L, %L, '2026-09-01', 'renuncia', 0)$q$, a, c1), 'liquidaciones.calcular')
  ) as v(sentencia, codigo) loop
    begin
      execute x.sentencia;
      raise exception 'FALLO PL2: una RPC aceptó a un usuario sin permiso: %', x.codigo;
    exception when insufficient_privilege then
      if sqlerrm not like '%rrhh.planillas.' || x.codigo || '%' then
        raise exception 'FALLO PL2: la RPC pidió otro permiso en vez de %', x.codigo;
      end if;
    end;
  end loop;
  -- Sin sesión también se niega.
  perform pg_temp.como('');
  begin
    perform public.planilla_calcular(a, v_pm);
    raise exception 'FALLO PL2: una llamada sin sesión fue aceptada';
  exception when insufficient_privilege then null;
  end;

  -- Empresa ajena: con permisos en B no se toca nada de A.
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format('select public.planilla_calcular(%L, %L)', b, pg_temp.id('Q2B')), 'no encontrada', 'calcular planilla de otra empresa');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_crear(%L, %L, %L, '2026-12-02', null, 10)$q$, b, c1, v_bono),
    'Contrato no encontrado', 'novedad en contrato de otra empresa');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_simular(%L, %L, '2026-09-01', 'renuncia', 0)$q$, b, c1),
    'Contrato no encontrado', 'liquidación de otra empresa');
  perform pg_temp.debe_fallar(format($q$select public.planilla_crear(%L, %L, '2026-12-01', '2026-12-15')$q$, b, pg_temp.id('TQUI')),
    'Tipo de planilla no encontrado', 'tipo de planilla de otra empresa');

  -- Parámetro faltante: error con el código.
  perform pg_temp.debe_fallar(format($q$select public.planilla_crear(%L, %L, '2025-12-01', '2025-12-31')$q$, a, pg_temp.id('TMEN')),
    'dias_mes_comercial', 'parámetro faltante');

  -- Particiones: un mes nuevo crea su partición con RLS y sin grants.
  perform public.planilla_crear(a, pg_temp.id('TMEN'), date '2027-06-01', date '2027-06-30');
  perform public.planilla_novedad_crear(a, c1, v_bono, date '2027-06-02', null, 10);
  if not exists (select 1 from pg_class where oid = to_regclass('rrhh.planilla_lineas_2027_06') and relrowsecurity)
     or not exists (select 1 from pg_class where oid = to_regclass('rrhh.novedades_2027_06') and relrowsecurity) then
    raise exception 'FALLO PL2: la partición nueva no existe o no tiene RLS';
  end if;
  if has_table_privilege('authenticated', 'rrhh.planilla_lineas_2027_06', 'SELECT') then
    raise exception 'FALLO PL2: la partición es legible directamente';
  end if;

  -- Privilegios: solo lectura para authenticated, nada para anon, núcleos cerrados.
  if not has_table_privilege('authenticated', 'rrhh.planilla_lineas', 'SELECT')
     or has_table_privilege('authenticated', 'rrhh.planilla_lineas', 'INSERT')
     or has_table_privilege('authenticated', 'rrhh.novedades', 'UPDATE')
     or has_table_privilege('authenticated', 'rrhh.planillas', 'INSERT')
     or has_table_privilege('authenticated', 'rrhh.contrato_regimen', 'UPDATE')
     or has_table_privilege('anon', 'rrhh.planilla_empleados', 'SELECT') then
    raise exception 'FALLO PL2: privilegios de tablas incorrectos';
  end if;
  if has_function_privilege('authenticated', 'rrhh.fn_planilla_calcular_nucleo(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'rrhh.fn_planilla_contratos(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.planilla_calcular(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.planilla_calcular(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric,text)', 'EXECUTE') then
    raise exception 'FALLO PL2: privilegios de funciones incorrectos';
  end if;

  -- Tramos de IR contiguos y parámetros corregidos.
  if exists (select 1 from (select desde, lag(hasta) over (order by desde) prev from rrhh.ir_tramos where company_id = a) tr
             where tr.prev is not null and tr.desde <> tr.prev + 0.01) then
    raise exception 'FALLO PL2: tramos de IR con huecos';
  end if;
  if rrhh.fn_planilla_parametro(a, 'inss_patronal', date '2026-10-31') <> 0.215 then
    raise exception 'FALLO PL2: INSS patronal no es 21.5 por ciento';
  end if;

  -- Auditoría de cada transición.
  if (select count(distinct action) from core.audit_log where company_id = a and action in (
        'rrhh.planilla.creada', 'rrhh.planilla.calculada', 'rrhh.planilla.aprobada', 'rrhh.planilla.pagada',
        'rrhh.planilla.anulada', 'rrhh.planilla.novedad_creada', 'rrhh.planilla.novedad_anulada',
        'rrhh.planilla.regimen_cambiado', 'rrhh.planilla.regimen_corregido', 'rrhh.planilla.aviso_regimen_descartado',
        'rrhh.planilla.antiguedad_fijada', 'rrhh.planilla.parametro_cambiado')) <> 12 then
    raise exception 'FALLO PL2: faltan acciones en la auditoría';
  end if;
end;
$$;

rollback;
