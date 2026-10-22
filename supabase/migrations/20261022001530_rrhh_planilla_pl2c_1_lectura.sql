-- PL2c de Planilla (docs/plan/20-planilla.md §6, §8.3 y §10), parte 1 de 3: RPC de lectura,
-- reportes, declaraciones, importación desde Asistencia y configuración.
-- NO APLICADA. Probada solo en PGlite (supabase/tests/rrhh_planilla_pl2c.prueba.sql).
-- La aplica el coordinador después de la revisión y del ensayo revertido en
-- nexo-core (decisión del usuario del 2026-10-21: "las migraciones se aplican
-- cuando pasan PGlite, la revisión y un ensayo revertido").
--
-- Qué agrega (contrato común de PL2b, PL2c y pantallas, §5; todas
-- public.planilla_*, security definer, search_path vacío, permiso exigido con
-- core.fn_exigir_permiso antes de leer o escribir, filtro por company_id):
--   * Lectura para pantallas: planilla_detalle, planilla_comparar,
--     planilla_contratos_opciones, planilla_novedades_listado,
--     planilla_regimen_listado y planilla_simular_regimen. Devuelven el nombre
--     de la persona (nombre || ' ' || apellido) sin exigir
--     expedientes.empleados.ver: la RPC es la frontera.
--   * Configuración: planilla_concepto_guardar, planilla_tipo_guardar y
--     planilla_ir_tabla_nueva (auditadas).
--   * Declaraciones del mes (INSS, INATEC y DGI-VET) desde planillas aprobadas o
--     pagadas cuyo periodo_fin cae en el mes; auditadas con
--     rrhh.planilla.declaracion_generada.
--   * Propuesta e importación de horas extra y ausencias desde Asistencia
--     (rrhh.fn_asistencia_dias), idempotente.
-- No crea ni cambia tablas, columnas, índices, policies ni permisos. Agrega un
-- parámetro de ley (horas_extra_fraccion_minutos, ver abajo). Va DESPUÉS de PL2b
-- (20261022000002): lee rrhh.vacaciones_movimientos para no proponer ausencias
-- en días de vacaciones (hallazgo de la revisión independiente del 2026-10-21).
-- Las novedades de préstamos y vacaciones solo aparecen como texto en origen.
--
-- Decisiones de esta migración (para revisión del coordinador):
--   * Horas extra propuestas = minutos_sobre_jornada de Asistencia redondeados
--     hacia abajo a la fracción del parámetro horas_extra_fraccion_minutos
--     (30, "verificar"); ausencia propuesta = día "sin_marcas" (laborable, con
--     jornada, sin feriado y sin marcas) que no está en un goce de vacaciones
--     aprobado; si hay un goce solicitado, la fila sale con aviso. Solo días
--     anteriores a hoy (America/Managua). Los topes de horas extra van como
--     aviso en detalle: el motor ya bloquea al calcular. El trabajo en feriado o
--     en día de descanso no se propone (no hay concepto todavía).
--   * Clave de idempotencia de cada novedad importada:
--     md5('asistencia:' || contrato_id || ':' || fecha YYYY-MM-DD || ':' || código)::uuid.
--     Una novedad importada y anulada no se vuelve a crear.
--   * La importación vuelve a calcular la propuesta y solo acepta filas que
--     estén en ella: horas extra mayores que cero, en múltiplos de la fracción y
--     sin superar lo que muestra la asistencia; ausencia de un día completo, sin
--     vacaciones aprobadas y sin otra ausencia ese día. Así origen = 'asistencia'
--     es verificable. Por eso exige también rrhh.asistencia.reportes.ver, igual
--     que la propuesta. Crea cada novedad con public.planilla_novedad_crear
--     (mismas validaciones) y después le pone origen 'asistencia' y el lote, solo
--     si la creó esta misma transacción.
--   * Conceptos propios: devengado o deducción de monto fijo. Una deducción por
--     días u horas no reduce la base de INSS ni de IR (el motor la descuenta
--     después del IR; solo AUSENCIA reduce los días pagados), y los conceptos
--     por días u horas con reglas legales son del sistema. Una deducción propia
--     no afecta INSS, IR ni INATEC ni cuenta para prestaciones. En un concepto
--     del sistema solo cambian nombre, en_colilla y cuenta_contable. Un cambio de
--     reglas obliga a recalcular las planillas calculadas (la huella de PL2b ya
--     incluye las reglas de los conceptos).
--   * Tabla de IR: vigencia el día 1 o 16; tramos contiguos y sin saltos de
--     impuesto (sobre_exceso = hasta anterior e impuesto_base = el impuesto al
--     final del tramo anterior); reemplaza tablas futuras que ninguna planilla
--     ordinaria calculada, aprobada o pagada usó; candado por empresa.
--     rrhh.ir_tramos no tiene columnas de certeza ni de fuente: se validan como
--     en planilla_parametro_vigencia_nueva y quedan en la auditoría.
--   * Declaraciones de INSS e IR: solo planillas ordinarias (el aguinaldo no
--     cotiza ni retiene) y sin filas en cero.
--   * Tipos de planilla: la clase no cambia al editar (protege el tipo Aguinaldo).
--   * Ajustes del coordinador por la especificación de UX (2026-10-21):
--     planilla_detalle devuelve la fila completa de la planilla más tipo, la
--     empresa (core.companies.name y tax_id) y, por línea, origen y artículo;
--     planilla_comparar agrega anterior_id, anterior_periodo_inicio y
--     anterior_periodo_fin (null = no hay período anterior para comparar);
--     planilla_novedades_listado agrega concepto_metodo; planilla_simular_regimen
--     deja salario y costos en null si quien llama no tiene planilla.ver ni
--     rrhh.expedientes.compensacion.ver.
--   * Simulador: además de las columnas del contrato devuelve inss_patronal,
--     inatec, provisiones_laboral, provisiones_servicios y avisos.
--
-- Rollback (antes de uso):
--   delete from rrhh.parametros_ley where codigo = 'horas_extra_fraccion_minutos';
--   drop function public.planilla_detalle(uuid, uuid);
--   drop function public.planilla_comparar(uuid, uuid);
--   drop function public.planilla_contratos_opciones(uuid);
--   drop function public.planilla_novedades_listado(uuid, date, date, uuid);
--   drop function public.planilla_regimen_listado(uuid);
--   drop function public.planilla_simular_regimen(uuid, date);
--   drop function public.planilla_concepto_guardar(uuid, uuid, text, text, text, text, boolean, boolean, boolean,
--     boolean, boolean, boolean, boolean, boolean, integer, text, boolean);
--   drop function public.planilla_tipo_guardar(uuid, uuid, text, text, text, text, boolean);
--   drop function public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text);
--   drop function public.planilla_declaracion_inss(uuid, date);
--   drop function public.planilla_declaracion_inatec(uuid, date);
--   drop function public.planilla_declaracion_ir(uuid, date);
--   drop function public.planilla_asistencia_propuesta(uuid, uuid);
--   drop function public.planilla_asistencia_importar(uuid, uuid, jsonb);
--   drop function rrhh.fn_planilla_asistencia_propuesta(uuid, uuid, date);
-- Los datos que hayan creado (conceptos, tipos, tramos de IR, novedades con
-- origen 'asistencia') quedan; se revisan con core.audit_log.

-- -----------------------------------------------------------------------------
-- 0. Prechequeo
-- -----------------------------------------------------------------------------
do $$
declare
  v_f text;
  v_codigo text;
begin
  if to_regclass('rrhh.planilla_lineas') is null or to_regclass('rrhh.planilla_empleados') is null
     or to_regclass('rrhh.novedades') is null or to_regclass('rrhh.conceptos') is null
     or to_regclass('rrhh.planilla_tipos') is null or to_regclass('rrhh.ir_tramos') is null
     or to_regclass('rrhh.contrato_regimen') is null then
    raise exception 'precheck: faltan tablas de PL2a';
  end if;
  if to_regclass('rrhh.vacaciones_movimientos') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'rrhh' and table_name = 'vacaciones_movimientos'
                    and column_name = 'fecha_fin') then
    raise exception 'precheck: falta PL2b (rrhh.vacaciones_movimientos)';
  end if;
  if exists (select 1 from rrhh.parametros_ley where codigo = 'horas_extra_fraccion_minutos') then
    raise exception 'precheck: el parámetro horas_extra_fraccion_minutos ya existe';
  end if;
  foreach v_f in array array[
      'public.planilla_novedad_crear(uuid,uuid,uuid,date,numeric,numeric,text,uuid,uuid)',
      'rrhh.fn_planilla_parametro(uuid,text,date)', 'rrhh.fn_planilla_contratos(uuid)',
      'rrhh.fn_planilla_huella_insumos(uuid)', 'rrhh.fn_asistencia_dias(uuid,date,date,uuid,uuid,uuid,uuid)',
      'core.fn_exigir_permiso(uuid,text)', 'core.fn_auditar(uuid,uuid,text,text,text,jsonb)',
      'core.has_permission(uuid,uuid,text)'] loop
    if to_regprocedure(v_f) is null then
      raise exception 'precheck: falta la función %', v_f;
    end if;
  end loop;
  foreach v_codigo in array array[
      'rrhh.planillas.planilla.ver', 'rrhh.planillas.movimientos.ver', 'rrhh.planillas.movimientos.crear',
      'rrhh.planillas.vacaciones.registrar', 'rrhh.planillas.prestamos.gestionar', 'rrhh.planillas.liquidaciones.calcular',
      'rrhh.planillas.regimen.ver', 'rrhh.planillas.conceptos.gestionar', 'rrhh.planillas.parametros.editar',
      'rrhh.planillas.declaraciones.generar', 'rrhh.asistencia.reportes.ver', 'rrhh.expedientes.compensacion.ver'] loop
    if not exists (select 1 from core.permissions_catalog where code = v_codigo) then
      raise exception 'precheck: falta el permiso %', v_codigo;
    end if;
  end loop;
  foreach v_f in array array[
      'public.planilla_detalle(uuid,uuid)', 'public.planilla_comparar(uuid,uuid)',
      'public.planilla_contratos_opciones(uuid)', 'public.planilla_novedades_listado(uuid,date,date,uuid)',
      'public.planilla_regimen_listado(uuid)', 'public.planilla_simular_regimen(uuid,date)',
      'public.planilla_concepto_guardar(uuid,uuid,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,integer,text,boolean)',
      'public.planilla_tipo_guardar(uuid,uuid,text,text,text,text,boolean)',
      'public.planilla_ir_tabla_nueva(uuid,date,jsonb,text,text)',
      'public.planilla_declaracion_inss(uuid,date)', 'public.planilla_declaracion_inatec(uuid,date)',
      'public.planilla_declaracion_ir(uuid,date)', 'public.planilla_asistencia_propuesta(uuid,uuid)',
      'public.planilla_asistencia_importar(uuid,uuid,jsonb)', 'rrhh.fn_planilla_asistencia_propuesta(uuid,uuid,date)'] loop
    if to_regprocedure(v_f) is not null then
      raise exception 'precheck: % ya existe', v_f;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'rrhh' and table_name = 'empleados'
                 and column_name = 'documento_identidad')
     or not exists (select 1 from information_schema.columns where table_schema = 'rrhh' and table_name = 'puestos'
                    and column_name = 'nombre')
     or not exists (select 1 from information_schema.columns where table_schema = 'rrhh' and table_name = 'contratos'
                    and column_name = 'fecha_antiguedad')
     or (select count(*) from information_schema.columns where table_schema = 'core' and table_name = 'companies'
         and column_name in ('name', 'tax_id')) <> 2 then
    raise exception 'precheck: faltan empleados.documento_identidad, puestos.nombre, contratos.fecha_antiguedad o companies.name y tax_id';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'rrhh.novedades'::regclass and contype = 'c'
                 and pg_get_constraintdef(oid) like '%''asistencia''%') then
    raise exception 'precheck: novedades.origen no admite asistencia';
  end if;
end;
$$;

-- Fracción para proponer horas extra desde Asistencia (hallazgo de la revisión:
-- no queda fijo en el código). Para cada empresa que ya tiene parámetros.
insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde, certeza, fuente)
select e.company_id, 'horas_extra_fraccion_minutos', 'numero', 30, date '2026-01-01', 'verificar',
       'Propuesta de Nexo: fracción para proponer horas extra desde Asistencia; confirmar con el contador'
from (select distinct company_id from rrhh.parametros_ley) e;

-- -----------------------------------------------------------------------------
-- 1. Detalle de una planilla (pantalla de la corrida y colillas)
-- -----------------------------------------------------------------------------
create function public.planilla_detalle(p_company_id uuid, p_planilla_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.ver');
  p rrhh.planillas;
  t rrhh.planilla_tipos;
  v_planilla jsonb;
  v_empresa jsonb;
  v_renglones jsonb;
begin
  select * into p from rrhh.planillas x where x.id = p_planilla_id and x.company_id = p_company_id;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  select * into t from rrhh.planilla_tipos x where x.id = p.planilla_tipo_id and x.company_id = p_company_id;

  -- La fila completa de la planilla (estado, huellas, quién y cuándo, pago,
  -- anulación, totales) más el tipo.
  v_planilla := to_jsonb(p) || jsonb_build_object(
    'tipo_nombre', t.nombre, 'clase', t.clase, 'frecuencia', t.frecuencia,
    'reemplazada_por', (select q.id from rrhh.planillas q where q.reemplaza_a = p.id and q.company_id = p_company_id),
    -- Calculada con insumos que cambiaron después: hay que volver a calcular antes de aprobar.
    'cambios_sin_calcular', case when p.estado = 'calculada'
                                 then rrhh.fn_planilla_huella_insumos(p.id) is distinct from p.hash_insumos
                                 else false end);
  select jsonb_build_object('nombre', co.name, 'ruc', co.tax_id) into v_empresa
  from core.companies co where co.id = p_company_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'contrato_id', e.contrato_id, 'numero_contrato', c.numero_contrato, 'empleado_id', e.empleado_id,
      'empleado_nombre', em.nombre || ' ' || em.apellido,
      'periodo_inicio', e.periodo_inicio, 'periodo_fin', e.periodo_fin,
      'salario_mensual', e.salario_mensual, 'salario_diario', e.salario_diario, 'dias_pagados', e.dias_pagados,
      'devengado', e.devengado, 'deducciones', e.deducciones, 'neto', e.neto, 'aportes', e.aportes,
      'provisiones', e.provisiones, 'regimen', e.regimen, 'regimen_inss', e.regimen_inss,
      'metodo_ir', e.metodo_ir, 'porcentaje_ir', e.porcentaje_ir, 'avisos', to_jsonb(e.avisos),
      'lineas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'concepto_codigo', l.concepto_codigo, 'concepto_nombre', l.concepto_nombre, 'tipo', l.tipo,
                 'cantidad', l.cantidad, 'unidad', l.unidad, 'base', l.base, 'tasa', l.tasa, 'monto', l.monto,
                 'orden', l.orden, 'en_colilla', coalesce(co.en_colilla, true), 'origen', l.origen,
                 'articulo', l.articulo)
               order by l.orden, l.concepto_codigo, l.id)
        from rrhh.planilla_lineas l
        left join rrhh.conceptos co on co.id = l.concepto_id and co.company_id = l.company_id
        where l.planilla_empleado_id = e.id and l.periodo_fin = p.periodo_fin and l.company_id = p_company_id), '[]'::jsonb))
    order by em.nombre || ' ' || em.apellido, c.numero_contrato), '[]'::jsonb)
    into v_renglones
  from rrhh.planilla_empleados e
  join rrhh.contratos c on c.id = e.contrato_id and c.company_id = e.company_id
  join rrhh.empleados em on em.id = e.empleado_id and em.company_id = e.company_id
  where e.planilla_id = p.id and e.company_id = p_company_id;

  return jsonb_build_object('planilla', v_planilla, 'empresa', v_empresa, 'renglones', v_renglones);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Comparación con la planilla aprobada o pagada anterior del mismo tipo
-- -----------------------------------------------------------------------------
create function public.planilla_comparar(p_company_id uuid, p_planilla_id uuid)
returns table (contrato_id uuid, numero_contrato bigint, empleado_nombre text,
               devengado_actual numeric, devengado_anterior numeric, neto_actual numeric, neto_anterior numeric,
               diferencia_neto numeric, estado text, anterior_id uuid, anterior_periodo_inicio date,
               anterior_periodo_fin date)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.ver');
  p rrhh.planillas;
  v_ant uuid;
  v_ant_ini date;
  v_ant_fin date;
begin
  select * into p from rrhh.planillas x where x.id = p_planilla_id and x.company_id = p_company_id;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if p.estado = 'borrador' then
    raise exception 'Calcula la planilla antes de compararla con la anterior.';
  end if;
  -- Sin planilla anterior, anterior_id y sus fechas van en null y todo sale como 'nuevo'.
  select q.id, q.periodo_inicio, q.periodo_fin into v_ant, v_ant_ini, v_ant_fin from rrhh.planillas q
  where q.company_id = p_company_id and q.planilla_tipo_id = p.planilla_tipo_id and q.id <> p.id
    and q.estado in ('aprobada', 'pagada') and q.periodo_fin < p.periodo_inicio
  order by q.periodo_fin desc limit 1;

  return query
  with a as (
    select e.contrato_id as cid, e.empleado_id as eid, e.devengado as dev, e.neto as net
    from rrhh.planilla_empleados e where e.planilla_id = p.id and e.company_id = p_company_id
  ), b as (
    select e.contrato_id as cid, e.empleado_id as eid, e.devengado as dev, e.neto as net
    from rrhh.planilla_empleados e where e.planilla_id = v_ant and e.company_id = p_company_id
  ), j as (
    select coalesce(a.cid, b.cid) as cid, coalesce(a.eid, b.eid) as eid, a.cid is not null as en_a, b.cid is not null as en_b,
           a.dev as da, b.dev as db, a.net as na, b.net as nb
    from a full join b on b.cid = a.cid
  )
  select j.cid, c.numero_contrato, em.nombre || ' ' || em.apellido, j.da, j.db, j.na, j.nb,
         coalesce(j.na, 0) - coalesce(j.nb, 0),
         case when not j.en_b then 'nuevo' when not j.en_a then 'sale'
              when j.da = j.db and j.na = j.nb then 'igual' else 'cambia' end,
         v_ant, v_ant_ini, v_ant_fin
  from j
  join rrhh.contratos c on c.id = j.cid and c.company_id = p_company_id
  join rrhh.empleados em on em.id = j.eid and em.company_id = p_company_id
  order by 3, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Contratos para elegir en formularios (sin salario)
-- -----------------------------------------------------------------------------
create function public.planilla_contratos_opciones(p_company_id uuid)
returns table (contrato_id uuid, numero_contrato bigint, empleado_id uuid, empleado_nombre text, estado text,
               fecha_inicio date, fecha_fin_real date, frecuencia_pago text, puesto text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  -- Sirve a varias pantallas: basta cualquiera de sus permisos.
  if v_uid is null or p_company_id is null or not (
       core.has_permission(v_uid, p_company_id, 'rrhh.planillas.movimientos.crear')
    or core.has_permission(v_uid, p_company_id, 'rrhh.planillas.vacaciones.registrar')
    or core.has_permission(v_uid, p_company_id, 'rrhh.planillas.prestamos.gestionar')
    or core.has_permission(v_uid, p_company_id, 'rrhh.planillas.liquidaciones.calcular')
    or core.has_permission(v_uid, p_company_id, 'rrhh.planillas.regimen.ver')) then
    raise exception using errcode = '42501',
      message = 'No tienes permiso para esta acción (rrhh.planillas.movimientos.crear, rrhh.planillas.vacaciones.registrar, '
             || 'rrhh.planillas.prestamos.gestionar, rrhh.planillas.liquidaciones.calcular o rrhh.planillas.regimen.ver).';
  end if;
  return query
  select c.id, c.numero_contrato, c.empleado_id, em.nombre || ' ' || em.apellido, c.estado, c.fecha_inicio,
         c.fecha_fin_real, cc.frecuencia_pago, pu.nombre
  from rrhh.contratos c
  join rrhh.empleados em on em.id = c.empleado_id and em.company_id = c.company_id
  left join rrhh.contrato_compensacion cc on cc.contrato_id = c.id and cc.company_id = c.company_id
  left join rrhh.puestos pu on pu.id = c.puesto_id and pu.company_id = c.company_id
  where c.company_id = p_company_id and c.estado in ('activo', 'finalizado')
  order by case c.estado when 'activo' then 0 else 1 end, 4, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Novedades de un rango de fechas
-- -----------------------------------------------------------------------------
-- Las de origen 'prestamo' o 'vacaciones' (PL2b) no se anulan desde la pantalla
-- de novedades: se manejan en la suya.
create function public.planilla_novedades_listado(p_company_id uuid, p_desde date, p_hasta date, p_contrato_id uuid default null)
returns table (id uuid, fecha date, contrato_id uuid, numero_contrato bigint, empleado_nombre text, concepto_id uuid,
               concepto_codigo text, concepto_nombre text, concepto_metodo text, tipo text, cantidad numeric,
               monto numeric, nota text, estado text, origen text, planilla_id uuid, planilla_estado text,
               creado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.ver');
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 366 then
    raise exception 'Indica un rango de fechas válido, de hasta un año.';
  end if;
  return query
  select n.id, n.fecha, n.contrato_id, c.numero_contrato, em.nombre || ' ' || em.apellido, n.concepto_id,
         co.codigo, co.nombre, co.metodo, co.tipo, n.cantidad, n.monto, n.nota, n.estado, n.origen, n.planilla_id,
         q.estado, n.created_at
  from rrhh.novedades n
  join rrhh.contratos c on c.id = n.contrato_id and c.company_id = n.company_id
  join rrhh.empleados em on em.id = n.empleado_id and em.company_id = n.company_id
  join rrhh.conceptos co on co.id = n.concepto_id and co.company_id = n.company_id
  left join rrhh.planillas q on q.id = n.planilla_id and q.company_id = n.company_id
  where n.company_id = p_company_id and n.fecha between p_desde and p_hasta
    and (p_contrato_id is null or n.contrato_id = p_contrato_id)
  order by n.fecha desc, 5, n.created_at desc, n.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Régimen vigente de cada contrato
-- -----------------------------------------------------------------------------
-- Una fila por contrato: la vigencia que ya empezó más reciente o, si ninguna
-- empezó, la próxima (la de fecha más cercana). fecha_antiguedad es la efectiva (si no se fijó, el inicio
-- del contrato). tiene_aviso usa la regla del motor sobre toda la vigencia:
-- servicios profesionales con jornada o marcas en el kiosco, sin descartar.
create function public.planilla_regimen_listado(p_company_id uuid)
returns table (contrato_id uuid, numero_contrato bigint, empleado_nombre text, estado_contrato text, fecha_inicio date,
               fecha_antiguedad date, regimen_id uuid, regimen text, regimen_inss text, metodo_ir text,
               porcentaje_ir numeric, paga_vacaciones boolean, paga_aguinaldo boolean, paga_indemnizacion boolean,
               vigente_desde date, motivo text, tiene_aviso boolean, aviso_descartado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.regimen.ver');
  v_hoy date := (now() at time zone 'America/Managua')::date;
begin
  return query
  select c.id, c.numero_contrato, em.nombre || ' ' || em.apellido, c.estado, c.fecha_inicio,
         coalesce(c.fecha_antiguedad, c.fecha_inicio),
         r.id, r.regimen, r.regimen_inss, r.metodo_ir, r.porcentaje_ir, r.paga_vacaciones, r.paga_aguinaldo,
         r.paga_indemnizacion, r.vigente_desde, r.motivo,
         coalesce(r.regimen = 'servicios_profesionales' and r.aviso_descartado_en is null
           and (exists (select 1 from rrhh.contrato_jornadas cj
                        where cj.contrato_id = c.id and cj.company_id = p_company_id
                          and (cj.vigente_hasta is null or cj.vigente_hasta >= r.vigente_desde)
                          and (r.vigente_hasta is null or cj.vigente_desde <= r.vigente_hasta))
                or exists (select 1 from rrhh.asistencia_marcas m
                           where m.company_id = p_company_id and m.contrato_id = c.id
                             and m.marcado_en >= r.vigente_desde::timestamp at time zone 'America/Managua'
                             and (r.vigente_hasta is null
                                  or m.marcado_en < (r.vigente_hasta + 1)::timestamp at time zone 'America/Managua'))),
           false),
         r.aviso_descartado_en
  from rrhh.contratos c
  join rrhh.empleados em on em.id = c.empleado_id and em.company_id = c.company_id
  left join lateral (
    select cr.* from rrhh.contrato_regimen cr
    where cr.contrato_id = c.id and cr.company_id = c.company_id
    order by (cr.vigente_desde <= v_hoy) desc,
             case when cr.vigente_desde <= v_hoy then cr.vigente_desde end desc,
             cr.vigente_desde asc
    limit 1) r on true
  where c.company_id = p_company_id
  order by case c.estado when 'activo' then 0 when 'borrador' then 1 else 2 end, 3, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Simulador de costo mensual por régimen (no guarda nada)
-- -----------------------------------------------------------------------------
-- Por contrato activo con salario, con los parámetros vigentes a p_fecha:
--   laboral   = salario + INSS patronal (con techo) + INATEC + provisiones de
--               vacaciones, aguinaldo e indemnización (mes completo, como el motor);
--   servicios = salario + las provisiones que lleva el régimen actual (si es
--               laboral, todas; sin régimen, ninguna).
-- La retención de IR de servicios profesionales no es costo de la empresa.
-- Salario y costos van en null si quien llama no tiene planilla.ver ni
-- rrhh.expedientes.compensacion.ver (el régimen y los avisos sí se ven).
create function public.planilla_simular_regimen(p_company_id uuid, p_fecha date default null)
returns table (contrato_id uuid, numero_contrato bigint, empleado_nombre text, salario_mensual numeric,
               regimen_actual text, costo_laboral numeric, costo_servicios numeric, diferencia numeric,
               inss_patronal numeric, inatec numeric, provisiones_laboral numeric, provisiones_servicios numeric,
               avisos text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.regimen.ver');
  -- regimen.ver no da acceso a salarios (el gestor de expedientes lo tiene): los
  -- montos se muestran solo a quien ya ve salarios en planillas o en el contrato.
  v_ve_montos boolean := core.has_permission(v_uid, p_company_id, 'rrhh.planillas.planilla.ver')
                         or core.has_permission(v_uid, p_company_id, 'rrhh.expedientes.compensacion.ver');
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Managua')::date);
  v_dias_mes numeric;
  v_techo numeric;
  v_pat numeric;
  v_pat_ivm numeric;
  v_inatec numeric;
  v_vac numeric;
  v_ag numeric;
  v_ind numeric;
  v_usados text[] := array['dias_mes_comercial', 'techo_inss', 'inss_patronal', 'inatec', 'vacaciones_dias_por_mes',
                           'aguinaldo_dias_por_mes', 'provision_indemnizacion_divisor'];
  v_avisos text[];
begin
  v_dias_mes := rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', v_fecha);
  v_techo := rrhh.fn_planilla_parametro(p_company_id, 'techo_inss', v_fecha);
  v_pat := rrhh.fn_planilla_parametro(p_company_id, 'inss_patronal', v_fecha);
  v_inatec := rrhh.fn_planilla_parametro(p_company_id, 'inatec', v_fecha);
  v_vac := rrhh.fn_planilla_parametro(p_company_id, 'vacaciones_dias_por_mes', v_fecha);
  v_ag := rrhh.fn_planilla_parametro(p_company_id, 'aguinaldo_dias_por_mes', v_fecha);
  v_ind := rrhh.fn_planilla_parametro(p_company_id, 'provision_indemnizacion_divisor', v_fecha);
  -- La tasa patronal IVM solo hace falta si algún contrato laboral está en IVM.
  if exists (select 1 from rrhh.contratos ct join rrhh.contrato_regimen cr on cr.contrato_id = ct.id and cr.company_id = ct.company_id
             where ct.company_id = p_company_id and ct.estado = 'activo' and cr.regimen = 'laboral' and cr.regimen_inss = 'ivm'
               and cr.vigente_desde <= v_fecha and (cr.vigente_hasta is null or cr.vigente_hasta >= v_fecha)) then
    v_pat_ivm := rrhh.fn_planilla_parametro(p_company_id, 'inss_patronal_ivm', v_fecha);
    v_usados := v_usados || 'inss_patronal_ivm'::text;
  end if;
  select coalesce(array_agg('Valor pendiente de confirmar con el contador: ' || replace(x.codigo, '_', ' ') order by x.codigo), '{}')
    into v_avisos
  from (select distinct pl.codigo from rrhh.parametros_ley pl
        where pl.company_id = p_company_id and pl.certeza = 'verificar' and pl.codigo = any (v_usados)
          and pl.vigente_desde <= v_fecha and (pl.vigente_hasta is null or pl.vigente_hasta >= v_fecha)) x;

  return query
  with c as (
    select ct.id as cid, ct.numero_contrato as num, ct.empleado_id as eid, cc.salario_base as s,
           round(cc.salario_base / v_dias_mes, 4) as diario,
           r.regimen as reg, r.regimen_inss as rinss,
           coalesce(r.paga_vacaciones, false) as lleva_vac, coalesce(r.paga_aguinaldo, false) as lleva_ag,
           coalesce(r.paga_indemnizacion, false) as lleva_ind
    from rrhh.contratos ct
    join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id and cc.company_id = ct.company_id
    left join lateral (
      select cr.* from rrhh.contrato_regimen cr
      where cr.contrato_id = ct.id and cr.company_id = ct.company_id
        and cr.vigente_desde <= v_fecha and (cr.vigente_hasta is null or cr.vigente_hasta >= v_fecha)
      order by cr.vigente_desde desc limit 1) r on true
    where ct.company_id = p_company_id and ct.estado = 'activo' and cc.salario_base > 0
  ), m as (
    select c.*,
           round(least(c.s, v_techo) * case when c.reg = 'laboral' and c.rinss = 'ivm' then v_pat_ivm else v_pat end, 2) as pat,
           round(c.s * v_inatec, 2) as ina,
           round(v_vac * c.diario, 2) as prov_vac,
           round(c.s * v_ag / v_dias_mes, 2) as prov_ag,
           round(c.s / v_ind, 2) as prov_ind
    from c
  ), f as (
    select m.*, m.prov_vac + m.prov_ag + m.prov_ind as prov_lab,
           case when m.lleva_vac then m.prov_vac else 0 end + case when m.lleva_ag then m.prov_ag else 0 end
             + case when m.lleva_ind then m.prov_ind else 0 end as prov_srv
    from m
  )
  select f.cid, f.num, em.nombre || ' ' || em.apellido,
         case when v_ve_montos then f.s end, f.reg,
         case when v_ve_montos then f.s + f.pat + f.ina + f.prov_lab end,
         case when v_ve_montos then f.s + f.prov_srv end,
         case when v_ve_montos then (f.s + f.pat + f.ina + f.prov_lab) - (f.s + f.prov_srv) end,
         case when v_ve_montos then f.pat end, case when v_ve_montos then f.ina end,
         case when v_ve_montos then f.prov_lab end, case when v_ve_montos then f.prov_srv end,
         v_avisos
  from f join rrhh.empleados em on em.id = f.eid and em.company_id = p_company_id
  order by 3, 2;
end;
$$;

-- RPC nuevas de esta parte: solo authenticated.
revoke all on function
  public.planilla_detalle(uuid, uuid),
  public.planilla_comparar(uuid, uuid),
  public.planilla_contratos_opciones(uuid),
  public.planilla_novedades_listado(uuid, date, date, uuid),
  public.planilla_regimen_listado(uuid),
  public.planilla_simular_regimen(uuid, date)
from public, anon;
grant execute on function
  public.planilla_detalle(uuid, uuid),
  public.planilla_comparar(uuid, uuid),
  public.planilla_contratos_opciones(uuid),
  public.planilla_novedades_listado(uuid, date, date, uuid),
  public.planilla_regimen_listado(uuid),
  public.planilla_simular_regimen(uuid, date)
to authenticated;
