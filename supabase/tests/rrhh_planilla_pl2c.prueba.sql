-- Pruebas de PL2c (listados, reportes, declaraciones, Asistencia y
-- configuración). Solo PGlite, en la cadena de test:rrhh:planilla:
-- rrhh_planilla_entorno.sql + PL2a + entornos de PL2b y PL2c + Paso Cero PL2b +
-- PL2b + migración 20261022000003. Todo dentro de una transacción que se
-- revierte. Empresas y personas con prefijo PRUEBA.
-- Las planillas se calculan y aprueban con las RPC de PL2a y PL2b, con dos
-- usuarios distintos (separación de funciones); las vacaciones las registra uno
-- y las aprueba otro. Cifras: caso dorado (G3, G4, G5) y cálculos derivados con
-- las tasas de la semilla (INSS 7%, patronal 21.5%, INATEC 2%, techo C$100,000,
-- tabla de IR 2015). Todas las aserciones tratan un NULL como falla. No prueba
-- RLS efectiva, roles reales de Supabase, concurrencia ni el cálculo real de
-- rrhh.fn_asistencia_dias.
begin;

create temp table t_ids (k text primary key, v uuid) on commit drop;

create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from t_ids where k = p_k $$;
create function pg_temp.como(p_usuario text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(pg_temp.id(p_usuario)::text, ''), true)
$$;
create function pg_temp.limpio(p text) returns text language sql as $$
  select btrim(regexp_replace(coalesce(p, ''), '[^[:alpha:][:digit:] .,:]', ' ', 'g'))
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
    if coalesce(sqlerrm not like '%' || p_esperado || '%', true) then
      raise exception 'FALLO PL2: % dio otro error: %', p_caso, pg_temp.limpio(sqlerrm);
    end if;
    return;
  end;
  raise exception 'FALLO PL2: % no fue rechazado', p_caso;
end;
$$;
-- Exige 42501 y que el mensaje nombre el código de permiso.
create function pg_temp.debe_negar(p_sql text, p_codigo text, p_caso text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when insufficient_privilege then
      if coalesce(sqlerrm not like '%' || p_codigo || '%', true) then
        raise exception 'FALLO PL2: % pidió otro permiso', p_caso;
      end if;
      return;
    when others then
      raise exception 'FALLO PL2: % dio otro error: %', p_caso, pg_temp.limpio(sqlerrm);
  end;
  raise exception 'FALLO PL2: % aceptó a un usuario sin permiso', p_caso;
end;
$$;
-- Persona, contrato y compensación en la empresa A. p_fin no nulo deja el contrato finalizado.
create function pg_temp.contrato(p_k text, p_salario numeric, p_frecuencia text, p_inicio date, p_fin date default null)
returns uuid language plpgsql as $$
declare
  a uuid := pg_temp.id('A');
  v_e uuid;
  v_c uuid;
begin
  insert into rrhh.empleados (company_id, nombre, apellido, documento_identidad)
  values (a, 'PRUEBA', p_k, 'PRUEBA-' || p_k) returning id into v_e;
  insert into t_ids values ('E' || p_k, v_e);
  insert into rrhh.contratos (company_id, empleado_id, estado, fecha_inicio, fecha_fin_real)
  values (a, v_e, case when p_fin is null then 'activo' else 'finalizado' end, p_inicio, p_fin) returning id into v_c;
  insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, frecuencia_pago)
  values (v_c, a, p_salario, p_frecuencia);
  insert into t_ids values (p_k, v_c);
  return v_c;
end;
$$;
create function pg_temp.renglon(p_det jsonb, p_contrato uuid) returns jsonb language sql as $$
  select r from jsonb_array_elements(p_det->'renglones') r where (r->>'contrato_id')::uuid = p_contrato
$$;
create function pg_temp.linea(p_renglon jsonb, p_codigo text) returns jsonb language sql as $$
  select l from jsonb_array_elements(p_renglon->'lineas') l where l->>'concepto_codigo' = p_codigo
$$;
create function pg_temp.item(p_k text, p_fecha date, p_codigo text, p_cantidad numeric) returns jsonb language sql as $$
  select jsonb_build_object('contrato_id', pg_temp.id(p_k), 'fecha', p_fecha, 'concepto_codigo', p_codigo, 'cantidad', p_cantidad)
$$;
create function pg_temp.importar_sql(p_empresa text, p_items jsonb) returns text language sql as $$
  select format('select public.planilla_asistencia_importar(%L, %L, %L::jsonb)', pg_temp.id(p_empresa), pg_temp.id('Q1O'), p_items::text)
$$;

-- -----------------------------------------------------------------------------
-- Datos: usuarios, contratos, regímenes y tipo mensual (creado con la RPC nueva)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  v_j uuid;
  v_dep uuid;
  v_pu uuid;
  v_t uuid;
  v_k text;
begin
  insert into t_ids values ('A', a), ('B', b), ('C0', '00000000-0000-4000-8000-0000000000c0'),
    ('ESP', '00000000-0000-4000-8000-000000000001'), ('ADM', '00000000-0000-4000-8000-000000000002'),
    ('NADA', '00000000-0000-4000-8000-000000000003'), ('MOV', '00000000-0000-4000-8000-000000000005'),
    ('GES', '00000000-0000-4000-8000-000000000006'), ('COMP', '00000000-0000-4000-8000-000000000007');
  insert into auth.users select v from t_ids where k in ('ESP', 'ADM', 'NADA', 'MOV', 'GES', 'COMP');

  -- ESP: especialista (calcula y registra vacaciones, no aprueba). ADM: todo (aprueba lo de ESP).
  insert into core.prueba_permisos select pg_temp.id('ESP'), a, 'rrhh.planillas.' || c from unnest(array[
    'planilla.ver', 'planilla.generar', 'movimientos.ver', 'movimientos.crear', 'movimientos.eliminar',
    'conceptos.ver', 'conceptos.gestionar', 'declaraciones.generar', 'regimen.ver', 'parametros.ver',
    'vacaciones.ver', 'vacaciones.registrar']) c;
  insert into core.prueba_permisos values (pg_temp.id('ESP'), a, 'rrhh.asistencia.reportes.ver');
  insert into core.prueba_permisos select pg_temp.id('ADM'), a, code from core.permissions_catalog
    where code like 'rrhh.planillas.%' or code = 'rrhh.asistencia.reportes.ver';
  -- En la empresa B, ESP tiene todo: sirve para probar que no ve ni toca nada de A.
  insert into core.prueba_permisos select pg_temp.id('ESP'), b, code from core.permissions_catalog
    where code like 'rrhh.planillas.%' or code = 'rrhh.asistencia.reportes.ver';
  -- MOV: crea novedades pero no ve Asistencia. GES: solo ve el régimen (como el
  -- gestor de expedientes, sin salarios). COMP: régimen y compensación del contrato.
  insert into core.prueba_permisos values (pg_temp.id('MOV'), a, 'rrhh.planillas.movimientos.crear'),
    (pg_temp.id('GES'), a, 'rrhh.planillas.regimen.ver'),
    (pg_temp.id('COMP'), a, 'rrhh.planillas.regimen.ver'), (pg_temp.id('COMP'), a, 'rrhh.expedientes.compensacion.ver');

  insert into rrhh.jornadas (company_id, nombre) values (a, 'PRUEBA diurna') returning id into v_j;
  insert into rrhh.jornada_dias (jornada_id, company_id, dia_semana, laborable, hora_entrada, hora_salida, minutos_descanso)
  select v_j, a, d, d between 1 and 6, case when d between 1 and 6 then time '08:00' end,
         case when d between 1 and 6 then time '17:00' end, case when d between 1 and 6 then 60 else 0 end
  from generate_series(0, 6) d;
  insert into rrhh.departamentos (company_id) values (a) returning id into v_dep;
  insert into rrhh.puestos (company_id, departamento_id, nombre) values (a, v_dep, 'PRUEBA Bodega') returning id into v_pu;

  -- Mensuales laborales: L1 (G3, G4), L2 (G5, termina el 30 de septiembre), L5, L4 (entra en
  -- octubre) y LT (sobre el techo del INSS, termina el 30 de septiembre).
  -- Quincenales con jornada: L3 laboral y S1 servicios profesionales con prestaciones.
  -- S2 servicios profesionales sin prestaciones desde noviembre. SR semanal sin régimen.
  perform pg_temp.contrato('L1', 11350.00, 'mensual', date '2025-01-01');
  perform pg_temp.contrato('L2', 20000.00, 'mensual', date '2025-01-01', date '2026-09-30');
  perform pg_temp.contrato('L5', 15000.00, 'mensual', date '2025-01-01');
  perform pg_temp.contrato('L4', 12000.00, 'mensual', date '2026-10-01');
  perform pg_temp.contrato('LT', 150000.00, 'mensual', date '2025-01-01', date '2026-09-30');
  perform pg_temp.contrato('L3', 11350.00, 'quincenal', date '2025-01-01');
  perform pg_temp.contrato('S1', 11350.00, 'quincenal', date '2023-06-01');
  perform pg_temp.contrato('S2', 11350.00, 'quincenal', date '2026-11-01');
  perform pg_temp.contrato('SR', 11350.00, 'semanal', date '2026-01-05');
  update rrhh.contratos set puesto_id = v_pu where id = pg_temp.id('L1');
  insert into rrhh.contrato_jornadas (company_id, contrato_id, jornada_id, vigente_desde)
  select a, pg_temp.id(x), v_j, date '2023-06-01' from unnest(array['L3', 'S1']) x;

  perform pg_temp.como('ADM');
  foreach v_k in array array['L1', 'L2', 'L5', 'LT', 'L3'] loop
    perform public.planilla_regimen_cambiar(a, pg_temp.id(v_k), 'laboral', 'integral', 'tabla_progresiva', null,
      true, true, true, date '2025-01-01', 'PRUEBA régimen laboral');
  end loop;
  perform public.planilla_regimen_cambiar(a, pg_temp.id('L4'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2026-10-01', 'PRUEBA régimen laboral');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('S1'), 'servicios_profesionales', 'ninguno', 'exento', null,
    true, true, true, date '2023-06-01', 'PRUEBA igual que AG');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('S2'), 'servicios_profesionales', 'ninguno', 'exento', null,
    false, false, false, date '2026-11-01', 'PRUEBA sin prestaciones');

  perform pg_temp.como('ESP');
  v_t := public.planilla_tipo_guardar(a, null, 'PRUEBA mensual', 'ordinaria', 'mensual', null, true);
  insert into t_ids values ('TMEN', v_t);
  insert into t_ids select 'TQUI', id from rrhh.planilla_tipos where company_id = a and clase = 'ordinaria' and frecuencia = 'quincenal';
  insert into t_ids select 'TAGU', id from rrhh.planilla_tipos where company_id = a and clase = 'aguinaldo' and activo;
  if coalesce((select frecuencia from rrhh.planilla_tipos where id = v_t) <> 'mensual'
     or not exists (select 1 from core.audit_log where action = 'rrhh.planilla.tipo_creado' and entity_id = v_t::text)
     or pg_temp.id('TAGU') is null, true) then
    raise exception 'FALLO PL2: el tipo mensual no se creó con auditoría o falta el tipo Aguinaldo de PL2b';
  end if;
  -- El parámetro nuevo de la migración.
  if coalesce(rrhh.fn_planilla_parametro(a, 'horas_extra_fraccion_minutos', date '2026-10-15') <> 30
     or (select certeza from rrhh.parametros_ley where company_id = a and codigo = 'horas_extra_fraccion_minutos') <> 'verificar', true) then
    raise exception 'FALLO PL2: falta el parámetro de fracción de horas extra';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Planillas de septiembre (aprobadas por otra persona) y octubre (calculada)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v uuid;
begin
  perform pg_temp.como('ESP');
  perform public.planilla_novedad_crear(a, pg_temp.id('L2'), pg_temp.concepto('COMISION'), date '2026-09-10', null, 1000);
  v := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-09-01', date '2026-09-30');
  insert into t_ids values ('PM9', v);
  perform public.planilla_calcular(a, v);
  v := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-09-01', date '2026-09-15');
  insert into t_ids values ('Q1S', v);
  perform public.planilla_calcular(a, v);
  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, pg_temp.id('PM9'));
  perform public.planilla_aprobar(a, pg_temp.id('Q1S'));
  perform pg_temp.como('ESP');
  v := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-09-16', date '2026-09-30');
  insert into t_ids values ('Q2S', v);
  perform public.planilla_calcular(a, v);
  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, v);

  perform pg_temp.como('ESP');
  perform public.planilla_novedad_crear(a, pg_temp.id('L1'), pg_temp.concepto('BONO'), date '2026-10-10', null, 500);
  v := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-10-01', date '2026-10-31');
  insert into t_ids values ('PM10', v);
  perform public.planilla_calcular(a, v);
end;
$$;

-- -----------------------------------------------------------------------------
-- planilla_detalle
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v jsonb;
  r jsonb;
  l jsonb;
  v_n uuid;
begin
  perform pg_temp.como('ESP');
  v := public.planilla_detalle(a, pg_temp.id('PM9'));
  if coalesce(v->'planilla'->>'estado' <> 'aprobada' or v->'planilla'->>'tipo_nombre' <> 'PRUEBA mensual'
     or v->'planilla'->>'clase' <> 'ordinaria' or v->'planilla'->>'frecuencia' <> 'mensual'
     or (v->'planilla'->>'cambios_sin_calcular')::boolean or v->'planilla'->>'hash_aprobado' is null
     or (v->'planilla'->>'aprobada_por')::uuid <> pg_temp.id('ADM') or (v->'planilla'->>'calculada_por')::uuid <> pg_temp.id('ESP')
     or (v->'planilla'->'totales'->>'empleados')::integer <> 4
     or (v->'planilla'->>'generada_por')::uuid <> pg_temp.id('ESP') or (v->'planilla'->>'id')::uuid <> pg_temp.id('PM9')
     or not (v->'planilla' ?& array['pagada_por', 'motivo_anulacion', 'referencia_pago', 'metodo_pago', 'fecha_pago',
                                     'hash_insumos', 'periodo_inicio', 'periodo_fin', 'reemplaza_a', 'reemplazada_por']), true) then
    raise exception 'FALLO PL2: encabezado del detalle de septiembre';
  end if;
  if coalesce(v->'empresa'->>'nombre' <> 'PRUEBA Empresa A' or v->'empresa'->>'ruc' <> 'PRUEBA-RUC-prueba-a', true) then
    raise exception 'FALLO PL2: el detalle no trae nombre y RUC de la empresa';
  end if;
  if coalesce(jsonb_array_length(v->'renglones') <> 4, true) then
    raise exception 'FALLO PL2: el detalle de septiembre tiene % renglones en vez de 4', jsonb_array_length(v->'renglones');
  end if;
  r := pg_temp.renglon(v, pg_temp.id('L1'));
  if coalesce(r->>'empleado_nombre' <> 'PRUEBA L1' or (r->>'neto')::numeric <> 10222.17 or (r->>'devengado')::numeric <> 11350.00
     or (r->>'aportes')::numeric <> 2667.25 or (r->>'provisiones')::numeric <> 2837.49 or r->>'regimen' <> 'laboral'
     or (r->>'salario_diario')::numeric <> 378.3333 or (r->>'dias_pagados')::numeric <> 30, true) then
    raise exception 'FALLO PL2: renglón de L1 en el detalle, neto %', r->>'neto';
  end if;
  l := pg_temp.linea(r, 'INSS_LABORAL');
  if coalesce((l->>'monto')::numeric <> 794.50 or (l->>'base')::numeric <> 11350 or not (l->>'en_colilla')::boolean
     or l->>'articulo' <> 'Decreto 06-2019' or l->>'tipo' <> 'deduccion' or l->>'unidad' <> 'porcentaje'
     or l->>'origen' <> 'sistema', true) then
    raise exception 'FALLO PL2: línea de INSS laboral en el detalle';
  end if;
  if coalesce((pg_temp.linea(r, 'IR')->>'monto')::numeric <> 333.33 or (pg_temp.linea(r, 'INSS_PATRONAL')->>'monto')::numeric <> 2440.25, true) then
    raise exception 'FALLO PL2: IR o INSS patronal de L1 en el detalle';
  end if;
  r := pg_temp.renglon(v, pg_temp.id('L2'));
  if coalesce((r->>'neto')::numeric <> 17707.33 or (pg_temp.linea(r, 'COMISION')->>'monto')::numeric <> 1000
     or pg_temp.linea(r, 'COMISION')->>'origen' <> 'novedad'
     or (pg_temp.linea(r, 'IR')->>'monto')::numeric <> 1822.67, true) then
    raise exception 'FALLO PL2: renglón de L2 con comisión en el detalle, neto %', r->>'neto';
  end if;
  -- Sobre el techo: INSS sobre C$100,000.
  r := pg_temp.renglon(v, pg_temp.id('LT'));
  if coalesce((pg_temp.linea(r, 'INSS_LABORAL')->>'base')::numeric <> 100000 or (pg_temp.linea(r, 'INSS_LABORAL')->>'monto')::numeric <> 7000.00
     or (pg_temp.linea(r, 'IR')->>'monto')::numeric <> 37275.00 or (r->>'neto')::numeric <> 105725.00, true) then
    raise exception 'FALLO PL2: renglón de LT sobre el techo, neto %', r->>'neto';
  end if;

  -- Calculada: sin cambios, con una novedad nueva y después de anularla.
  v := public.planilla_detalle(a, pg_temp.id('PM10'));
  if coalesce(v->'planilla'->>'estado' <> 'calculada' or (v->'planilla'->>'cambios_sin_calcular')::boolean, true) then
    raise exception 'FALLO PL2: la planilla de octubre recién calculada marca cambios';
  end if;
  v_n := public.planilla_novedad_crear(a, pg_temp.id('L5'), pg_temp.concepto('BONO'), date '2026-10-12', null, 100);
  if coalesce(not (public.planilla_detalle(a, pg_temp.id('PM10'))->'planilla'->>'cambios_sin_calcular')::boolean, true) then
    raise exception 'FALLO PL2: el detalle no avisa de una novedad posterior al cálculo';
  end if;
  perform public.planilla_novedad_anular(a, v_n);
  if coalesce((public.planilla_detalle(a, pg_temp.id('PM10'))->'planilla'->>'cambios_sin_calcular')::boolean, true) then
    raise exception 'FALLO PL2: anular la novedad nueva no devolvió la huella calculada';
  end if;

  perform pg_temp.debe_fallar(format('select public.planilla_detalle(%L, %L)', pg_temp.id('B'), pg_temp.id('PM9')),
    'no encontrada', 'detalle de otra empresa');

  -- Septiembre queda pagada: las declaraciones toman aprobadas y pagadas.
  perform pg_temp.como('ADM');
  perform public.planilla_pagar(a, pg_temp.id('PM9'), 'cheque', 'PRUEBA cheques');
  if coalesce((select estado from rrhh.planillas where id = pg_temp.id('PM9')) <> 'pagada', true) then
    raise exception 'FALLO PL2: la planilla de septiembre no quedó pagada';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- planilla_comparar: octubre contra septiembre
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  x record;
  v_q uuid;
begin
  perform pg_temp.como('ESP');
  if coalesce((select count(*) from public.planilla_comparar(a, pg_temp.id('PM10'))) <> 5, true) then
    raise exception 'FALLO PL2: la comparación de octubre no tiene 5 filas';
  end if;
  select * into x from public.planilla_comparar(a, pg_temp.id('PM10')) c where c.contrato_id = pg_temp.id('L1');
  if coalesce(x.estado <> 'cambia' or x.devengado_actual <> 11850.00 or x.devengado_anterior <> 11350.00
     or x.neto_actual <> 10617.42 or x.neto_anterior <> 10222.17 or x.diferencia_neto <> 395.25
     or x.anterior_id <> pg_temp.id('PM9') or x.anterior_periodo_inicio <> date '2026-09-01'
     or x.anterior_periodo_fin <> date '2026-09-30' or x.empleado_nombre <> 'PRUEBA L1', true) then
    raise exception 'FALLO PL2: comparación de L1: % neto % diferencia %', x.estado, x.neto_actual, x.diferencia_neto;
  end if;
  select * into x from public.planilla_comparar(a, pg_temp.id('PM10')) c where c.contrato_id = pg_temp.id('L2');
  if coalesce(x.estado <> 'sale' or x.neto_actual is not null or x.neto_anterior <> 17707.33 or x.diferencia_neto <> -17707.33, true) then
    raise exception 'FALLO PL2: comparación de L2 que sale: %', x.estado;
  end if;
  select * into x from public.planilla_comparar(a, pg_temp.id('PM10')) c where c.contrato_id = pg_temp.id('L4');
  if coalesce(x.estado <> 'nuevo' or x.neto_actual <> 10736.00 or x.neto_anterior is not null or x.diferencia_neto <> 10736.00, true) then
    raise exception 'FALLO PL2: comparación de L4 que entra: % neto %', x.estado, x.neto_actual;
  end if;
  select * into x from public.planilla_comparar(a, pg_temp.id('PM10')) c where c.contrato_id = pg_temp.id('L5');
  if coalesce(x.estado <> 'igual' or x.diferencia_neto <> 0 or x.neto_actual <> 13107.50, true) then
    raise exception 'FALLO PL2: comparación de L5 igual: % neto %', x.estado, x.neto_actual;
  end if;

  -- Sin período anterior: todo nuevo y sin planilla anterior.
  if coalesce((select count(*) from public.planilla_comparar(a, pg_temp.id('PM9'))) <> 4
     or exists (select 1 from public.planilla_comparar(a, pg_temp.id('PM9')) c
                where c.estado <> 'nuevo' or c.anterior_id is not null or c.anterior_periodo_inicio is not null
                   or c.anterior_periodo_fin is not null), true) then
    raise exception 'FALLO PL2: la primera planilla no se compara como sin período anterior';
  end if;

  v_q := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-11-01', date '2026-11-30');
  perform pg_temp.debe_fallar(format('select * from public.planilla_comparar(%L, %L)', a, v_q), 'Calcula la planilla', 'comparar un borrador');
  perform pg_temp.debe_fallar(format('select * from public.planilla_comparar(%L, %L)', pg_temp.id('B'), pg_temp.id('PM10')),
    'no encontrada', 'comparar en otra empresa');
end;
$$;

-- -----------------------------------------------------------------------------
-- Declaraciones de septiembre: suma por persona de las planillas aprobadas y pagadas
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  x record;
begin
  perform pg_temp.como('ESP');
  create temp table t_dinss on commit drop as select * from public.planilla_declaracion_inss(a, date '2026-09-20');
  create temp table t_dinatec on commit drop as select * from public.planilla_declaracion_inatec(a, date '2026-09-01');
  create temp table t_dir on commit drop as select * from public.planilla_declaracion_ir(a, date '2026-09-30');

  -- INSS: L1, L2, L5, LT (mensual, pagada) y L3 (dos quincenas). S1 no cotiza.
  if coalesce((select count(*) from t_dinss) <> 5 or exists (select 1 from t_dinss where empleado_id = pg_temp.id('ES1')), true) then
    raise exception 'FALLO PL2: la declaración del INSS tiene % filas en vez de 5', (select count(*) from t_dinss);
  end if;
  select * into x from t_dinss where empleado_id = pg_temp.id('EL3');
  if coalesce(x.dias <> 30 or x.salario_inss <> 11350.00 or x.inss_laboral <> 794.50 or x.inss_patronal <> 2440.26
     or x.documento_identidad <> 'PRUEBA-L3' or x.numero_inss is not null or x.empleado_nombre <> 'PRUEBA L3', true) then
    raise exception 'FALLO PL2: INSS de L3 en dos quincenas: % días, % laboral, % patronal', x.dias, x.inss_laboral, x.inss_patronal;
  end if;
  select * into x from t_dinss where empleado_id = pg_temp.id('EL2');
  if coalesce(x.dias <> 30 or x.salario_inss <> 21000.00 or x.inss_laboral <> 1470.00 or x.inss_patronal <> 4515.00, true) then
    raise exception 'FALLO PL2: INSS de L2 con comisión: % laboral', x.inss_laboral;
  end if;
  -- Salario de C$150,000 sobre el techo: cotiza sobre C$100,000.
  select * into x from t_dinss where empleado_id = pg_temp.id('ELT');
  if coalesce(x.salario_inss <> 100000.00 or x.inss_laboral <> 7000.00 or x.inss_patronal <> 21500.00 or x.dias <> 30, true) then
    raise exception 'FALLO PL2: INSS topado de LT: salario %', x.salario_inss;
  end if;
  if coalesce((select sum(inss_laboral) from t_dinss) <> 11109.00 or (select sum(inss_patronal) from t_dinss) <> 34120.51, true) then
    raise exception 'FALLO PL2: totales del INSS: % laboral y % patronal',
      (select sum(inss_laboral) from t_dinss), (select sum(inss_patronal) from t_dinss);
  end if;

  -- INATEC: 2% de la planilla bruta que cotiza (sin techo).
  select * into x from t_dinatec;
  if coalesce((select count(*) from t_dinatec) <> 1 or x.base <> 208700.00 or x.tasa <> 0.02 or x.monto <> 4174.00 or x.empleados <> 5, true) then
    raise exception 'FALLO PL2: INATEC: base %, monto %, personas %', x.base, x.monto, x.empleados;
  end if;

  -- IR: una fila por persona y régimen; S1 aparece exento.
  if coalesce((select count(*) from t_dir) <> 6, true) then
    raise exception 'FALLO PL2: la declaración de IR tiene % filas en vez de 6', (select count(*) from t_dir);
  end if;
  select * into x from t_dir where empleado_id = pg_temp.id('EL2');
  if coalesce(x.renta_bruta <> 21000.00 or x.inss_laboral <> 1470.00 or x.renta_neta <> 19530.00 or x.ir_retenido <> 1822.67
     or x.regimen <> 'laboral', true) then
    raise exception 'FALLO PL2: IR de L2: % retenido', x.ir_retenido;
  end if;
  select * into x from t_dir where empleado_id = pg_temp.id('EL3');
  if coalesce(x.renta_bruta <> 11350.00 or x.renta_neta <> 10555.50 or x.ir_retenido <> 333.33, true) then
    raise exception 'FALLO PL2: IR de L3 en dos quincenas: % retenido', x.ir_retenido;
  end if;
  select * into x from t_dir where empleado_id = pg_temp.id('ELT');
  if coalesce(x.renta_bruta <> 150000.00 or x.inss_laboral <> 7000.00 or x.renta_neta <> 143000.00 or x.ir_retenido <> 37275.00, true) then
    raise exception 'FALLO PL2: IR de LT: % retenido', x.ir_retenido;
  end if;
  select * into x from t_dir where empleado_id = pg_temp.id('ES1');
  if coalesce(x.renta_bruta <> 11350.00 or x.inss_laboral <> 0 or x.ir_retenido <> 0 or x.regimen <> 'servicios_profesionales', true) then
    raise exception 'FALLO PL2: IR de servicios profesionales exento';
  end if;
  if coalesce((select sum(ir_retenido) from t_dir) <> 40606.83, true) then
    raise exception 'FALLO PL2: total de IR retenido %', (select sum(ir_retenido) from t_dir);
  end if;

  -- Octubre todavía no tiene planillas aprobadas.
  if coalesce(exists (select 1 from public.planilla_declaracion_inss(a, date '2026-10-01'))
     or exists (select 1 from public.planilla_declaracion_inatec(a, date '2026-10-01'))
     or exists (select 1 from public.planilla_declaracion_ir(a, date '2026-10-01')), true) then
    raise exception 'FALLO PL2: una declaración tomó una planilla calculada sin aprobar';
  end if;
  -- Empresa ajena: con todos los permisos en B no ve nada de A.
  if coalesce(exists (select 1 from public.planilla_declaracion_inss(pg_temp.id('B'), date '2026-09-01'))
     or exists (select 1 from public.planilla_declaracion_ir(pg_temp.id('B'), date '2026-09-01')), true) then
    raise exception 'FALLO PL2: la declaración de otra empresa devolvió filas';
  end if;
  perform pg_temp.debe_fallar(format('select * from public.planilla_declaracion_ir(%L, null)', a), 'Indica el mes', 'declaración sin mes');

  -- Auditoría de cada generación.
  if coalesce((select count(distinct metadata->>'declaracion') from core.audit_log
      where action = 'rrhh.planilla.declaracion_generada' and company_id = a) <> 3
     or not exists (select 1 from core.audit_log where action = 'rrhh.planilla.declaracion_generada' and company_id = a
                    and metadata->>'declaracion' = 'inss' and metadata->>'mes' = '2026-09' and (metadata->>'filas')::integer = 5), true) then
    raise exception 'FALLO PL2: falta la auditoría de las declaraciones';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Asistencia: propuesta e importación idempotente (1.ª quincena de octubre)
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_q uuid;
  x record;
  v_items jsonb;
  v_id uuid;
  v_vac uuid;
begin
  insert into rrhh.prueba_asistencia_dias (contrato_id, fecha, estado, minutos_sobre_jornada) values
    (pg_temp.id('S1'), date '2026-10-05', 'completo', 135),
    (pg_temp.id('S1'), date '2026-10-06', 'completo', 25),
    (pg_temp.id('S1'), date '2026-10-07', 'sin_marcas', null),
    (pg_temp.id('S1'), date '2026-10-08', 'falta_salida', null),
    (pg_temp.id('S1'), date '2026-10-09', 'sin_marcas', null),
    (pg_temp.id('S1'), date '2026-10-12', 'sin_marcas', null),
    (pg_temp.id('S1'), date '2026-10-20', 'completo', 60),
    (pg_temp.id('L3'), date '2026-10-05', 'completo', 240),
    (pg_temp.id('L3'), date '2026-10-06', 'completo', 180),
    (pg_temp.id('L3'), date '2026-10-07', 'completo', 180),
    (pg_temp.id('L1'), date '2026-10-05', 'completo', 120),
    (pg_temp.id('C0'), date '2026-10-05', 'completo', 300);

  -- Vacaciones de S1: el 9 aprobadas (registra ESP, aprueba ADM) y el 12 solo solicitadas.
  perform pg_temp.como('ESP');
  v_vac := public.planilla_vacaciones_registrar(a, pg_temp.id('S1'), 'goce', date '2026-10-09', date '2026-10-09', 1, null);
  perform pg_temp.como('ADM');
  perform public.planilla_vacaciones_aprobar(a, v_vac);
  perform pg_temp.como('ESP');
  v_vac := public.planilla_vacaciones_registrar(a, pg_temp.id('S1'), 'goce', date '2026-10-12', date '2026-10-12', 1, null);

  v_q := public.planilla_crear(a, pg_temp.id('TQUI'), date '2026-10-01', date '2026-10-15');
  insert into t_ids values ('Q1O', v_q);
  -- Una hora extra manual de S1 el día 5.
  perform public.planilla_novedad_crear(a, pg_temp.id('S1'), pg_temp.concepto('HORAS_EXTRA'), date '2026-10-05', 1, null);

  create temp table t_prop on commit drop as select * from public.planilla_asistencia_propuesta(a, v_q);
  if coalesce((select count(*) from t_prop) <> 6, true) then
    raise exception 'FALLO PL2: la propuesta tiene % filas en vez de 6', (select count(*) from t_prop);
  end if;
  select * into x from t_prop where contrato_id = pg_temp.id('L3') and fecha = date '2026-10-05';
  if coalesce(x.concepto_codigo <> 'HORAS_EXTRA' or x.cantidad <> 4 or x.ya_importada or x.empleado_nombre <> 'PRUEBA L3'
     or x.detalle not like '240 min sobre la jornada. Confirma que fueron autorizadas%' or x.detalle not like '%tope de 3 h por día%'
     or x.detalle not like '%La semana suma 10 h y supera el tope de 9 h%', true) then
    raise exception 'FALLO PL2: propuesta de L3 el 5: % h, %', x.cantidad, pg_temp.limpio(x.detalle);
  end if;
  select * into x from t_prop where contrato_id = pg_temp.id('L3') and fecha = date '2026-10-06';
  if coalesce(x.cantidad <> 3 or x.detalle not like '%semana suma 10 h%' or x.detalle like '%por día%', true) then
    raise exception 'FALLO PL2: propuesta de L3 el 6: %', pg_temp.limpio(x.detalle);
  end if;
  -- 135 min se redondean hacia abajo a 2 h; la hora manual cuenta para el tope y se avisa.
  select * into x from t_prop where contrato_id = pg_temp.id('S1') and fecha = date '2026-10-05';
  if coalesce(x.cantidad <> 2 or x.detalle not like '%Ya hay otra novedad%' or x.detalle like '%tope%', true) then
    raise exception 'FALLO PL2: propuesta de S1 el 5: % h, %', x.cantidad, pg_temp.limpio(x.detalle);
  end if;
  select * into x from t_prop where contrato_id = pg_temp.id('S1') and fecha = date '2026-10-07';
  if coalesce(x.concepto_codigo <> 'AUSENCIA' or x.cantidad <> 1 or x.detalle not like 'Día laborable sin marcas%'
     or x.detalle like '%vacaciones solicitadas%', true) then
    raise exception 'FALLO PL2: propuesta de ausencia de S1';
  end if;
  -- Vacaciones solicitadas: se propone con aviso. Aprobadas: no se propone.
  select * into x from t_prop where contrato_id = pg_temp.id('S1') and fecha = date '2026-10-12';
  if coalesce(x.concepto_codigo <> 'AUSENCIA' or x.detalle not like '%Hay vacaciones solicitadas ese día%', true) then
    raise exception 'FALLO PL2: la ausencia con vacaciones solicitadas no avisa';
  end if;
  if coalesce(exists (select 1 from t_prop where (contrato_id = pg_temp.id('S1') and fecha in ('2026-10-06', '2026-10-08', '2026-10-09', '2026-10-20'))
             or contrato_id in (pg_temp.id('L1'), pg_temp.id('C0'))), true) then
    raise exception 'FALLO PL2: la propuesta incluye días o contratos que no corresponden';
  end if;
  if coalesce((select contrato_id from public.planilla_asistencia_propuesta(a, v_q) limit 1) <> pg_temp.id('L3'), true) then
    raise exception 'FALLO PL2: la propuesta no viene ordenada por persona y fecha';
  end if;
  -- El día en curso y los siguientes no se proponen.
  if coalesce((select count(*) from rrhh.fn_planilla_asistencia_propuesta(a, v_q, date '2026-10-06')) <> 2, true) then
    raise exception 'FALLO PL2: la propuesta incluye el día en curso';
  end if;
  -- Al aprobar las vacaciones del 12, la ausencia sale de la propuesta.
  perform pg_temp.como('ADM');
  perform public.planilla_vacaciones_aprobar(a, v_vac);
  perform pg_temp.como('ESP');
  if coalesce((select count(*) from public.planilla_asistencia_propuesta(a, v_q)) <> 5
     or exists (select 1 from public.planilla_asistencia_propuesta(a, v_q) p where p.fecha = date '2026-10-12'), true) then
    raise exception 'FALLO PL2: una ausencia con vacaciones aprobadas sigue en la propuesta';
  end if;

  -- La fracción de horas extra sale del parámetro (se prueba con 45 min y se revierte).
  begin
    perform pg_temp.como('ADM');
    perform public.planilla_parametro_vigencia_nueva(a, 'horas_extra_fraccion_minutos', 45, date '2026-10-01', 'verificar', 'PRUEBA fraccion');
    perform pg_temp.como('ESP');
    if coalesce((select p.cantidad from public.planilla_asistencia_propuesta(a, v_q) p
        where p.contrato_id = pg_temp.id('S1') and p.fecha = date '2026-10-05') <> 2.25
       or (select p.cantidad from public.planilla_asistencia_propuesta(a, v_q) p
           where p.contrato_id = pg_temp.id('L3') and p.fecha = date '2026-10-05') <> 3.75, true) then
      raise exception 'FALLO PL2: la propuesta no usa la fracción del parámetro';
    end if;
    perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-05', 'HORAS_EXTRA', 2))),
      'fracciones de 45 minutos', 'importar horas fuera de la fracción del parámetro');
    raise exception 'PRUEBA revertir';
  exception when raise_exception then
    if sqlerrm <> 'PRUEBA revertir' then
      raise;
    end if;
  end;
  if coalesce(rrhh.fn_planilla_parametro(a, 'horas_extra_fraccion_minutos', date '2026-10-15') <> 30, true) then
    raise exception 'FALLO PL2: no se revirtió la prueba de la fracción';
  end if;

  -- Permisos: crear novedades y, además, ver los reportes de Asistencia.
  perform pg_temp.como('NADA');
  perform pg_temp.debe_negar(format('select * from public.planilla_asistencia_propuesta(%L, %L)', a, v_q),
    'rrhh.planillas.movimientos.crear', 'propuesta sin permiso');
  perform pg_temp.como('MOV');
  perform pg_temp.debe_negar(format('select * from public.planilla_asistencia_propuesta(%L, %L)', a, v_q),
    'rrhh.asistencia.reportes.ver', 'propuesta sin ver asistencia');
  perform pg_temp.debe_negar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))),
    'rrhh.asistencia.reportes.ver', 'importar sin ver asistencia');

  -- Validaciones de la importación (ninguna deja novedades).
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', '[]'::jsonb), 'entre 1 y 1000', 'importar vacío');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1)
    || '{"otra": 1}'::jsonb)), 'datos no válidos', 'importar con un campo desconocido');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'BONO', 1))),
    'datos no válidos', 'importar otro concepto');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(jsonb_build_object('contrato_id', pg_temp.id('S1'),
    'fecha', '2026-02-30', 'concepto_codigo', 'AUSENCIA', 'cantidad', 1))), 'no válidas', 'importar fecha imposible');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1),
    pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))), 'repetidas', 'importar filas repetidas');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-06', 'HORAS_EXTRA', 0.5))),
    'ya no está en la propuesta', 'importar algo que la asistencia no muestra');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('L3', date '2026-10-06', 'HORAS_EXTRA', 3.5))),
    'no son válidas', 'importar más horas que la asistencia');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-05', 'HORAS_EXTRA', 1.25))),
    'no son válidas', 'importar fracción que no es media hora');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 0.5))),
    'día completo', 'importar media ausencia');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-09', 'AUSENCIA', 1))),
    'vacaciones aprobadas', 'importar ausencia en vacaciones aprobadas');
  -- Tampoco a mano: una ausencia manual en un día de vacaciones aprobadas.
  perform pg_temp.debe_fallar(format('select public.planilla_novedad_crear(%L, %L, %L, %L, 1, null)', a, pg_temp.id('S1'),
    pg_temp.concepto('AUSENCIA'), '2026-10-09'), 'vacaciones aprobadas', 'ausencia manual en vacaciones aprobadas');
  -- Una novedad manual con la clave de una fila de asistencia no se presenta como importada.
  begin
    perform public.planilla_novedad_crear(a, pg_temp.id('S1'), pg_temp.concepto('AUSENCIA'), date '2026-10-07', 1, null, null, null,
      md5('asistencia:' || pg_temp.id('S1')::text || ':2026-10-07:AUSENCIA')::uuid);
    select * into x from public.planilla_asistencia_propuesta(a, v_q) p
    where p.contrato_id = pg_temp.id('S1') and p.fecha = date '2026-10-07';
    if coalesce(not x.ya_importada or x.detalle not like '%Ya hay una novedad manual con la clave de esta fila%'
       or x.detalle like '%Ya importada%', true) then
      raise exception 'FALLO PL2: la novedad manual con la clave de asistencia sale como importada: %', pg_temp.limpio(x.detalle);
    end if;
    raise exception 'PRUEBA revertir';
  exception when raise_exception then
    if sqlerrm <> 'PRUEBA revertir' then
      raise;
    end if;
  end;
  perform pg_temp.debe_fallar(pg_temp.importar_sql('B', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))),
    'no encontrada', 'importar en otra empresa');
  perform pg_temp.debe_fallar(format('select * from public.planilla_asistencia_propuesta(%L, %L)', pg_temp.id('B'), v_q),
    'no encontrada', 'propuesta de otra empresa');
  -- Otra ausencia ese día: no se descuentan dos días por una fecha.
  v_id := public.planilla_novedad_crear(a, pg_temp.id('S1'), pg_temp.concepto('AUSENCIA'), date '2026-10-07', 1, null);
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))),
    'Ya hay una ausencia registrada', 'importar una segunda ausencia el mismo día');
  perform public.planilla_novedad_anular(a, v_id);
  if coalesce(exists (select 1 from rrhh.novedades where origen = 'asistencia'), true) then
    raise exception 'FALLO PL2: una importación rechazada dejó novedades';
  end if;

  -- Importación: L3 con 3 h por día (dentro de los topes), S1 con 1 h y la ausencia.
  v_items := jsonb_build_array(
    pg_temp.item('L3', date '2026-10-05', 'HORAS_EXTRA', 3), pg_temp.item('L3', date '2026-10-06', 'HORAS_EXTRA', 3),
    pg_temp.item('L3', date '2026-10-07', 'HORAS_EXTRA', 3), pg_temp.item('S1', date '2026-10-05', 'HORAS_EXTRA', 1),
    pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1));
  if coalesce(public.planilla_asistencia_importar(a, v_q, v_items) <> 5, true) then
    raise exception 'FALLO PL2: la importación no creó 5 novedades';
  end if;
  if coalesce((select count(*) from rrhh.novedades where origen = 'asistencia' and planilla_tipo_id = pg_temp.id('TQUI')
        and estado = 'pendiente' and nota = 'Importada de asistencia' and creado_por = pg_temp.id('ESP')) <> 5
     or (select count(distinct lote) from rrhh.novedades where origen = 'asistencia') <> 1
     or (select cantidad from rrhh.novedades where contrato_id = pg_temp.id('L3') and fecha = '2026-10-05' and origen = 'asistencia') <> 3
     or not exists (select 1 from rrhh.novedades where contrato_id = pg_temp.id('L3') and fecha = '2026-10-05'
                    and clave_idempotencia = md5('asistencia:' || pg_temp.id('L3')::text || ':2026-10-05:HORAS_EXTRA')::uuid), true) then
    raise exception 'FALLO PL2: las novedades importadas no quedaron con origen, lote, clave y cantidad';
  end if;
  -- Vacaciones que se aprueban después de importar la ausencia: se rechaza hasta anular la ausencia.
  begin
    v_id := public.planilla_vacaciones_registrar(a, pg_temp.id('S1'), 'goce', date '2026-10-07', date '2026-10-07', 1, null);
    perform pg_temp.como('ADM');
    perform pg_temp.debe_fallar(format('select public.planilla_vacaciones_aprobar(%L, %L)', a, v_id),
      'Hay una ausencia registrada el 07/10/2026', 'aprobar vacaciones sobre una ausencia importada');
    raise exception 'PRUEBA revertir';
  exception when raise_exception then
    if sqlerrm <> 'PRUEBA revertir' then
      raise;
    end if;
  end;
  perform pg_temp.como('ESP');
  -- La hora manual de S1 sigue manual (no la toma la importación).
  if coalesce((select count(*) from rrhh.novedades where contrato_id = pg_temp.id('S1') and fecha = '2026-10-05' and origen = 'manual'
        and lote is null and estado <> 'anulada') <> 1, true) then
    raise exception 'FALLO PL2: la importación tocó la novedad manual';
  end if;
  -- Reintento con las mismas filas: ninguna nueva.
  if coalesce(public.planilla_asistencia_importar(a, v_q, v_items) <> 0 or (select count(*) from rrhh.novedades where origen = 'asistencia') <> 5, true) then
    raise exception 'FALLO PL2: reimportar duplicó novedades';
  end if;
  if coalesce(exists (select 1 from public.planilla_asistencia_propuesta(a, v_q) p where not p.ya_importada), true) then
    raise exception 'FALLO PL2: la propuesta no marca lo ya importado';
  end if;
  select * into x from public.planilla_asistencia_propuesta(a, v_q) p
  where p.contrato_id = pg_temp.id('L3') and p.fecha = date '2026-10-05';
  if coalesce(x.detalle not like '%Ya importada%' or x.detalle like '%tope%', true) then
    raise exception 'FALLO PL2: después de importar 9 h la propuesta sigue avisando del tope: %', pg_temp.limpio(x.detalle);
  end if;
  -- Una importada y anulada no se vuelve a crear.
  select id into v_id from rrhh.novedades where contrato_id = pg_temp.id('S1') and fecha = '2026-10-07' and origen = 'asistencia';
  perform public.planilla_novedad_anular(a, v_id);
  select * into x from public.planilla_asistencia_propuesta(a, v_q) p
  where p.contrato_id = pg_temp.id('S1') and p.fecha = date '2026-10-07';
  if coalesce(not x.ya_importada or x.detalle not like '%Ya importada y anulada%', true) then
    raise exception 'FALLO PL2: la propuesta no muestra la ausencia importada y anulada';
  end if;
  if coalesce(public.planilla_asistencia_importar(a, v_q, jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))) <> 0, true) then
    raise exception 'FALLO PL2: se volvió a crear una novedad importada y anulada';
  end if;
  if coalesce((select count(*) from core.audit_log where action = 'rrhh.planilla.asistencia_importada' and entity_id = v_q::text) <> 3, true) then
    raise exception 'FALLO PL2: falta la auditoría de las importaciones';
  end if;

  -- El motor toma lo importado: S1 2 h (1 manual + 1 importada), L3 9 h; la ausencia anulada no descuenta.
  perform public.planilla_calcular(a, v_q);
  if coalesce((select sum(monto) from rrhh.planilla_lineas where planilla_id = v_q and contrato_id = pg_temp.id('S1') and concepto_codigo = 'HORAS_EXTRA') <> 189.17
     or (select sum(monto) from rrhh.planilla_lineas where planilla_id = v_q and contrato_id = pg_temp.id('L3') and concepto_codigo = 'HORAS_EXTRA') <> 851.25
     or (select sum(monto) from rrhh.planilla_lineas where planilla_id = v_q and contrato_id = pg_temp.id('S1') and concepto_codigo = 'SALARIO') <> 5675.00, true) then
    raise exception 'FALLO PL2: el cálculo no tomó las novedades importadas';
  end if;

  -- Aprobada: ya no recibe novedades de Asistencia.
  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, v_q);
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format('select * from public.planilla_asistencia_propuesta(%L, %L)', a, v_q), 'aprobada', 'propuesta de una aprobada');
  perform pg_temp.debe_fallar(pg_temp.importar_sql('A', jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))),
    'aprobada', 'importar en una aprobada');
end;
$$;

-- -----------------------------------------------------------------------------
-- planilla_novedades_listado
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  x record;
begin
  perform pg_temp.como('ESP');
  -- 1.ª quincena de octubre: bono de L1, bono anulado de L5, hora manual de S1,
  -- ausencia manual anulada de S1 y 5 importadas.
  if coalesce((select count(*) from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15')) <> 9
     or (select count(*) from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15') n where n.origen = 'asistencia') <> 5, true) then
    raise exception 'FALLO PL2: el listado de novedades de octubre no tiene 9 filas';
  end if;
  if coalesce((select count(*) from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15', pg_temp.id('S1'))) <> 4, true) then
    raise exception 'FALLO PL2: el filtro por contrato del listado de novedades';
  end if;
  select * into x from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15') n
  where n.contrato_id = pg_temp.id('L1');
  if coalesce(x.concepto_codigo <> 'BONO' or x.monto <> 500 or x.estado <> 'aplicada' or x.planilla_id <> pg_temp.id('PM10')
     or x.planilla_estado <> 'calculada' or x.origen <> 'manual' or x.tipo <> 'devengado' or x.empleado_nombre <> 'PRUEBA L1'
     or x.concepto_metodo <> 'fijo', true) then
    raise exception 'FALLO PL2: fila del bono de L1 en el listado';
  end if;
  select * into x from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15') n
  where n.contrato_id = pg_temp.id('S1') and n.concepto_codigo = 'AUSENCIA' and n.origen = 'asistencia';
  if coalesce(x.estado <> 'anulada' or x.planilla_id is not null or x.cantidad <> 1 or x.concepto_metodo <> 'dias', true) then
    raise exception 'FALLO PL2: fila de la ausencia anulada en el listado';
  end if;
  if coalesce(exists (select 1 from public.planilla_novedades_listado(a, date '2026-10-01', date '2026-10-15') n
             where n.contrato_id = pg_temp.id('L3') and (n.planilla_estado <> 'aprobada' or n.estado <> 'aplicada')), true) then
    raise exception 'FALLO PL2: las horas importadas de L3 no aparecen aplicadas en la planilla aprobada';
  end if;
  perform pg_temp.debe_fallar(format($q$select * from public.planilla_novedades_listado(%L, '2026-10-15', '2026-10-01')$q$, a),
    'rango de fechas', 'listado con fechas al revés');
  perform pg_temp.debe_fallar(format($q$select * from public.planilla_novedades_listado(%L, '2025-01-01', '2026-10-01')$q$, a),
    'hasta un año', 'listado de más de un año');
  if coalesce(exists (select 1 from public.planilla_novedades_listado(pg_temp.id('B'), date '2026-09-01', date '2026-10-31')), true) then
    raise exception 'FALLO PL2: el listado de otra empresa devolvió novedades de A';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contratos para formularios, régimen y simulador de régimen
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  x record;
  v_msg text;
begin
  -- Opciones: cualquiera de los cinco permisos, sin salario.
  perform pg_temp.como('ESP');
  if coalesce((select count(*) from public.planilla_contratos_opciones(a)) <> 9, true) then
    raise exception 'FALLO PL2: las opciones de contratos no tienen 9 filas';
  end if;
  select * into x from public.planilla_contratos_opciones(a) o where o.contrato_id = pg_temp.id('L1');
  if coalesce(x.puesto <> 'PRUEBA Bodega' or x.frecuencia_pago <> 'mensual' or x.empleado_nombre <> 'PRUEBA L1' or x.estado <> 'activo', true) then
    raise exception 'FALLO PL2: opción de L1';
  end if;
  if coalesce((select o.estado from public.planilla_contratos_opciones(a) o where o.contrato_id = pg_temp.id('L2')) <> 'finalizado'
     or (select o.estado from public.planilla_contratos_opciones(a) o limit 1) <> 'activo', true) then
    raise exception 'FALLO PL2: estados u orden de las opciones de contratos';
  end if;
  if coalesce(pg_get_function_result('public.planilla_contratos_opciones(uuid)'::regprocedure) like '%salario%', true) then
    raise exception 'FALLO PL2: las opciones de contratos devuelven salario';
  end if;
  if coalesce((select count(*) from public.planilla_contratos_opciones(pg_temp.id('B'))) <> 1
     or (select o.contrato_id from public.planilla_contratos_opciones(pg_temp.id('B')) o) <> pg_temp.id('C0'), true) then
    raise exception 'FALLO PL2: las opciones de otra empresa';
  end if;
  perform pg_temp.como('GES');
  if coalesce((select count(*) from public.planilla_contratos_opciones(a)) <> 9, true) then
    raise exception 'FALLO PL2: regimen.ver no basta para las opciones de contratos';
  end if;
  perform pg_temp.como('NADA');
  begin
    perform public.planilla_contratos_opciones(a);
    raise exception 'FALLO PL2: las opciones de contratos aceptaron a un usuario sin permiso';
  exception when insufficient_privilege then
    v_msg := sqlerrm;
  end;
  if coalesce(v_msg not like '%rrhh.planillas.movimientos.crear%' or v_msg not like '%rrhh.planillas.vacaciones.registrar%'
     or v_msg not like '%rrhh.planillas.prestamos.gestionar%' or v_msg not like '%rrhh.planillas.liquidaciones.calcular%'
     or v_msg not like '%rrhh.planillas.regimen.ver%', true) then
    raise exception 'FALLO PL2: el mensaje de las opciones no nombra los cinco permisos';
  end if;

  -- Régimen por contrato. S2 tiene dos vigencias futuras: se muestra la más cercana.
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('S2'), 'laboral', 'integral', 'tabla_progresiva', null,
    true, true, true, date '2027-01-01', 'PRUEBA segunda vigencia futura');
  perform pg_temp.como('ESP');
  if coalesce((select count(*) from public.planilla_regimen_listado(a)) <> 9, true) then
    raise exception 'FALLO PL2: el listado de régimen no tiene 9 filas';
  end if;
  select * into x from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('S1');
  if coalesce(x.regimen <> 'servicios_profesionales' or x.metodo_ir <> 'exento' or not x.paga_aguinaldo or not x.tiene_aviso
     or x.aviso_descartado_en is not null or x.fecha_antiguedad <> date '2023-06-01' or x.motivo <> 'PRUEBA igual que AG', true) then
    raise exception 'FALLO PL2: régimen de S1 con aviso';
  end if;
  select * into x from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('L1');
  if coalesce(x.regimen <> 'laboral' or x.regimen_inss <> 'integral' or x.tiene_aviso or x.vigente_desde <> date '2025-01-01', true) then
    raise exception 'FALLO PL2: régimen de L1';
  end if;
  select * into x from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('SR');
  if coalesce(x.regimen is not null or x.regimen_id is not null or x.tiene_aviso, true) then
    raise exception 'FALLO PL2: contrato sin régimen en el listado';
  end if;
  select * into x from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('S2');
  if coalesce(x.regimen <> 'servicios_profesionales' or x.vigente_desde <> date '2026-11-01' or x.paga_vacaciones, true) then
    raise exception 'FALLO PL2: con dos vigencias futuras el listado no muestra la más cercana';
  end if;
  if coalesce((select r.estado_contrato from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('L2')) <> 'finalizado', true) then
    raise exception 'FALLO PL2: estado del contrato finalizado en el listado de régimen';
  end if;
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_aviso_descartar(a, pg_temp.id('S1'), 'PRUEBA revisado con el contador');
  perform pg_temp.como('ESP');
  select * into x from public.planilla_regimen_listado(a) r where r.contrato_id = pg_temp.id('S1');
  if coalesce(x.tiene_aviso or x.aviso_descartado_en is null, true) then
    raise exception 'FALLO PL2: el aviso descartado sigue en el listado de régimen';
  end if;
  if coalesce((select count(*) from public.planilla_regimen_listado(pg_temp.id('B'))) <> 1, true) then
    raise exception 'FALLO PL2: el listado de régimen de otra empresa';
  end if;

  -- Simulador al 15 de octubre de 2026 (parámetros vigentes; nada literal en la RPC).
  if coalesce((select count(*) from public.planilla_simular_regimen(a, date '2026-10-15')) <> 7, true) then
    raise exception 'FALLO PL2: el simulador no tiene 7 contratos activos';
  end if;
  select * into x from public.planilla_simular_regimen(a, date '2026-10-15') s where s.contrato_id = pg_temp.id('S1');
  if coalesce(x.salario_mensual <> 11350.00 or x.regimen_actual <> 'servicios_profesionales' or x.inss_patronal <> 2440.25
     or x.inatec <> 227.00 or x.provisiones_laboral <> 2837.49 or x.provisiones_servicios <> 2837.49
     or x.costo_laboral <> 16854.74 or x.costo_servicios <> 14187.49 or x.diferencia <> 2667.25, true) then
    raise exception 'FALLO PL2: simulador de S1: laboral %, servicios %, diferencia %', x.costo_laboral, x.costo_servicios, x.diferencia;
  end if;
  if coalesce(not ('Valor pendiente de confirmar con el contador: techo inss' = any (x.avisos))
     or not ('Valor pendiente de confirmar con el contador: provision indemnizacion divisor' = any (x.avisos))
     or not ('Valor pendiente de confirmar con el contador: inss patronal' = any (x.avisos)), true) then
    raise exception 'FALLO PL2: el simulador no avisa de los valores por confirmar';
  end if;
  select * into x from public.planilla_simular_regimen(a, date '2026-10-15') s where s.contrato_id = pg_temp.id('L1');
  if coalesce(x.regimen_actual <> 'laboral' or x.costo_servicios <> 14187.49 or x.diferencia <> 2667.25, true) then
    raise exception 'FALLO PL2: simulador de L1 laboral';
  end if;
  select * into x from public.planilla_simular_regimen(a, date '2026-10-15') s where s.contrato_id = pg_temp.id('L4');
  if coalesce(x.costo_laboral <> 17820.00 or x.diferencia <> 2820.00, true) then
    raise exception 'FALLO PL2: simulador de L4: laboral %', x.costo_laboral;
  end if;
  select * into x from public.planilla_simular_regimen(a, date '2026-10-15') s where s.contrato_id = pg_temp.id('S2');
  if coalesce(x.regimen_actual is not null or x.costo_servicios <> 11350.00 or x.diferencia <> 5504.74, true) then
    raise exception 'FALLO PL2: simulador de S2 antes de su régimen';
  end if;
  select * into x from public.planilla_simular_regimen(a, date '2026-11-15') s where s.contrato_id = pg_temp.id('S2');
  if coalesce(x.regimen_actual <> 'servicios_profesionales' or x.provisiones_servicios <> 0 or x.diferencia <> 5504.74, true) then
    raise exception 'FALLO PL2: simulador de S2 sin prestaciones';
  end if;
  if coalesce((select count(*) from public.planilla_simular_regimen(a)) <> 7, true) then
    raise exception 'FALLO PL2: el simulador sin fecha no usa hoy';
  end if;
  -- Solo régimen (gestor de expedientes): ve régimen y avisos, pero no salarios ni costos.
  perform pg_temp.como('GES');
  if coalesce((select count(*) from public.planilla_simular_regimen(a, date '2026-10-15')) <> 7
     or exists (select 1 from public.planilla_simular_regimen(a, date '2026-10-15') s
                where s.salario_mensual is not null or s.costo_laboral is not null or s.costo_servicios is not null
                   or s.diferencia is not null or s.inss_patronal is not null or s.inatec is not null
                   or s.provisiones_laboral is not null or s.provisiones_servicios is not null)
     or (select s.regimen_actual from public.planilla_simular_regimen(a, date '2026-10-15') s
         where s.contrato_id = pg_temp.id('S1')) <> 'servicios_profesionales'
     or (select cardinality(s.avisos) from public.planilla_simular_regimen(a, date '2026-10-15') s
         where s.contrato_id = pg_temp.id('S1')) = 0, true) then
    raise exception 'FALLO PL2: el simulador muestra salarios a quien solo ve el régimen';
  end if;
  -- Con la compensación del contrato sí los ve.
  perform pg_temp.como('COMP');
  if coalesce((select s.diferencia from public.planilla_simular_regimen(a, date '2026-10-15') s
      where s.contrato_id = pg_temp.id('S1')) <> 2667.25, true) then
    raise exception 'FALLO PL2: el simulador oculta montos a quien ve la compensación';
  end if;
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format($q$select * from public.planilla_simular_regimen(%L, '2025-06-01')$q$, a),
    'Falta el parámetro dias_mes_comercial', 'simulador sin parámetros vigentes');
  if coalesce((select count(*) from public.planilla_simular_regimen(pg_temp.id('B'), date '2026-10-15')) <> 1, true) then
    raise exception 'FALLO PL2: el simulador de otra empresa';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Diciembre: planilla mensual y aguinaldo aprobados. INSS e IR solo de la ordinaria
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_ag uuid;
  v uuid;
  x record;
begin
  -- El aguinaldo toma contratos de todas las frecuencias: SR necesita régimen.
  perform pg_temp.como('ADM');
  perform public.planilla_regimen_cambiar(a, pg_temp.id('SR'), 'servicios_profesionales', 'ninguno', 'exento', null,
    true, true, true, date '2026-01-05', 'PRUEBA régimen del semanal');
  perform pg_temp.como('ESP');
  v_ag := public.planilla_crear(a, pg_temp.id('TAGU'), date '2026-01-01', date '2026-12-31');
  perform public.planilla_calcular(a, v_ag);
  v := public.planilla_crear(a, pg_temp.id('TMEN'), date '2026-12-01', date '2026-12-31');
  insert into t_ids values ('PM12', v);
  perform public.planilla_calcular(a, v);
  perform pg_temp.como('ADM');
  perform public.planilla_aprobar(a, v_ag);
  perform public.planilla_aprobar(a, v);
  if coalesce(not exists (select 1 from rrhh.planilla_lineas where planilla_id = v_ag and contrato_id = pg_temp.id('L3')
                 and concepto_codigo = 'AGUINALDO' and monto > 0)
     or (select dias_pagados from rrhh.planilla_empleados where planilla_id = v_ag and contrato_id = pg_temp.id('L1')) <= 0, true) then
    raise exception 'FALLO PL2: la planilla de aguinaldo de prueba no tiene renglones';
  end if;

  perform pg_temp.como('ESP');
  create temp table t_d12inss on commit drop as select * from public.planilla_declaracion_inss(a, date '2026-12-01');
  create temp table t_d12ir on commit drop as select * from public.planilla_declaracion_ir(a, date '2026-12-01');
  -- Solo L1, L5 y L4 (mensual de diciembre); L3 y S1 solo tienen aguinaldo.
  if coalesce((select count(*) from t_d12inss) <> 3 or (select count(*) from t_d12ir) <> 3
     or exists (select 1 from t_d12inss where empleado_id in (pg_temp.id('EL3'), pg_temp.id('ES1'), pg_temp.id('ESR')))
     or exists (select 1 from t_d12ir where empleado_id in (pg_temp.id('EL3'), pg_temp.id('ES1'), pg_temp.id('ESR'))), true) then
    raise exception 'FALLO PL2: las declaraciones de diciembre toman la planilla de aguinaldo';
  end if;
  select * into x from t_d12inss where empleado_id = pg_temp.id('EL1');
  if coalesce(x.dias <> 30 or x.salario_inss <> 11350.00 or x.inss_laboral <> 794.50, true) then
    raise exception 'FALLO PL2: INSS de diciembre de L1 suma días del aguinaldo: % días', x.dias;
  end if;
  select * into x from t_d12ir where empleado_id = pg_temp.id('EL1');
  if coalesce(x.renta_bruta <> 11350.00 or x.ir_retenido <> 333.33, true) then
    raise exception 'FALLO PL2: IR de diciembre de L1 con aguinaldo: % de renta', x.renta_bruta;
  end if;
  select * into x from public.planilla_declaracion_inatec(a, date '2026-12-01');
  if coalesce(x.base <> 38350.00 or x.monto <> 767.00 or x.empleados <> 3, true) then
    raise exception 'FALLO PL2: INATEC de diciembre: base %', x.base;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Conceptos
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_id uuid;
  v_bono uuid := pg_temp.concepto('BONO');
  v_com uuid := pg_temp.concepto('COMISION');
  v_sal uuid := pg_temp.concepto('SALARIO');
  c rrhh.conceptos;
  v_sql text := 'select public.planilla_concepto_guardar(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)';
begin
  perform pg_temp.como('ESP');
  v_id := public.planilla_concepto_guardar(a, null, ' prueba_viatico ', 'PRUEBA Viático', 'devengado', 'fijo',
    false, false, false, false, false, false, true, true, 50, ' 5101 ', true);
  select * into c from rrhh.conceptos where id = v_id;
  if coalesce(c.codigo <> 'PRUEBA_VIATICO' or c.es_sistema or c.es_ordinario or c.cuenta_contable <> '5101' or not c.permite_novedad
     or c.company_id <> a or c.orden <> 50, true) then
    raise exception 'FALLO PL2: el concepto nuevo no quedó como se pidió';
  end if;
  if coalesce(not exists (select 1 from core.audit_log where action = 'rrhh.planilla.concepto_creado' and entity_id = v_id::text), true) then
    raise exception 'FALLO PL2: falta la auditoría del concepto nuevo';
  end if;

  perform pg_temp.debe_fallar(format(v_sql, a, null, 'MAL CODIGO', 'PRUEBA', 'devengado', 'fijo', false, false, false, false, false,
    false, true, true, 50, null, true), 'mayúsculas', 'código con espacios');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'BONO', 'PRUEBA', 'devengado', 'fijo', false, false, false, false, false,
    false, true, true, 50, null, true), 'Ya existe un concepto', 'código repetido');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA_HORAS', 'PRUEBA', 'devengado', 'horas', false, false, false, false, false,
    false, true, true, 50, null, true), 'monto fijo', 'concepto propio por horas');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA_PROV', 'PRUEBA', 'provision', 'fijo', false, false, false, false, false,
    false, true, false, 50, null, true), 'monto fijo', 'concepto propio de provisión');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA_DED', 'PRUEBA', 'deduccion', 'fijo', false, true, false, false, false,
    false, true, true, 50, null, true), 'Una deducción no afecta', 'deducción que afecta IR');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA_ORDEN', 'PRUEBA', 'devengado', 'fijo', false, false, false, false, false,
    false, true, true, 0, null, true), 'El orden', 'orden fuera de rango');
  perform pg_temp.debe_fallar(format(v_sql, pg_temp.id('B'), v_id, 'PRUEBA_VIATICO', 'PRUEBA', 'devengado', 'fijo', false, false, false,
    false, false, false, true, true, 50, null, true), 'Concepto no encontrado', 'editar un concepto de otra empresa');

  -- Conceptos del sistema: solo nombre, colilla y cuenta contable.
  perform public.planilla_concepto_guardar(a, v_sal, 'SALARIO', 'PRUEBA Salario', 'devengado', 'sistema',
    true, true, true, true, true, true, false, false, 10, '5001', true);
  select * into c from rrhh.conceptos where id = v_sal;
  if coalesce(c.nombre <> 'PRUEBA Salario' or c.en_colilla or c.cuenta_contable <> '5001' or not c.afecta_ir, true) then
    raise exception 'FALLO PL2: no se pudo cambiar el nombre de un concepto del sistema';
  end if;
  perform pg_temp.debe_fallar(format(v_sql, a, v_sal, 'SALARIO', 'PRUEBA Salario', 'devengado', 'sistema', true, false, true,
    true, true, true, false, false, 10, '5001', true), 'En un concepto del sistema solo cambian', 'cambiar reglas de un concepto del sistema');
  perform pg_temp.debe_fallar(format(v_sql, a, v_sal, 'SALARIO', 'PRUEBA Salario', 'devengado', 'sistema', true, true, true,
    true, true, true, false, false, 11, '5001', true), 'En un concepto del sistema solo cambian', 'cambiar el orden de un concepto del sistema');
  perform pg_temp.debe_fallar(format(v_sql, a, pg_temp.concepto('ADELANTO'), 'ADELANTO', 'Adelanto salarial', 'devengado', 'fijo',
    false, false, false, false, false, false, true, true, 200, null, true), 'En un concepto del sistema solo cambian',
    'pasar ADELANTO a devengado');

  -- COMISION está en la planilla pagada de septiembre: sus reglas no cambian; lo demás sí.
  perform pg_temp.debe_fallar(format(v_sql, a, v_com, 'COMISION', 'Comisiones', 'devengado', 'fijo', false, true, true, false, false,
    false, true, true, 30, null, true), 'ya se usó en una planilla aprobada', 'cambiar reglas de un concepto aprobado');
  perform public.planilla_concepto_guardar(a, v_com, 'COMISION', 'PRUEBA Comisiones', 'devengado', 'fijo',
    true, true, true, false, false, false, false, true, 31, '5102', true);
  select * into c from rrhh.conceptos where id = v_com;
  if coalesce(c.nombre <> 'PRUEBA Comisiones' or c.orden <> 31 or c.en_colilla or c.cuenta_contable <> '5102' or not c.afecta_inss, true) then
    raise exception 'FALLO PL2: no se pudo cambiar lo editable de un concepto aprobado';
  end if;
  perform pg_temp.debe_fallar(format(v_sql, a, v_com, 'COMISIONES', 'PRUEBA Comisiones', 'devengado', 'fijo', true, true, true, false,
    false, false, false, true, 31, '5102', true), 'ya usado no cambia', 'cambiar el código de un concepto usado');
  -- Un concepto sin uso sí cambia de código.
  perform public.planilla_concepto_guardar(a, v_id, 'PRUEBA_VIATICOS', 'PRUEBA Viáticos', 'devengado', 'fijo',
    false, false, false, false, false, false, true, true, 50, null, false);
  if coalesce((select codigo from rrhh.conceptos where id = v_id) <> 'PRUEBA_VIATICOS' or (select activo from rrhh.conceptos where id = v_id), true) then
    raise exception 'FALLO PL2: el concepto sin uso no cambió de código';
  end if;

  -- BONO solo está en la planilla calculada de octubre: cambiar sus reglas obliga a recalcular.
  perform public.planilla_concepto_guardar(a, v_bono, 'BONO', 'Bono', 'devengado', 'fijo',
    true, false, true, false, false, false, true, true, 40, null, true);
  if coalesce(not (public.planilla_detalle(a, pg_temp.id('PM10'))->'planilla'->>'cambios_sin_calcular')::boolean, true) then
    raise exception 'FALLO PL2: cambiar las reglas de un concepto no marcó la planilla calculada';
  end if;
  if coalesce(not exists (select 1 from core.audit_log where action = 'rrhh.planilla.concepto_editado' and entity_id = v_bono::text
                 and (metadata->>'planillas_por_recalcular')::integer = 1), true) then
    raise exception 'FALLO PL2: la auditoría del concepto no cuenta las planillas por recalcular';
  end if;
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format('select public.planilla_aprobar(%L, %L)', a, pg_temp.id('PM10')), 'Hubo cambios',
    'aprobar con un concepto cambiado');
  perform pg_temp.como('ESP');
  perform public.planilla_concepto_guardar(a, v_bono, 'BONO', 'Bono', 'devengado', 'fijo',
    true, true, true, false, false, false, true, true, 40, null, true);
  perform public.planilla_calcular(a, pg_temp.id('PM10'));
  if coalesce((public.planilla_detalle(a, pg_temp.id('PM10'))->'planilla'->>'cambios_sin_calcular')::boolean
     or (select sum(monto) from rrhh.planilla_lineas where planilla_id = pg_temp.id('PM10') and contrato_id = pg_temp.id('L1')
         and concepto_codigo = 'IR') <> 403.08, true) then
    raise exception 'FALLO PL2: recalcular después de restaurar el concepto';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tipos de planilla
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_id uuid;
  v_sql text := 'select public.planilla_tipo_guardar(%L, %L, %L, %L, %L, %L, %L)';
begin
  perform pg_temp.como('ESP');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA mensual dos', 'ordinaria', 'mensual', null, true),
    'Ya hay un tipo activo', 'segundo tipo mensual activo');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA mensual', 'ordinaria', 'semanal', null, true),
    'Ya existe un tipo de planilla con ese nombre', 'nombre de tipo repetido');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA aguinaldo mal', 'aguinaldo', 'mensual', null, true),
    'aguinaldo es anual', 'aguinaldo mensual');
  perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA anual', 'ordinaria', 'anual', null, true),
    'ordinaria es mensual', 'ordinaria anual');
  perform pg_temp.debe_fallar(format(v_sql, a, pg_temp.id('TQUI'), 'Planilla quincenal', 'ordinaria', 'mensual', null, true),
    'no cambia de clase ni de frecuencia', 'cambiar la frecuencia de un tipo con planillas');
  -- La clase no cambia nunca: ni el Aguinaldo pasa a ordinario ni al revés.
  perform pg_temp.debe_fallar(format(v_sql, a, pg_temp.id('TAGU'), 'Aguinaldo', 'ordinaria', 'mensual', null, false),
    'La clase de un tipo de planilla no cambia', 'cambiar la clase del tipo Aguinaldo');
  perform pg_temp.debe_fallar(format(v_sql, a, pg_temp.id('TQUI'), 'Planilla quincenal', 'aguinaldo', 'anual', null, false),
    'La clase de un tipo de planilla no cambia', 'pasar un tipo ordinario a aguinaldo');
  perform pg_temp.debe_fallar(format(v_sql, pg_temp.id('B'), pg_temp.id('TMEN'), 'PRUEBA mensual', 'ordinaria', 'mensual', null, true),
    'Tipo de planilla no encontrado', 'editar un tipo de otra empresa');

  perform public.planilla_tipo_guardar(a, pg_temp.id('TQUI'), 'PRUEBA quincenal', 'ordinaria', 'quincenal', ' PRUEBA Sala ', true);
  if coalesce((select nombre from rrhh.planilla_tipos where id = pg_temp.id('TQUI')) <> 'PRUEBA quincenal'
     or (select centro_costo from rrhh.planilla_tipos where id = pg_temp.id('TQUI')) <> 'PRUEBA Sala', true) then
    raise exception 'FALLO PL2: no se pudo renombrar un tipo con planillas';
  end if;
  v_id := public.planilla_tipo_guardar(a, null, 'PRUEBA semanal', 'ordinaria', 'semanal', null, true);
  perform pg_temp.debe_fallar(format(v_sql, a, v_id, 'PRUEBA semanal', 'ordinaria', 'mensual', null, true),
    'Ya hay un tipo activo', 'activar un segundo mensual al editar');
  perform public.planilla_tipo_guardar(a, v_id, 'PRUEBA semanal', 'ordinaria', 'mensual', null, false);
  if coalesce((select frecuencia from rrhh.planilla_tipos where id = v_id) <> 'mensual' or (select activo from rrhh.planilla_tipos where id = v_id), true) then
    raise exception 'FALLO PL2: un tipo sin planillas no cambió de frecuencia';
  end if;
  -- Aguinaldo anual: se crea si no hay uno activo; con el de PL2b activo, el segundo se rechaza.
  if exists (select 1 from rrhh.planilla_tipos where company_id = a and clase = 'aguinaldo' and activo) then
    perform pg_temp.debe_fallar(format(v_sql, a, null, 'PRUEBA aguinaldo', 'aguinaldo', 'anual', null, true),
      'Ya hay un tipo activo', 'segundo tipo de aguinaldo activo');
  else
    perform public.planilla_tipo_guardar(a, null, 'PRUEBA aguinaldo', 'aguinaldo', 'anual', null, true);
    if coalesce(not exists (select 1 from rrhh.planilla_tipos where company_id = a and nombre = 'PRUEBA aguinaldo'
                   and clase = 'aguinaldo' and frecuencia = 'anual' and activo), true) then
      raise exception 'FALLO PL2: no se creó el tipo de aguinaldo';
    end if;
  end if;
  if coalesce((select count(*) from core.audit_log where action = 'rrhh.planilla.tipo_editado' and company_id = a) <> 2, true) then
    raise exception 'FALLO PL2: falta la auditoría de los tipos editados';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabla de IR con vigencia
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  v_ok jsonb := '[{"desde": 0, "hasta": 150000, "impuesto_base": 0, "porcentaje": 0, "sobre_exceso": 0},
                  {"desde": 150000.01, "hasta": 300000, "impuesto_base": 0, "porcentaje": 0.15, "sobre_exceso": 150000},
                  {"desde": 300000.01, "hasta": null, "impuesto_base": 22500, "porcentaje": 0.25, "sobre_exceso": 300000}]';
  v_ok2 jsonb := '[{"desde": 0, "hasta": 120000, "impuesto_base": 0, "porcentaje": 0, "sobre_exceso": 0},
                   {"desde": 120000.01, "hasta": 240000, "impuesto_base": 0, "porcentaje": 0.10, "sobre_exceso": 120000},
                   {"desde": 240000.01, "hasta": null, "impuesto_base": 12000, "porcentaje": 0.20, "sobre_exceso": 240000}]';
  -- La tabla de la DGI que cargó PL2a: cumple las reglas de continuidad.
  v_dgi jsonb := '[{"desde": 0, "hasta": 100000, "impuesto_base": 0, "porcentaje": 0, "sobre_exceso": 0},
                   {"desde": 100000.01, "hasta": 200000, "impuesto_base": 0, "porcentaje": 0.15, "sobre_exceso": 100000},
                   {"desde": 200000.01, "hasta": 350000, "impuesto_base": 15000, "porcentaje": 0.20, "sobre_exceso": 200000},
                   {"desde": 350000.01, "hasta": 500000, "impuesto_base": 45000, "porcentaje": 0.25, "sobre_exceso": 350000},
                   {"desde": 500000.01, "hasta": null, "impuesto_base": 82500, "porcentaje": 0.30, "sobre_exceso": 500000}]';
  v_sql text := 'select public.planilla_ir_tabla_nueva(%L, %L, %L::jsonb, %L, %L)';
  v_pf uuid;
begin
  perform pg_temp.como('ESP');
  perform pg_temp.debe_negar(format(v_sql, a, '2027-01-01', v_ok::text, 'oficial', 'PRUEBA DGI'),
    'rrhh.planillas.parametros.editar', 'tabla de IR sin permiso');

  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,desde}', '150001')::text, 'oficial', 'PRUEBA DGI'),
    'contiguos', 'tramos con hueco');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{0,hasta}', 'null')::text, 'oficial', 'PRUEBA DGI'),
    'Solo el último tramo', 'dos tramos sin límite');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{2,hasta}', '900000')::text, 'oficial', 'PRUEBA DGI'),
    'El último tramo va sin límite', 'último tramo con límite');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{0,desde}', '1')::text, 'oficial', 'PRUEBA DGI'),
    'empieza en 0', 'primer tramo que no empieza en cero');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,porcentaje}', '1.5')::text, 'oficial', 'PRUEBA DGI'),
    'va de 0 a 1', 'porcentaje mayor que uno');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,impuesto_base}', '0.001')::text, 'oficial', 'PRUEBA DGI'),
    'hasta 2 decimales', 'monto con tres decimales');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{0,sobre_exceso}', '1')::text, 'oficial', 'PRUEBA DGI'),
    'En el primer tramo', 'exceso del primer tramo mayor que su inicio');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{0,impuesto_base}', '5000')::text, 'oficial', 'PRUEBA DGI'),
    'el impuesto base es 0', 'impuesto base en el primer tramo');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,sobre_exceso}', '149000')::text, 'oficial', 'PRUEBA DGI'),
    'el exceso se calcula sobre', 'exceso distinto del límite anterior');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{2,impuesto_base}', '22000')::text, 'oficial', 'PRUEBA DGI'),
    'el impuesto base debe ser 22500', 'salto de impuesto entre tramos');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,porcentaje}', '"0.15"')::text, 'oficial', 'PRUEBA DGI'),
    'en números', 'porcentaje como texto');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', jsonb_set(v_ok, '{1,tope}', '1')::text, 'oficial', 'PRUEBA DGI'),
    'Cada tramo lleva', 'tramo con un campo desconocido');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', v_ok::text, 'segura', 'PRUEBA DGI'), 'grado de certeza', 'certeza no válida');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-01-01', v_ok::text, 'oficial', 'x'), 'fuente', 'sin fuente');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-02-10', v_ok::text, 'oficial', 'PRUEBA DGI'), 'día 1 o el 16', 'vigencia a mitad de período');
  perform pg_temp.debe_fallar(format(v_sql, a, '2015-01-01', v_ok::text, 'oficial', 'PRUEBA DGI'), 'ya está vigente', 'reemplazar la tabla vigente');
  perform pg_temp.debe_fallar(format(v_sql, a, '2026-09-16', v_ok::text, 'oficial', 'PRUEBA DGI'), 'planillas aprobadas',
    'vigencia antes de una planilla aprobada');

  -- T1 desde febrero de 2027; una planilla calculada la usa y ya no se reemplaza.
  if coalesce(public.planilla_ir_tabla_nueva(a, date '2027-02-01', v_ok, 'oficial', 'PRUEBA DGI 2027') <> 3, true) then
    raise exception 'FALLO PL2: la tabla de febrero no creó 3 tramos';
  end if;
  if coalesce((select count(*) from rrhh.ir_tramos where company_id = a and vigente_desde = '2015-01-01' and vigente_hasta = '2027-01-31') <> 5, true) then
    raise exception 'FALLO PL2: la tabla anterior no se cerró el día antes';
  end if;
  perform pg_temp.como('ESP');
  v_pf := public.planilla_crear(a, pg_temp.id('TMEN'), date '2027-02-01', date '2027-02-28');
  perform public.planilla_calcular(a, v_pf);
  perform pg_temp.como('ADM');
  perform pg_temp.debe_fallar(format(v_sql, a, '2027-02-01', v_ok2::text, 'oficial', 'PRUEBA DGI'), 'ya se usó',
    'reemplazar una tabla usada por una planilla calculada');
  -- T2 desde marzo y su reemplazo T3 (futura y sin uso).
  if coalesce(public.planilla_ir_tabla_nueva(a, date '2027-03-01', v_ok, 'oficial', 'PRUEBA tabla dos') <> 3
     or public.planilla_ir_tabla_nueva(a, date '2027-03-01', v_ok, 'oficial', 'PRUEBA tabla tres') <> 3, true) then
    raise exception 'FALLO PL2: no se pudo crear o reemplazar la tabla de marzo';
  end if;
  if coalesce((select count(*) from rrhh.ir_tramos where company_id = a and vigente_desde = '2027-03-01') <> 3
     or not exists (select 1 from core.audit_log where action = 'rrhh.planilla.ir_tabla_nueva' and company_id = a
                    and metadata->>'fuente' = 'PRUEBA tabla tres' and jsonb_array_length(metadata->'reemplaza') = 3), true) then
    raise exception 'FALLO PL2: el reemplazo de una tabla futura no quedó auditado o duplicó tramos';
  end if;
  -- T4 desde el 16 de febrero reemplaza la de marzo y corta la de febrero el 15.
  if coalesce(public.planilla_ir_tabla_nueva(a, date '2027-02-16', v_ok2, 'verificar', 'PRUEBA tabla cuatro') <> 3, true) then
    raise exception 'FALLO PL2: la tabla del 16 de febrero no creó 3 tramos';
  end if;
  if coalesce((select count(*) from rrhh.ir_tramos where company_id = a) <> 11
     or (select count(*) from rrhh.ir_tramos where company_id = a and vigente_desde = '2027-02-01' and vigente_hasta = '2027-02-15') <> 3
     or exists (select 1 from rrhh.ir_tramos where company_id = a and vigente_desde = '2027-03-01')
     or (select count(*) from rrhh.ir_tramos where company_id = a and vigente_hasta is null and hasta is null) <> 1, true) then
    raise exception 'FALLO PL2: las vigencias de IR no quedaron contiguas';
  end if;
  if coalesce(rrhh.fn_planilla_ir_anual(a, 200000, date '2027-02-20') <> 8000.00 or rrhh.fn_planilla_ir_anual(a, 200000, date '2027-02-10') <> 7500.00
     or rrhh.fn_planilla_ir_anual(a, 200000, date '2026-12-31') <> 15000.00, true) then
    raise exception 'FALLO PL2: el IR no usa la tabla de su vigencia';
  end if;
  -- La planilla calculada de febrero queda para volver a calcular.
  perform pg_temp.como('ESP');
  if coalesce(not (public.planilla_detalle(a, v_pf)->'planilla'->>'cambios_sin_calcular')::boolean, true) then
    raise exception 'FALLO PL2: la planilla calculada no se enteró de la tabla de IR nueva';
  end if;
  if coalesce(not exists (select 1 from core.audit_log where action = 'rrhh.planilla.ir_tabla_nueva' and company_id = a
                 and metadata->>'certeza' = 'oficial' and metadata->>'fuente' = 'PRUEBA DGI 2027'
                 and (metadata->>'anterior_desde')::date = '2015-01-01'), true) then
    raise exception 'FALLO PL2: la auditoría de la tabla de IR no guarda certeza y fuente';
  end if;

  -- Otra empresa: carga la tabla de la DGI tal cual y no toca la de A.
  if coalesce(public.planilla_ir_tabla_nueva(pg_temp.id('B'), date '2027-06-01', v_dgi, 'oficial', 'PRUEBA empresa B') <> 5
     or exists (select 1 from rrhh.ir_tramos where company_id = a and vigente_desde = '2027-06-01')
     or (select count(*) from rrhh.ir_tramos where company_id = a) <> 11, true) then
    raise exception 'FALLO PL2: la tabla de IR de otra empresa tocó la de A';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos con el código exacto, sin sesión, privilegios y auditoría
-- -----------------------------------------------------------------------------
do $$
declare
  a uuid := pg_temp.id('A');
  x record;
  v_items text := jsonb_build_array(pg_temp.item('S1', date '2026-10-07', 'AUSENCIA', 1))::text;
  v_f text;
begin
  for x in select * from (values
    (format('select public.planilla_detalle(%L, %L)', a, pg_temp.id('PM9')), 'rrhh.planillas.planilla.ver'),
    (format('select * from public.planilla_comparar(%L, %L)', a, pg_temp.id('PM10')), 'rrhh.planillas.planilla.ver'),
    (format('select * from public.planilla_contratos_opciones(%L)', a), 'rrhh.planillas.movimientos.crear'),
    (format($q$select * from public.planilla_novedades_listado(%L, '2026-10-01', '2026-10-15')$q$, a), 'rrhh.planillas.movimientos.ver'),
    (format('select * from public.planilla_regimen_listado(%L)', a), 'rrhh.planillas.regimen.ver'),
    (format('select * from public.planilla_simular_regimen(%L)', a), 'rrhh.planillas.regimen.ver'),
    (format($q$select public.planilla_concepto_guardar(%L, null, 'PRUEBA_X', 'PRUEBA', 'devengado', 'fijo', false, false, false, false, false, false, true, true, 50, null, true)$q$, a),
     'rrhh.planillas.conceptos.gestionar'),
    (format($q$select public.planilla_tipo_guardar(%L, null, 'PRUEBA X', 'ordinaria', 'semanal', null, false)$q$, a), 'rrhh.planillas.conceptos.gestionar'),
    (format($q$select public.planilla_ir_tabla_nueva(%L, '2028-01-01', '[]'::jsonb, 'oficial', 'PRUEBA')$q$, a), 'rrhh.planillas.parametros.editar'),
    (format($q$select * from public.planilla_declaracion_inss(%L, '2026-09-01')$q$, a), 'rrhh.planillas.declaraciones.generar'),
    (format($q$select * from public.planilla_declaracion_inatec(%L, '2026-09-01')$q$, a), 'rrhh.planillas.declaraciones.generar'),
    (format($q$select * from public.planilla_declaracion_ir(%L, '2026-09-01')$q$, a), 'rrhh.planillas.declaraciones.generar'),
    (format('select * from public.planilla_asistencia_propuesta(%L, %L)', a, pg_temp.id('Q1O')), 'rrhh.planillas.movimientos.crear'),
    (format('select public.planilla_asistencia_importar(%L, %L, %L::jsonb)', a, pg_temp.id('Q1O'), v_items), 'rrhh.planillas.movimientos.crear')
  ) as v(sentencia, codigo) loop
    perform pg_temp.como('NADA');
    perform pg_temp.debe_negar(x.sentencia, x.codigo, 'una RPC de PL2c');
    -- Sin sesión también se niega.
    perform pg_temp.como('');
    begin
      execute x.sentencia;
      raise exception 'FALLO PL2: una RPC de PL2c aceptó una llamada sin sesión';
    exception when insufficient_privilege then null;
    end;
  end loop;
  -- Un permiso cercano no basta.
  perform pg_temp.como('GES');
  perform pg_temp.debe_negar(format('select public.planilla_detalle(%L, %L)', a, pg_temp.id('PM9')), 'rrhh.planillas.planilla.ver',
    'detalle con solo régimen');

  -- Privilegios: authenticated ejecuta las públicas; anon nada; el núcleo, nadie de la API.
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
    if coalesce(has_function_privilege('anon', v_f, 'EXECUTE') or not has_function_privilege('authenticated', v_f, 'EXECUTE'), true) then
      raise exception 'FALLO PL2: privilegios incorrectos en una RPC de PL2c';
    end if;
  end loop;
  if coalesce(has_function_privilege('authenticated', 'rrhh.fn_planilla_asistencia_propuesta(uuid,uuid,date)', 'EXECUTE')
     or has_function_privilege('anon', 'rrhh.fn_planilla_asistencia_propuesta(uuid,uuid,date)', 'EXECUTE'), true) then
    raise exception 'FALLO PL2: el núcleo de la propuesta es ejecutable por la API';
  end if;
  -- PL2c no da escritura directa sobre las tablas que configura.
  if coalesce(has_table_privilege('authenticated', 'rrhh.conceptos', 'INSERT') or has_table_privilege('authenticated', 'rrhh.conceptos', 'UPDATE')
     or has_table_privilege('authenticated', 'rrhh.planilla_tipos', 'UPDATE') or has_table_privilege('authenticated', 'rrhh.ir_tramos', 'INSERT')
     or has_table_privilege('authenticated', 'rrhh.ir_tramos', 'DELETE') or has_table_privilege('authenticated', 'rrhh.novedades', 'UPDATE'), true) then
    raise exception 'FALLO PL2: hay escritura directa en tablas de configuración';
  end if;

  if coalesce((select count(distinct action) from core.audit_log where company_id = a and action in (
        'rrhh.planilla.concepto_creado', 'rrhh.planilla.concepto_editado', 'rrhh.planilla.tipo_creado',
        'rrhh.planilla.tipo_editado', 'rrhh.planilla.ir_tabla_nueva', 'rrhh.planilla.declaracion_generada',
        'rrhh.planilla.asistencia_importada')) <> 7, true) then
    raise exception 'FALLO PL2: faltan acciones de PL2c en la auditoría';
  end if;
end;
$$;

rollback;
