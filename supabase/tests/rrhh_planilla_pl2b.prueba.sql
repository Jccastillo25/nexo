-- Pruebas de PL2b (vacaciones, préstamos, embargos, aguinaldo, liquidación
-- como documento, pasivo laboral y provisiones). Solo PGlite: entorno de
-- planilla + PL2a + entorno PL2b + Paso Cero PL2b + PL2b. Todo dentro de una
-- transacción que se revierte. Empresas y personas con prefijo PRUEBA.
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
create function pg_temp.neto(p_planilla uuid, p_contrato uuid) returns numeric language sql as $$
  select neto from rrhh.planilla_empleados where planilla_id = p_planilla and contrato_id = p_contrato
$$;
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
-- Préstamo creado por el especialista con "hoy" fijo en el 1 de octubre de 2026
-- (la RPC pública rechaza una primera cuota en un período ya pasado).
create function pg_temp.prestamo(p_k text, p_tipo text, p_monto numeric, p_cuotas integer, p_nota text default null)
returns uuid language sql as $$
  select rrhh.fn_planilla_prestamo_crear(pg_temp.id('ESP'), pg_temp.id('A'), pg_temp.id(p_k), p_tipo, p_monto, p_cuotas,
    date '2026-10-01', p_nota, 'nexo', date '2026-10-01')
$$;
create function pg_temp.contrato(p_k text, p_salario numeric, p_frecuencia text, p_inicio date) returns uuid
language plpgsql as $$
declare
  a uuid := pg_temp.id('A');
  v_e uuid;
  v_c uuid;
begin
  insert into rrhh.empleados (company_id, nombre, apellido) values (a, 'PRUEBA', p_k) returning id into v_e;
  insert into rrhh.contratos (company_id, empleado_id, estado, fecha_inicio) values (a, v_e, 'activo', p_inicio) returning id into v_c;
  insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, frecuencia_pago) values (v_c, a, p_salario, p_frecuencia);
  insert into t_ids values (p_k, v_c);
  return v_c;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos: usuarios, contratos, régimen y efectos de la migración
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  v_j uuid;
begin
  insert into t_ids values ('A', a), ('B', b),
    ('ESP', '00000000-0000-4000-8000-000000000011'), ('ADM', '00000000-0000-4000-8000-000000000012'),
    ('NADA', '00000000-0000-4000-8000-000000000013'), ('APR', '00000000-0000-4000-8000-000000000014'),
    ('SUP', '00000000-0000-4000-8000-000000000015');
  insert into auth.users select v from t_ids where k in ('ESP', 'ADM', 'NADA', 'APR', 'SUP');
  insert into core.prueba_permisos select pg_temp.id('SUP'), a, 'rrhh.planillas.' || c from unnest(array[
    'vacaciones.ver', 'vacaciones.aprobar']) c;
  insert into core.prueba_permisos select pg_temp.id('ESP'), a, 'rrhh.planillas.' || c from unnest(array[
    'planilla.ver', 'planilla.generar', 'movimientos.ver', 'movimientos.crear', 'movimientos.eliminar',
    'vacaciones.ver', 'vacaciones.registrar', 'prestamos.ver', 'prestamos.gestionar',
    'liquidaciones.ver', 'liquidaciones.calcular', 'conceptos.ver']) c;
  insert into core.prueba_permisos select pg_temp.id('ADM'), a, code from core.permissions_catalog where code like 'rrhh.planillas.%';
  insert into core.prueba_permisos select pg_temp.id('APR'), a, 'rrhh.planillas.' || c from unnest(array[
    'planilla.ver', 'planilla.aprobar', 'planilla.pagar', 'vacaciones.ver', 'vacaciones.aprobar', 'prestamos.ver',
    'liquidaciones.ver', 'liquidaciones.aprobar', 'liquidaciones.pagar', 'liquidaciones.anular']) c;
  insert into core.prueba_permisos values (pg_temp.id('APR'), a, 'rrhh.expedientes.contratos.finalizar');

  -- Paso Cero y migración.
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 27
     or (select count(*) from core.app_role_permissions rp join core.app_roles ar on ar.id = rp.app_role_id
         where ar.role_key = 'admin' and rp.permission_code in ('rrhh.planillas.liquidaciones.pagar', 'rrhh.planillas.liquidaciones.anular')) <> 2 then
    raise exception 'FALLO PL2: el Paso Cero de PL2b no dejó los 27 permisos o no los dio a admin';
  end if;
  if (select count(*) from rrhh.conceptos where company_id = a
      and codigo in ('PRESTAMO', 'EMBARGO_ALIMENTOS', 'EMBARGO_JUDICIAL', 'VACACIONES_PAGADAS', 'AGUINALDO')) <> 5 then
    raise exception 'FALLO PL2: faltan conceptos de PL2b';
  end if;
  insert into t_ids select 'TQUI', id from rrhh.planilla_tipos where company_id = a and clase = 'ordinaria' and frecuencia = 'quincenal';
  insert into t_ids select 'TAG', id from rrhh.planilla_tipos where company_id = a and clase = 'aguinaldo';
  if pg_temp.id('TAG') is null or pg_temp.id('TQUI') is null then
    raise exception 'FALLO PL2: faltan los tipos de planilla quincenal o de aguinaldo';
  end if;

  insert into rrhh.jornadas (company_id, nombre) values (a, 'PRUEBA diurna') returning id into v_j;
  insert into rrhh.jornada_dias (jornada_id, company_id, dia_semana, laborable, hora_entrada, hora_salida, minutos_descanso)
  select v_j, a, d, d between 1 and 6, case when d between 1 and 6 then time '08:00' end,
         case when d between 1 and 6 then time '17:00' end, case when d between 1 and 6 then 60 else 0 end
  from generate_series(0, 6) d;

  -- L1: laboral, quincenal (vacaciones y pasivo). P1 y P2: servicios profesionales
  -- exentos, quincenal (embargos y préstamos). Q1, Q2 y Q3: servicios profesionales,
  -- mensual (liquidaciones; no entran en las planillas quincenales de la prueba).
  perform pg_temp.contrato('L1', 11350.00, 'quincenal', date '2026-01-01');
  perform pg_temp.contrato('P1', 11350.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('P2', 11350.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('Q1', 11350.00, 'mensual', date '2023-06-01');
  perform pg_temp.contrato('Q2', 11350.00, 'mensual', date '2025-01-01');
  perform pg_temp.contrato('Q3', 11350.00, 'mensual', date '2026-08-01');
  -- P3: salario bajo para que los embargos no quepan. Q4: liquidación con salario pendiente y confianza.
  perform pg_temp.contrato('P3', 1000.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('P4', 11350.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('V1', 11350.00, 'mensual', date '2026-01-01');
  perform pg_temp.contrato('Q4', 11350.00, 'mensual', date '2024-01-01');
  insert into rrhh.contrato_jornadas (company_id, contrato_id, jornada_id, vigente_desde) values (a, pg_temp.id('L1'), v_j, date '2026-01-01');

  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('L1'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2026-01-01', 'PRUEBA régimen laboral');
  perform public.planilla_regimen_cambiar(a, pg_temp.id(k), 'servicios_profesionales', 'ninguno', 'exento', null,
    true, true, true, (select fecha_inicio from rrhh.contratos where id = pg_temp.id(k)), 'PRUEBA igual que AG')
  from unnest(array['P1', 'P2', 'Q1', 'Q2', 'Q3', 'P3', 'P4', 'Q4', 'V1']) k;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vacaciones: saldo, goce, saldo negativo, ajuste, rechazo y pasivo
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  l1 uuid := pg_temp.id('L1');
  v_m uuid;
  s record;
  pz record;
begin
  select * into s from rrhh.fn_vacaciones_saldo(l1, date '2026-07-01');
  if s.acumulado <> 15 or s.saldo <> 15 then
    raise exception 'FALLO PL2: saldo de vacaciones a seis meses % en vez de 15', s.saldo;
  end if;

  -- Pasivo a la misma fecha: 15 días de cada prestación a 378.3333 por día.
  perform pg_temp.como('ESP');
  select * into pz from public.planilla_pasivo_laboral(a, date '2026-07-01') x where x.contrato_id = l1;
  if pz.vacaciones_monto <> 5675.00 or pz.aguinaldo_dias <> 15 or pz.aguinaldo_monto <> 5675.00
     or pz.indemnizacion_dias <> 15 or pz.indemnizacion_monto <> 5675.00 or pz.total <> 17025.00 then
    raise exception 'FALLO PL2: pasivo laboral a seis meses: vacaciones %, aguinaldo %, indemnización %, total %',
      pz.vacaciones_monto, pz.aguinaldo_monto, pz.indemnizacion_monto, pz.total;
  end if;

  v_m := public.planilla_vacaciones_registrar(a, l1, 'goce', date '2026-07-06', date '2026-07-10', 5, null);
  if (select saldo from rrhh.fn_vacaciones_saldo(l1, date '2026-07-31')) <> 17.5 then
    raise exception 'FALLO PL2: una solicitud sin aprobar ya cuenta en el saldo';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_aprobar(%L, %L)$q$, a, v_m),
    'rrhh.planillas.vacaciones.aprobar', 'aprobar vacaciones sin permiso');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);
  if (select saldo from rrhh.fn_vacaciones_saldo(l1, date '2026-07-31')) <> 12.5 then
    raise exception 'FALLO PL2: el goce aprobado no descontó el saldo';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_aprobar(%L, %L)$q$, a, v_m),
    'Solo se aprueba un movimiento solicitado', 'aprobar dos veces');

  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'goce', '2026-07-08', '2026-07-09', 2, null)$q$, a, l1),
    'Ya hay vacaciones registradas', 'goce que se solapa');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'goce', '2026-08-03', '2026-08-04', 3, null)$q$, a, l1),
    'más que los del rango', 'más días que el rango');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'ajuste', '2026-08-15', null, 2, null)$q$, a, l1),
    'motivo', 'ajuste sin motivo');
  v_m := public.planilla_vacaciones_registrar(a, l1, 'goce', date '2026-08-01', date '2026-08-20', 20, null);
  perform pg_temp.como('APR');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_aprobar(%L, %L)$q$, a, v_m),
    'quedaría negativo', 'goce sin saldo');
  perform public.planilla_vacaciones_rechazar(a, v_m, 'PRUEBA sin saldo suficiente');
  if (select estado from rrhh.vacaciones_movimientos where id = v_m) <> 'rechazada' then
    raise exception 'FALLO PL2: el rechazo no quedó registrado';
  end if;

  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, l1, 'ajuste', date '2026-08-15', null, 2, 'PRUEBA corrección de saldo');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);
  select * into s from rrhh.fn_vacaciones_saldo(l1, date '2026-08-31');
  if s.ajustes <> 2 or s.saldo <> 17 then
    raise exception 'FALLO PL2: saldo con ajuste % en vez de 17', s.saldo;
  end if;

  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, l1, 'saldo_inicial', date '2026-01-01', null, 0, 'PRUEBA saldo traído de AG');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'saldo_inicial', '2026-01-01', null, 0, 'PRUEBA segundo saldo')$q$, a, l1),
    'ya tiene un saldo inicial', 'dos saldos iniciales');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_anular(a, v_m, 'PRUEBA se registró por error');
  -- Un saldo inicial ya incluye lo ocurrido hasta su fecha de corte.
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'saldo_inicial', '2026-08-31', null, 5, 'PRUEBA corte tardío')$q$, a, l1),
    'hasta esa fecha de corte', 'saldo inicial con movimientos anteriores');

  -- Separación de funciones: quien registra no aprueba (aunque tenga los dos permisos).
  perform pg_temp.como('ADM');
  v_m := public.planilla_vacaciones_registrar(a, l1, 'ajuste', date '2026-08-20', null, 30, 'PRUEBA ajuste propio');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_aprobar(%L, %L)$q$, a, v_m),
    'Quien registra', 'aprobar el movimiento propio');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_rechazar(a, v_m, 'PRUEBA no corresponde');

  perform pg_temp.como('ESP');
  if (select count(*) from public.planilla_vacaciones_movimientos(a, l1, null)) <> 5
     or (select saldo from public.planilla_vacaciones_saldos(a, date '2026-08-31') x where x.contrato_id = l1) <> 17
     or (select valor from public.planilla_vacaciones_saldos(a, date '2026-08-31') x where x.contrato_id = l1) <> 6431.67 then
    raise exception 'FALLO PL2: listado o saldos de vacaciones incorrectos';
  end if;
  -- Quien solo ve y aprueba vacaciones (supervisor) ve días, no salarios.
  perform pg_temp.como('SUP');
  if (select count(*) from public.planilla_vacaciones_saldos(a, date '2026-08-31') x
      where x.salario_diario is not null or x.valor is not null) <> 0 then
    raise exception 'FALLO PL2: el saldo de vacaciones muestra salarios sin permiso de planilla';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Saldo inicial: acumula desde el día siguiente al corte, ignora lo anterior al
-- corte y no se anula si deja en negativo un goce ya aprobado
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  p3 uuid := pg_temp.id('P3');
  v1 uuid := pg_temp.id('V1');
  v_si uuid;
  v_m uuid;
begin
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'saldo_inicial', %L, null, 1, 'PRUEBA corte futuro')$q$,
      a, p3, (now() at time zone 'America/Managua')::date + 10),
    'no puede ser futura', 'saldo inicial con corte futuro');
  v_si := public.planilla_vacaciones_registrar(a, p3, 'saldo_inicial', date '2026-01-31', null, 10, 'PRUEBA corte de AG');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_si);
  -- Un goce anterior al corte (como si viniera de AG) ya está dentro del saldo inicial.
  insert into rrhh.vacaciones_movimientos (company_id, contrato_id, empleado_id, tipo, fecha_inicio, fecha_fin, dias, estado,
    registrado_por, aprobado_por)
  values (a, p3, (select empleado_id from rrhh.contratos where id = p3), 'goce', date '2026-01-10', date '2026-01-14', 5,
    'aprobada', pg_temp.id('ESP'), pg_temp.id('APR'));
  if (select saldo from rrhh.fn_vacaciones_saldo(p3, date '2026-02-28')) <> 12.25 then
    raise exception 'FALLO PL2: saldo después del corte % en vez de 12.25', (select saldo from rrhh.fn_vacaciones_saldo(p3, date '2026-02-28'));
  end if;
  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, p3, 'goce', date '2026-03-02', date '2026-03-13', 12, null);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);

  -- V1: saldo inicial 10 al 31 de enero, goce de 10 el 2 de febrero y de 1 en diciembre.
  perform pg_temp.como('ESP');
  v_si := public.planilla_vacaciones_registrar(a, v1, 'saldo_inicial', date '2026-01-31', null, 10, 'PRUEBA corte de AG');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_si);
  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, v1, 'goce', date '2026-02-02', date '2026-02-11', 10, null);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);
  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, v1, 'goce', date '2026-12-01', date '2026-12-01', 1, null);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_anular(%L, %L, 'PRUEBA quitar saldo')$q$, a, v_si),
    'quedaría negativo el 2026-02-02', 'anular un saldo inicial del que depende un goce');
end;
$$;

-- -----------------------------------------------------------------------------
-- Quincena del 1 al 15 de octubre: vacaciones pagadas, embargos, préstamo y
-- cuota que no cabe
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  l1 uuid := pg_temp.id('L1');
  p1 uuid := pg_temp.id('P1');
  p2 uuid := pg_temp.id('P2');
  v_pago uuid;
  v_pr uuid;
  v_ad uuid;
  v_q1 uuid;
  v_nov uuid;
  v_tot jsonb;
begin
  perform pg_temp.como('ESP');
  v_pago := public.planilla_vacaciones_registrar(a, l1, 'pago', date '2026-10-15', null, 2, null);
  insert into t_ids values ('VPAGO', v_pago);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_pago);
  select novedad_id into v_nov from rrhh.vacaciones_movimientos where id = v_pago;
  if v_nov is null or not exists (select 1 from rrhh.novedades where id = v_nov and origen = 'vacaciones' and cantidad = 2) then
    raise exception 'FALLO PL2: el pago de vacaciones no creó su novedad';
  end if;

  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_anular(%L, %L)$q$, a, v_nov),
    'desde Vacaciones', 'anular el pago de vacaciones desde novedades');

  -- La RPC pública rechaza una primera cuota en un período ya pasado.
  perform pg_temp.debe_fallar(format($q$select public.planilla_prestamo_crear(%L, %L, 'prestamo', 1000, 3, '2020-01-01')$q$, a, p1),
    'período ya pasado', 'préstamo con primera cuota en el pasado');
  perform pg_temp.debe_fallar(format($q$select rrhh.fn_planilla_prestamo_crear(%L, %L, %L, 'prestamo', 1000, 3, '2028-01-01', null, 'nexo', '2026-10-01')$q$,
      pg_temp.id('ESP'), a, p1),
    'más de un año', 'préstamo con primera cuota muy lejana');
  v_pr := pg_temp.prestamo('P1', 'prestamo', 1000, 3, 'PRUEBA préstamo');
  insert into t_ids values ('PR1', v_pr);
  if (select monto_cuota from rrhh.prestamos where id = v_pr) <> 333.33
     or (select string_agg(to_char(fecha, 'MM-DD') || ':' || monto, ',' order by cuota_numero) from rrhh.novedades where prestamo_id = v_pr)
        <> '10-15:333.33,10-31:333.33,11-15:333.34' then
    raise exception 'FALLO PL2: cuotas del préstamo mal generadas';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_novedad_anular(%L, %L)$q$, a,
      (select id from rrhh.novedades where prestamo_id = v_pr and cuota_numero = 1)),
    'desde Préstamos', 'anular una cuota desde novedades');
  perform pg_temp.debe_fallar(format($q$select public.planilla_prestamo_crear(%L, %L, 'prestamo', 0.02, 5, '2026-10-01')$q$, a, p1),
    'no alcanza', 'monto menor que las cuotas');
  v_ad := pg_temp.prestamo('P2', 'adelanto', 6000, 1);
  insert into t_ids values ('AD2', v_ad);

  perform public.planilla_embargo_crear(a, p1, 'alimentos', 'porcentaje', 0.10, null, 'PRUEBA expediente alimentos', date '2026-10-01');
  perform public.planilla_embargo_crear(a, p1, 'judicial', 'monto', 2000, 1500, 'PRUEBA expediente judicial', date '2026-10-01');
  -- P3: el neto no alcanza. Alimentos primero (50 por ciento de 500); el judicial se corta.
  perform public.planilla_embargo_crear(a, pg_temp.id('P3'), 'judicial', 'monto', 2000, null, 'PRUEBA judicial P3', date '2026-10-01');
  perform public.planilla_embargo_crear(a, pg_temp.id('P3'), 'alimentos', 'porcentaje', 0.50, null, 'PRUEBA alimentos P3', date '2026-10-01');
  -- P4: un embargo que empieza el 11 de octubre: el monto mensual se prorratea por días (5 de 30).
  perform public.planilla_embargo_crear(a, pg_temp.id('P4'), 'judicial', 'monto', 600, null, 'PRUEBA judicial tardío P4', date '2026-10-11');
  perform pg_temp.debe_fallar(format($q$select public.planilla_embargo_crear(%L, %L, 'judicial', 'porcentaje', 1.5, null, 'PRUEBA x', '2026-10-01')$q$, a, p1),
    'valor válido', 'embargo de más del 100 por ciento');

  v_q1 := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-01', date '2026-10-15');
  insert into t_ids values ('Q1OCT', v_q1);
  v_tot := public.planilla_calcular(a, v_q1);

  -- L1: 2 días de vacaciones pagadas a 378.3333, con INSS.
  if pg_temp.monto(v_q1, l1, 'VACACIONES_PAGADAS') <> 756.67 or pg_temp.monto(v_q1, l1, 'INSS_LABORAL') <> 450.22 then
    raise exception 'FALLO PL2: vacaciones pagadas % e INSS %', pg_temp.monto(v_q1, l1, 'VACACIONES_PAGADAS'), pg_temp.monto(v_q1, l1, 'INSS_LABORAL');
  end if;
  if not exists (select 1 from jsonb_array_elements_text(v_tot->'avisos') x where x like 'Vacaciones pagadas%')
     or not exists (select 1 from jsonb_array_elements_text(v_tot->'avisos') x where x like 'Embargo judicial%') then
    raise exception 'FALLO PL2: faltan los avisos de vacaciones pagadas o de embargo judicial';
  end if;
  -- P1: alimentos 10 por ciento, judicial 1000 de la quincena y la cuota del préstamo.
  if pg_temp.monto(v_q1, p1, 'EMBARGO_ALIMENTOS') <> 567.50 or pg_temp.monto(v_q1, p1, 'EMBARGO_JUDICIAL') <> 1000.00
     or pg_temp.monto(v_q1, p1, 'PRESTAMO') <> 333.33 or pg_temp.neto(v_q1, p1) <> 3774.17 then
    raise exception 'FALLO PL2: embargos y préstamo de P1: alimentos %, judicial %, cuota %, neto %',
      pg_temp.monto(v_q1, p1, 'EMBARGO_ALIMENTOS'), pg_temp.monto(v_q1, p1, 'EMBARGO_JUDICIAL'),
      pg_temp.monto(v_q1, p1, 'PRESTAMO'), pg_temp.neto(v_q1, p1);
  end if;
  -- P3: alimentos 250 (antes que el judicial), judicial cortado a 250, el tardío sin neto; aviso.
  if pg_temp.monto(v_q1, pg_temp.id('P3'), 'EMBARGO_ALIMENTOS') <> 250.00
     or pg_temp.monto(v_q1, pg_temp.id('P3'), 'EMBARGO_JUDICIAL') <> 250.00 or pg_temp.neto(v_q1, pg_temp.id('P3')) <> 0
     or not exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = v_q1 and e.contrato_id = pg_temp.id('P3')
                    and 'El embargo no cabe completo en el neto: se descontó lo disponible' = any (e.avisos)) then
    raise exception 'FALLO PL2: orden y corte de embargos sin neto: alimentos %, judicial %',
      pg_temp.monto(v_q1, pg_temp.id('P3'), 'EMBARGO_ALIMENTOS'), pg_temp.monto(v_q1, pg_temp.id('P3'), 'EMBARGO_JUDICIAL');
  end if;
  if pg_temp.monto(v_q1, pg_temp.id('P4'), 'EMBARGO_JUDICIAL') <> 100.00 then
    raise exception 'FALLO PL2: embargo prorrateado % en vez de 100', pg_temp.monto(v_q1, pg_temp.id('P4'), 'EMBARGO_JUDICIAL');
  end if;
  -- P2: el adelanto de 6000 no cabe en 5675; queda pendiente con aviso.
  if pg_temp.monto(v_q1, p2, 'ADELANTO') <> 0 or pg_temp.neto(v_q1, p2) <> 5675.00
     or not exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = v_q1 and e.contrato_id = p2
                    and 'Una cuota de préstamo no cabe en el neto: pasa a la siguiente planilla' = any (e.avisos))
     or (select estado from rrhh.novedades where prestamo_id = v_ad) <> 'pendiente' then
    raise exception 'FALLO PL2: la cuota que no cabe debía quedar pendiente con aviso';
  end if;

  perform pg_temp.como('APR');
  perform public.planilla_aprobar(a, v_q1);

  perform pg_temp.como('APR');
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_anular(%L, %L, 'PRUEBA anular pago')$q$, a, v_pago),
    'planilla aprobada', 'anular un pago de vacaciones ya aprobado en planilla');
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_prestamo_anular(%L, %L, 'PRUEBA anular')$q$, a, v_pr),
    'Cancélalo', 'anular un préstamo con cuotas cobradas');
end;
$$;

-- -----------------------------------------------------------------------------
-- Quincena del 16 al 31 de octubre: tope del embargo, cuota vencida y
-- cancelación del préstamo
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  p1 uuid := pg_temp.id('P1');
  p2 uuid := pg_temp.id('P2');
  v_q2 uuid;
  v_pr record;
  v_bono uuid;
begin
  perform pg_temp.como('ESP');
  v_bono := public.planilla_novedad_crear(a, p2, (select id from rrhh.conceptos where company_id = a and codigo = 'BONO'),
    date '2026-10-20', null, 500);
  v_q2 := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-16', date '2026-10-31');
  insert into t_ids values ('Q2OCT', v_q2);
  perform public.planilla_calcular(a, v_q2);
  if (select planilla_id from rrhh.novedades where prestamo_id = pg_temp.id('AD2')) is distinct from v_q2 then
    raise exception 'FALLO PL2: la cuota vencida no quedó aplicada a la segunda quincena';
  end if;
  -- Sin el bono la cuota vencida ya no cabe: el recálculo debe liberarla (no dejarla aplicada).
  perform public.planilla_novedad_anular(a, v_bono);
  perform public.planilla_calcular(a, v_q2);
  if (select estado || ':' || coalesce(planilla_id::text, '-') from rrhh.novedades where prestamo_id = pg_temp.id('AD2')) <> 'pendiente:-' then
    raise exception 'FALLO PL2: el recálculo no liberó la cuota vencida';
  end if;
  perform public.planilla_novedad_crear(a, p2, (select id from rrhh.conceptos where company_id = a and codigo = 'BONO'),
    date '2026-10-20', null, 500);
  perform public.planilla_calcular(a, v_q2);
  -- Tope de 1500: ya se aplicaron 1000; quedan 500.
  if pg_temp.monto(v_q2, p1, 'EMBARGO_JUDICIAL') <> 500.00 or pg_temp.monto(v_q2, p1, 'EMBARGO_ALIMENTOS') <> 567.50
     or pg_temp.neto(v_q2, p1) <> 4274.17 then
    raise exception 'FALLO PL2: tope del embargo judicial: judicial %, neto %', pg_temp.monto(v_q2, p1, 'EMBARGO_JUDICIAL'), pg_temp.neto(v_q2, p1);
  end if;
  -- La cuota vencida del 15 de octubre entra ahora que hay bono.
  if pg_temp.monto(v_q2, p2, 'ADELANTO') <> 6000.00 or pg_temp.neto(v_q2, p2) <> 175.00
     or (select planilla_id from rrhh.novedades where prestamo_id = pg_temp.id('AD2')) <> v_q2 then
    raise exception 'FALLO PL2: la cuota vencida no se cobró en la siguiente planilla (neto %)', pg_temp.neto(v_q2, p2);
  end if;

  -- Cancelar el préstamo de P1 (pagado fuera de planilla) anula las cuotas no aprobadas.
  perform public.planilla_prestamo_cancelar(a, pg_temp.id('PR1'), 'PRUEBA pagó en efectivo');
  select * into v_pr from public.planilla_prestamos_saldos(a) x where x.prestamo_id = pg_temp.id('PR1');
  if v_pr.estado <> 'cancelado' or v_pr.aplicado <> 333.33 or v_pr.pendiente <> 0 then
    raise exception 'FALLO PL2: saldo del préstamo cancelado: estado %, aplicado %, pendiente %', v_pr.estado, v_pr.aplicado, v_pr.pendiente;
  end if;
  if (select string_agg(x.cuota_numero || ':' || x.estado || ':' || coalesce(x.planilla_estado, '-'), ',' order by x.cuota_numero)
      from public.planilla_prestamo_cuotas(a, pg_temp.id('PR1')) x) <> '1:aplicada:aprobada,2:anulada:-,3:anulada:-' then
    raise exception 'FALLO PL2: cuotas del préstamo cancelado mal listadas';
  end if;
  perform pg_temp.como('APR');
  perform pg_temp.debe_fallar(format($q$select public.planilla_aprobar(%L, %L)$q$, a, v_q2),
    'Hubo cambios', 'aprobar después de cancelar un préstamo');
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_q2);
  if pg_temp.monto(v_q2, p1, 'PRESTAMO') <> 0 or pg_temp.neto(v_q2, p1) <> 4607.50 then
    raise exception 'FALLO PL2: el recálculo no quitó la cuota cancelada (neto %)', pg_temp.neto(v_q2, p1);
  end if;
  perform pg_temp.como('APR');
  perform public.planilla_aprobar(a, v_q2);
  if (select estado from public.planilla_embargos_saldos(a) x where x.tipo = 'judicial' and x.contrato_id = p1) <> 'activo'
     or (select pendiente from public.planilla_embargos_saldos(a) x where x.tipo = 'judicial' and x.contrato_id = p1) <> 0
     or (select aplicado from public.planilla_embargos_saldos(a) x where x.tipo = 'judicial' and x.contrato_id = p1) <> 1500 then
    raise exception 'FALLO PL2: saldo del embargo judicial incorrecto';
  end if;
  if (select estado from public.planilla_prestamos_saldos(a) x where x.prestamo_id = pg_temp.id('AD2')) <> 'pagado' then
    raise exception 'FALLO PL2: el adelanto cobrado no aparece como pagado';
  end if;

  -- Anular la segunda quincena devuelve la cuota vencida a pendiente.
  perform pg_temp.como('ADM');
  perform public.planilla_anular(a, v_q2, 'PRUEBA anular la segunda quincena');
  if (select estado || ':' || coalesce(planilla_id::text, '-') from rrhh.novedades where prestamo_id = pg_temp.id('AD2')) <> 'pendiente:-' then
    raise exception 'FALLO PL2: anular la planilla no liberó la cuota vencida';
  end if;
  -- Embargo registrado por error: terminarlo antes de su inicio lo anula y el motor lo ignora.
  perform pg_temp.como('ESP');
  perform public.planilla_embargo_crear(a, p1, 'judicial', 'monto', 300, null, 'PRUEBA registrado por error', date '2026-11-01');
  perform public.planilla_embargo_terminar(a, (select id from rrhh.embargos where referencia = 'PRUEBA registrado por error'),
    date '2026-10-31', 'PRUEBA no corresponde');
  if (select estado from rrhh.embargos where referencia = 'PRUEBA registrado por error') <> 'anulado' then
    raise exception 'FALLO PL2: terminar antes del inicio no anuló el embargo';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Liquidación como documento: G1 con saldo de vacaciones y préstamo, quien
-- calcula no aprueba, huella, finalización del contrato, pago y anulación
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  q1 uuid := pg_temp.id('Q1');
  q2 uuid := pg_temp.id('Q2');
  q3 uuid := pg_temp.id('Q3');
  v_m uuid;
  v_l uuid;
  v_l2 uuid;
  v jsonb;
  d jsonb;
begin
  -- Q1: saldo inicial 0 al 1 de julio y un día gozado en agosto: saldo de 4 al 1 de septiembre.
  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, q1, 'saldo_inicial', date '2026-07-01', null, 0, 'PRUEBA saldo traído de AG');
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);
  perform pg_temp.como('ESP');
  v_m := public.planilla_vacaciones_registrar(a, q1, 'goce', date '2026-08-03', date '2026-08-03', 1, null);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_m);

  perform pg_temp.como('ESP');
  perform pg_temp.prestamo('Q1', 'prestamo', 3000, 3);
  v := public.planilla_liquidacion_simular(a, q1, date '2026-09-01', 'despido_sin_causa', null);
  if (v->>'dias_vacaciones')::numeric <> 4 or (v->>'total')::numeric <> 45021.66 or (v->>'total_deducciones')::numeric <> 3000 then
    raise exception 'FALLO PL2: simulador con saldo: vacaciones %, total %, deducciones %', v->>'dias_vacaciones', v->>'total', v->>'total_deducciones';
  end if;

  v_l := public.planilla_liquidacion_crear(a, q1, date '2026-09-01', 'despido_sin_causa');
  insert into t_ids values ('LIQ1', v_l);
  if (select total_devengado from rrhh.liquidaciones where id = v_l) <> 45021.66
     or (select total_deducciones from rrhh.liquidaciones where id = v_l) <> 3000.00
     or (select neto from rrhh.liquidaciones where id = v_l) <> 42021.66
     or (select count(*) from rrhh.liquidacion_lineas where liquidacion_id = v_l) <> 4 then
    raise exception 'FALLO PL2: G1 como documento no da 45021.66 menos 3000';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_crear(%L, %L, '2026-09-01', 'renuncia')$q$, a, q1),
    'ya tiene una liquidación', 'dos liquidaciones del mismo contrato');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_aprobar(%L, %L)$q$, a, v_l),
    'rrhh.planillas.liquidaciones.aprobar', 'aprobar sin permiso');

  -- Quien recalcula no aprueba.
  perform pg_temp.como('ADM');
  perform public.planilla_liquidacion_recalcular(a, v_l);
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_aprobar(%L, %L)$q$, a, v_l),
    'Quien crea o calcula', 'aprobar quien calculó');

  -- Un insumo cambia: la huella no coincide.
  update rrhh.contrato_compensacion set salario_base = 12000 where contrato_id = q1;
  perform pg_temp.como('APR');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_aprobar(%L, %L)$q$, a, v_l),
    'Hubo cambios', 'aprobar con un insumo cambiado');
  update rrhh.contrato_compensacion set salario_base = 11350.00 where contrato_id = q1;

  perform public.planilla_liquidacion_aprobar(a, v_l);
  if (select estado || ':' || fecha_fin_real from rrhh.contratos where id = q1) <> 'finalizado:2026-09-01'
     or (select saldo from rrhh.fn_vacaciones_saldo(q1, date '2026-09-01')) <> 0
     or (select estado from rrhh.prestamos where contrato_id = q1) <> 'cancelado'
     or exists (select 1 from rrhh.novedades n join rrhh.prestamos p on p.id = n.prestamo_id
                where p.contrato_id = q1 and (n.estado <> 'anulada' or n.liquidacion_id is distinct from v_l)) then
    raise exception 'FALLO PL2: aprobar la liquidación no finalizó el contrato, no liquidó vacaciones o no saldó el préstamo';
  end if;
  if (select aplicado from public.planilla_prestamos_saldos(a) x where x.contrato_id = q1) <> 3000 then
    raise exception 'FALLO PL2: el préstamo saldado en la liquidación no cuenta como aplicado';
  end if;
  perform pg_temp.debe_fallar(format($q$update rrhh.liquidaciones set neto = 1 where id = %L$q$, v_l),
    'aprobada y ya no se modifica', 'modificar una liquidación aprobada');
  perform pg_temp.debe_fallar(format($q$delete from rrhh.liquidacion_lineas where liquidacion_id = %L$q$, v_l),
    'detalle ya no se modifica', 'borrar líneas de una liquidación aprobada');
  perform public.planilla_liquidacion_pagar(a, v_l, 'cheque', 'PRUEBA 001');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_anular(%L, %L, 'PRUEBA anular')$q$, a, v_l),
    'pagada no se anula', 'anular una liquidación pagada');
  d := public.planilla_liquidacion_detalle(a, v_l);
  if d->'liquidacion'->>'estado' <> 'pagada' or jsonb_array_length(d->'lineas') <> 4
     or d->'liquidacion' ? 'hash_insumos' or d->'empresa'->>'nombre' <> 'PRUEBA Empresa A' then
    raise exception 'FALLO PL2: detalle de la liquidación incorrecto';
  end if;

  -- Q2: aprobar y anular devuelve vacaciones y cuotas; el contrato sigue finalizado.
  perform pg_temp.como('ESP');
  perform pg_temp.prestamo('Q2', 'prestamo', 1000, 1);
  v_l2 := public.planilla_liquidacion_crear(a, q2, date '2026-09-30', 'renuncia');
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_aprobar(%L, %L)$q$, a, v_l2),
    'finalizar contratos', 'aprobar sin permiso de finalizar contratos');
  perform pg_temp.como('APR');
  perform public.planilla_liquidacion_aprobar(a, v_l2);
  perform public.planilla_liquidacion_anular(a, v_l2, 'PRUEBA se aprobó con la causa equivocada');
  if (select estado from rrhh.prestamos where contrato_id = q2) <> 'activo'
     or (select n.estado from rrhh.novedades n join rrhh.prestamos p on p.id = n.prestamo_id where p.contrato_id = q2) <> 'pendiente'
     or exists (select 1 from rrhh.vacaciones_movimientos where contrato_id = q2 and tipo = 'liquidacion' and estado = 'aprobada')
     or (select estado from rrhh.contratos where id = q2) <> 'finalizado' then
    raise exception 'FALLO PL2: anular la liquidación aprobada no devolvió préstamo y vacaciones';
  end if;
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_crear(%L, %L, '2026-09-15', 'renuncia')$q$, a, q2),
    'terminó el 2026-09-30', 'otra fecha de egreso en un contrato finalizado');

  -- Q3: el préstamo no se descuenta del aguinaldo (art. 97).
  perform pg_temp.prestamo('Q3', 'prestamo', 6000, 1);
  v := public.planilla_liquidacion_simular(a, q3, date '2026-09-01', 'despido_causa_justa', null);
  if (v->>'total')::numeric <> 1891.66 or (v->>'total_deducciones')::numeric <> 945.83 or (v->>'neto')::numeric <> 945.83
     or not exists (select 1 from jsonb_array_elements_text(v->'avisos') x where x like '%quedan C$ 5054.17 sin descontar%') then
    raise exception 'FALLO PL2: tope del descuento en la liquidación: total %, deducciones %', v->>'total', v->>'total_deducciones';
  end if;

  -- Q4: salario pendiente 10 y confianza 3 escritos sin decimales: la huella coincide al aprobar.
  -- Quien la creó tampoco la aprueba, aunque la haya recalculado otra persona.
  perform pg_temp.como('ADM');
  v_l := public.planilla_liquidacion_crear(a, pg_temp.id('Q4'), date '2026-09-30', 'confianza', 10, 3);
  if (select count(*) from rrhh.liquidacion_lineas where liquidacion_id = v_l and concepto in ('SALARIO_PENDIENTE', 'INDEMNIZACION_CONFIANZA')) <> 2 then
    raise exception 'FALLO PL2: faltan las líneas de salario pendiente o de confianza';
  end if;
  perform pg_temp.como('ESP');
  perform public.planilla_liquidacion_recalcular(a, v_l);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_aprobar(%L, %L)$q$, a, v_l),
    'Quien crea o calcula', 'aprobar quien creó');
  perform pg_temp.como('APR');
  perform public.planilla_liquidacion_aprobar(a, v_l);

  -- El salario hasta el egreso se paga en la planilla del período: no se repite en la liquidación.
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_crear(%L, %L, '2026-10-10', 'renuncia', 5)$q$, a, pg_temp.id('L1')),
    'Ya hay una planilla del período del egreso', 'salario pendiente con planilla del período');
  v := public.planilla_liquidacion_simular(a, pg_temp.id('L1'), date '2026-10-10', 'renuncia', null);
  if not exists (select 1 from jsonb_array_elements_text(v->'avisos') x where x like 'La planilla del 2026-10-01 al 2026-10-15 pagó días posteriores al egreso%') then
    raise exception 'FALLO PL2: falta el aviso de días pagados después del egreso';
  end if;
  -- Y la planilla no lo paga si una liquidación ya lo incluyó.
  v_l := public.planilla_liquidacion_crear(a, pg_temp.id('P2'), date '2026-11-10', 'renuncia', 10);
  insert into t_ids values ('NOV1', public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-11-01', date '2026-11-15'));
  perform pg_temp.debe_fallar(format($q$select public.planilla_calcular(%L, %L)$q$, a, pg_temp.id('NOV1')),
    'calculada que paga el salario pendiente', 'planilla con salario pendiente en una liquidación calculada');
  perform pg_temp.como('APR');
  perform public.planilla_liquidacion_anular(a, v_l, 'PRUEBA salario pendiente duplicado');
  -- Con la liquidación ya aprobada y pagada, la planilla del período no paga días de salario a ese contrato.
  perform pg_temp.como('ESP');
  v_l := public.planilla_liquidacion_crear(a, pg_temp.id('P4'), date '2026-10-20', 'renuncia', 5);
  perform pg_temp.como('APR');
  perform public.planilla_liquidacion_aprobar(a, v_l);
  perform public.planilla_liquidacion_pagar(a, v_l, 'cheque', 'PRUEBA 002');
  perform pg_temp.como('ESP');
  insert into t_ids values ('Q2OCTB', public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-16', date '2026-10-31'));
  perform public.planilla_calcular(a, pg_temp.id('Q2OCTB'));
  if pg_temp.monto(pg_temp.id('Q2OCTB'), pg_temp.id('P4'), 'SALARIO') <> 0
     or not exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = pg_temp.id('Q2OCTB') and e.contrato_id = pg_temp.id('P4')
                    and 'El salario hasta el egreso se pagó en la liquidación' = any (e.avisos)) then
    raise exception 'FALLO PL2: la planilla volvió a pagar el salario que ya pagó la liquidación';
  end if;

  if (select count(*) from public.planilla_liquidaciones_listado(a)) <> 5 then
    raise exception 'FALLO PL2: listado de liquidaciones incorrecto';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aguinaldo: período, días, contratos liquidados, sin deducciones y pasivo
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_ag uuid;
  v_tot jsonb;
  v_nov uuid;
  v_pago uuid;
begin
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select public.planilla_crear(%L, %L, '2026-01-01', '2026-11-30')$q$, a, pg_temp.id('TAG')),
    'El período del aguinaldo va del 2026-01-01 al 2026-12-31', 'aguinaldo con período parcial');
  v_ag := public.planilla_crear(a, pg_temp.id('TAG'), date '2026-01-01', date '2026-12-31');
  v_tot := public.planilla_calcular(a, v_ag);
  -- Año completo: 30 días; P1 tiene embargos y no se le descuenta nada.
  if pg_temp.monto(v_ag, pg_temp.id('L1'), 'AGUINALDO') <> 11350.00 or pg_temp.monto(v_ag, pg_temp.id('P1'), 'AGUINALDO') <> 11350.00
     or pg_temp.neto(v_ag, pg_temp.id('P1')) <> 11350.00
     or exists (select 1 from rrhh.planilla_lineas where planilla_id = v_ag and concepto_codigo <> 'AGUINALDO') then
    raise exception 'FALLO PL2: aguinaldo del año completo o con deducciones';
  end if;
  -- Q1 ya lo cobró en su liquidación; Q2 terminó el 30 de septiembre sin liquidación vigente: proporcional.
  if exists (select 1 from rrhh.planilla_empleados where planilla_id = v_ag and contrato_id = pg_temp.id('Q1'))
     or pg_temp.monto(v_ag, pg_temp.id('Q2'), 'AGUINALDO') <> 8480.98
     or not exists (select 1 from jsonb_array_elements_text(v_tot->'avisos') x where x like 'Contratos con el aguinaldo ya pagado en su liquidación: 3') then
    raise exception 'FALLO PL2: aguinaldo de contratos terminados: Q2 %', pg_temp.monto(v_ag, pg_temp.id('Q2'), 'AGUINALDO');
  end if;

  -- Una quincena ordinaria se sigue calculando con el aguinaldo vivo, con un pago de
  -- vacaciones que después se anula antes de aprobarla.
  v_pago := public.planilla_vacaciones_registrar(a, pg_temp.id('L1'), 'pago', date '2026-11-14', null, 1, null);
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_aprobar(a, v_pago);
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, pg_temp.id('NOV1'));
  if pg_temp.monto(pg_temp.id('NOV1'), pg_temp.id('L1'), 'VACACIONES_PAGADAS') <> 378.33
     or exists (select 1 from rrhh.planilla_lineas l join rrhh.embargos e on e.id = any (l.origen_ids)
                where l.planilla_id = pg_temp.id('NOV1') and e.estado = 'anulado') then
    raise exception 'FALLO PL2: quincena de noviembre: vacaciones pagadas o embargo anulado';
  end if;
  perform pg_temp.como('APR');
  perform public.planilla_vacaciones_anular(a, v_pago, 'PRUEBA se pagará en diciembre');
  if (select n.estado from rrhh.novedades n where n.vacaciones_movimiento_id = v_pago) <> 'anulada' then
    raise exception 'FALLO PL2: anular el pago de vacaciones no anuló su novedad';
  end if;
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, pg_temp.id('NOV1'));
  if pg_temp.monto(pg_temp.id('NOV1'), pg_temp.id('L1'), 'VACACIONES_PAGADAS') <> 0 then
    raise exception 'FALLO PL2: el recálculo no quitó el pago de vacaciones anulado';
  end if;

  -- El aguinaldo calculado no impide un cambio de régimen del 16 de diciembre (sin
  -- tocar paga_aguinaldo); su huella cambia y hay que recalcularlo.
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('L1'), 'servicios_profesionales', 'ninguno', 'exento', null,
    true, true, true, date '2026-12-16', 'PRUEBA cambio a fin de año');
  perform pg_temp.como('APR');
  perform pg_temp.debe_fallar(format($q$select public.planilla_aprobar(%L, %L)$q$, a, v_ag),
    'Hubo cambios', 'aprobar el aguinaldo después de un cambio de régimen');
  perform pg_temp.como('ESP');
  perform public.planilla_calcular(a, v_ag);
  if pg_temp.monto(v_ag, pg_temp.id('L1'), 'AGUINALDO') <> 11350.00 then
    raise exception 'FALLO PL2: aguinaldo con dos vigencias de régimen % en vez de 11350', pg_temp.monto(v_ag, pg_temp.id('L1'), 'AGUINALDO');
  end if;
  -- Una novedad de noviembre no choca con el aguinaldo aprobado.
  perform pg_temp.como('APR');
  perform public.planilla_aprobar(a, v_ag);
  -- Con el aguinaldo aprobado, un parámetro que no usa (INATEC) sí admite vigencia en diciembre.
  perform pg_temp.como('ADM');
  perform public.planilla_parametro_vigencia_nueva(a, 'inatec', 0.02, date '2026-12-16', 'oficial', 'PRUEBA misma tasa');
  perform pg_temp.debe_fallar(format($q$select public.planilla_parametro_vigencia_nueva(%L, 'aguinaldo_dias_por_mes', 2.5, '2026-12-16', 'oficial', 'PRUEBA x')$q$, a),
    'Hay planillas aprobadas', 'parámetro del aguinaldo después de aprobarlo');
  perform pg_temp.como('ESP');
  v_nov := public.planilla_novedad_crear(a, pg_temp.id('P1'), (select id from rrhh.conceptos where company_id = a and codigo = 'BONO'),
    date '2026-11-20', null, 100);
  if v_nov is null then
    raise exception 'FALLO PL2: la planilla de aguinaldo aprobada bloqueó una novedad';
  end if;
  if (select aguinaldo_dias from public.planilla_pasivo_laboral(a, date '2026-12-15') x where x.contrato_id = pg_temp.id('L1')) <> 0 then
    raise exception 'FALLO PL2: el pasivo sigue contando el aguinaldo ya aprobado';
  end if;

  -- Liquidación posterior al aguinaldo aprobado: no lo repite.
  perform pg_temp.como('ESP');
  if exists (select 1 from jsonb_array_elements(public.planilla_liquidacion_simular(a, pg_temp.id('P1'), date '2026-12-20',
               'renuncia', 0)->'lineas') x where x->>'concepto' = 'AGUINALDO') then
    raise exception 'FALLO PL2: la liquidación repite el aguinaldo ya pagado';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Provisiones mensuales, permisos, empresa ajena y auditoría
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  b uuid := pg_temp.id('B');
  n1 integer;
  n2 integer;
  v_sql text;
begin
  perform pg_temp.como('ESP');
  n1 := public.planilla_provisiones_generar(a, date '2026-09-01');
  n2 := public.planilla_provisiones_generar(a, date '2026-09-15');
  if n1 = 0 or n1 <> n2 or (select count(*) from rrhh.provisiones where company_id = a and mes = '2026-09-01') <> n1 then
    raise exception 'FALLO PL2: provisiones mensuales no idempotentes';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_provisiones_generar(%L, '2027-06-01')$q$, a),
    'meses futuros', 'provisiones de un mes futuro');
  if not exists (select 1 from pg_class where oid = to_regclass('rrhh.provisiones_2026_09') and relrowsecurity)
     or not exists (select 1 from pg_class where oid = to_regclass('rrhh.vacaciones_movimientos_2026_07') and relrowsecurity) then
    raise exception 'FALLO PL2: una partición de provisiones o de vacaciones no tiene RLS';
  end if;
  -- La copia mensual guarda lo mismo que el pasivo a fin de mes.
  if (select p.total from rrhh.provisiones p where p.company_id = a and p.mes = '2026-09-01' and p.contrato_id = pg_temp.id('L1'))
     is distinct from (select x.total from public.planilla_pasivo_laboral(a, date '2026-09-30') x where x.contrato_id = pg_temp.id('L1')) then
    raise exception 'FALLO PL2: la copia de provisiones no coincide con el pasivo del mes';
  end if;
  -- Un saldo inicial con fecha de corte anterior a 2026 crea su partición.
  perform public.planilla_vacaciones_registrar(a, pg_temp.id('P2'), 'saldo_inicial', date '2025-06-30', null, 3, 'PRUEBA corte de AG');
  if not exists (select 1 from pg_class where oid = to_regclass('rrhh.vacaciones_movimientos_2025_06') and relrowsecurity) then
    raise exception 'FALLO PL2: no se creó la partición de vacaciones del saldo inicial';
  end if;
  perform pg_temp.debe_fallar(format($q$select public.planilla_vacaciones_registrar(%L, %L, 'goce', '2025-06-16', '2025-06-17', 2, null)$q$, a, pg_temp.id('P2')),
    'corte del saldo inicial', 'goce anterior al corte');

  perform pg_temp.como('NADA');
  foreach v_sql in array array[
    format($q$select public.planilla_vacaciones_registrar(%L, %L, 'goce', '2026-10-01', '2026-10-01', 1, null)$q$, a, pg_temp.id('L1')),
    format($q$select public.planilla_vacaciones_aprobar(%L, gen_random_uuid())$q$, a),
    format($q$select public.planilla_vacaciones_rechazar(%L, gen_random_uuid(), 'PRUEBA x')$q$, a),
    format($q$select public.planilla_vacaciones_anular(%L, gen_random_uuid(), 'PRUEBA x')$q$, a),
    format($q$select * from public.planilla_vacaciones_saldos(%L)$q$, a),
    format($q$select * from public.planilla_vacaciones_movimientos(%L)$q$, a),
    format($q$select public.planilla_prestamo_crear(%L, %L, 'prestamo', 100, 1, '2026-12-01')$q$, a, pg_temp.id('L1')),
    format($q$select public.planilla_prestamo_anular(%L, gen_random_uuid(), 'PRUEBA x')$q$, a),
    format($q$select public.planilla_prestamo_cancelar(%L, gen_random_uuid(), 'PRUEBA x')$q$, a),
    format($q$select * from public.planilla_prestamos_saldos(%L)$q$, a),
    format($q$select public.planilla_embargo_crear(%L, %L, 'alimentos', 'porcentaje', 0.1, null, 'PRUEBA x', '2026-12-01')$q$, a, pg_temp.id('L1')),
    format($q$select public.planilla_embargo_terminar(%L, gen_random_uuid(), '2026-12-01', 'PRUEBA x')$q$, a),
    format($q$select * from public.planilla_embargos_saldos(%L)$q$, a),
    format($q$select public.planilla_liquidacion_crear(%L, %L, '2026-12-01', 'renuncia')$q$, a, pg_temp.id('L1')),
    format($q$select public.planilla_liquidacion_recalcular(%L, gen_random_uuid())$q$, a),
    format($q$select public.planilla_liquidacion_aprobar(%L, gen_random_uuid())$q$, a),
    format($q$select public.planilla_liquidacion_pagar(%L, gen_random_uuid(), 'cheque')$q$, a),
    format($q$select public.planilla_liquidacion_anular(%L, gen_random_uuid(), 'PRUEBA x')$q$, a),
    format($q$select * from public.planilla_liquidaciones_listado(%L)$q$, a),
    format($q$select public.planilla_liquidacion_detalle(%L, gen_random_uuid())$q$, a),
    format($q$select * from public.planilla_pasivo_laboral(%L)$q$, a),
    format($q$select public.planilla_provisiones_generar(%L, '2026-09-01')$q$, a)] loop
    perform pg_temp.debe_fallar(v_sql, 'rrhh.planillas.', 'RPC de PL2b sin permiso');
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.debe_fallar(format($q$select * from public.planilla_vacaciones_saldos(%L)$q$, a),
    'rrhh.planillas.vacaciones.ver', 'sin sesión');

  -- Empresa ajena: el administrador de A no ve ni toca B; un id de A con la empresa B no aparece.
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format($q$select * from public.planilla_prestamos_saldos(%L)$q$, b),
    'rrhh.planillas.prestamos.ver', 'empresa ajena');
  insert into core.prueba_permisos values (pg_temp.id('ADM'), b, 'rrhh.planillas.liquidaciones.ver');
  perform pg_temp.debe_fallar(format($q$select public.planilla_liquidacion_detalle(%L, %L)$q$, b, pg_temp.id('LIQ1')),
    'no encontrada', 'liquidación de otra empresa');

  if (select count(distinct action) from core.audit_log where action in (
        'rrhh.planilla.vacaciones_registradas', 'rrhh.planilla.vacaciones_aprobadas', 'rrhh.planilla.vacaciones_rechazadas',
        'rrhh.planilla.vacaciones_anuladas', 'rrhh.planilla.prestamo_creado', 'rrhh.planilla.prestamo_cancelado',
        'rrhh.planilla.embargo_creado', 'rrhh.planilla.liquidacion_calculada', 'rrhh.planilla.liquidacion_recalculada',
        'rrhh.planilla.liquidacion_aprobada', 'rrhh.planilla.liquidacion_pagada', 'rrhh.planilla.liquidacion_anulada',
        'rrhh.planilla.provisiones_generadas')) <> 13 then
    raise exception 'FALLO PL2: falta auditoría de PL2b';
  end if;
end;
$$;

rollback;
