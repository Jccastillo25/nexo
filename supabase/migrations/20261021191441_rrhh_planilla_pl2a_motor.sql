-- PL2a de Planilla (docs/plan/20-planilla.md §3.1, §7, §10): esquema y motor
-- de cálculo de la planilla ordinaria en RPC, más el simulador de liquidación.
-- APLICADA en nexo-core el 2026-10-21 con apply_migration (versión remota
-- 20261021191441), con aprobación del usuario ("Si"). Se escribió con el
-- prefijo local 20261021220000, que quedó en el metadata de la auditoría de
-- frecuencia ('migracion').
-- PL2b (documentos de liquidación, vacaciones, préstamos, embargos,
-- provisiones mensuales, saldos iniciales y aguinaldo) va en otra migración.
--
-- Decisiones del usuario (2026-10-21, en el chat de la sesión de PL2):
--   * aguinaldo por año calendario (ene–dic), como AG;
--   * separación de funciones estricta: quien crea o calcula no aprueba;
--   * además de líneas y novedades se particionarán provisiones y movimientos
--     de vacaciones (PL2b); las cuotas de préstamo no (son el plan acotado de
--     un préstamo);
--   * al cambiar el salario se conserva la antigüedad y las prestaciones se
--     revaloran con el último salario: contratos.fecha_antiguedad, que cambia
--     solo por RPC con rrhh.planillas.liquidaciones.aprobar;
--   * los contratos activos entran como servicios profesionales exentos, como
--     AG ("Free-lance"), con prestaciones;
--   * IR quincenal: mitad del IR proyectado en la 1.ª quincena y ajuste del mes
--     en la 2.ª;
--   * provisión de indemnización a 1/12, como AG;
--   * los contratos activos pasan a frecuencia quincenal, como AG, y las RPC de
--     contrato reciben la frecuencia (default de la columna: quincenal).
-- Otras correcciones del plan 20 §5: INSS patronal 21.5% y feriados 2026.
--
-- Convenciones: salario_base de rrhh.contrato_compensacion es MENSUAL; diario
-- = round(mensual / dias_mes_comercial, 4); días del período con regla 30/360
-- (el último día del mes cuenta como el 30); cada línea se redondea a centavos
-- y los totales suman líneas. El IR y el techo del INSS se calculan por
-- persona. Ninguna tasa ni monto va escrito aquí: todo se lee de
-- rrhh.parametros_ley o rrhh.ir_tramos con vigencia.
--
-- Escritura solo por RPC public.planilla_* (security definer, search_path '').
-- Tablas con RLS y solo SELECT para authenticated; nada para anon. Toma
-- ACCESS EXCLUSIVE breve sobre rrhh.contratos, contrato_compensacion,
-- parametros_ley, feriados, planillas y planilla_detalles: aplicar en horario
-- de poco uso (lock_timeout abajo; `set local` solo actúa dentro de la
-- transacción de apply_migration).
--
-- Rollback (antes de uso; no hay planillas reales). En este orden:
--   drop trigger trg_planilla_proteger on rrhh.planillas;
--   drop trigger trg_contrato_antiguedad_proteger on rrhh.contratos;
--   drop table rrhh.planilla_lineas, rrhh.novedades, rrhh.planilla_empleados,
--     rrhh.conceptos, rrhh.contrato_regimen, rrhh.ir_tramos;
--   alter table rrhh.planillas drop constraint planillas_reemplaza_company_fk,
--     drop constraint planillas_tipo_company_fk, drop constraint
--     planillas_id_company_key, y drop column de las columnas de la sección 7;
--   restaurar planillas_estado_check ('borrador','aprobada','anulada'), las
--     policies "planillas: crear/editar borrador con permiso", "detalles:
--     crear/editar/eliminar con permiso", "parametros_ley: crear/editar con
--     permiso" y el grant insert/update/delete a authenticated en las tres;
--   drop table rrhh.planilla_tipos;
--   drop de public.planilla_* y rrhh.fn_planilla_*, rrhh.fn_liquidacion_calcular,
--     rrhh.fn_asegurar_particion_planilla_lineas, rrhh.fn_asegurar_particion_novedades,
--     rrhh.fn_contrato_antiguedad_proteger, y recrear crear_contrato /
--     editar_contrato con su firma anterior (20260918043955);
--   delete from core.tablas_particionadas where schema_nombre = 'rrhh'
--     and tabla_nombre in ('planilla_lineas', 'novedades');
--   alter table rrhh.contratos drop constraint contratos_fecha_antiguedad_check,
--     drop column fecha_antiguedad;
--   alter table rrhh.contrato_compensacion alter column frecuencia_pago set default 'mensual';
--     y devolver a 'mensual' los contratos listados en core.audit_log
--     (action 'rrhh.planilla.frecuencia_migrada');
--   delete from rrhh.feriados where created_by is null and (fecha, nombre) in (<los 14 de la sección 3>);
--     alter table rrhh.feriados drop column tipo;
--   delete from rrhh.parametros_ley where codigo = any (<los 16 de la sección 1>)
--     or (codigo = 'inss_patronal' and valor = 0.215);
--   update rrhh.parametros_ley set vigente_hasta = null where codigo = 'inss_patronal' and valor = 0.225;
--   alter table rrhh.parametros_ley drop column certeza, drop column fuente, y
--     restaurar parametros_ley_unidad_check ('porcentaje','monto').

set local lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 0. Prechequeo
-- -----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 25 then
    raise exception 'precheck: se esperaban 25 permisos rrhh.planillas.*';
  end if;
  if exists (select 1 from rrhh.planillas) or exists (select 1 from rrhh.planilla_detalles) then
    raise exception 'precheck: rrhh.planillas o rrhh.planilla_detalles ya tienen filas';
  end if;
  if to_regclass('rrhh.contrato_regimen') is not null or to_regclass('rrhh.planilla_lineas') is not null
     or to_regclass('rrhh.conceptos') is not null or to_regclass('rrhh.ir_tramos') is not null then
    raise exception 'precheck: ya existen tablas de PL2';
  end if;
  if not exists (select 1 from rrhh.parametros_ley where codigo = 'inss_patronal' and vigente_hasta is null and valor = 0.225) then
    raise exception 'precheck: no se encontró el INSS patronal 22.5%% abierto';
  end if;
  if exists (select 1 from rrhh.feriados where fecha between '2026-01-01' and '2026-12-31') then
    raise exception 'precheck: ya hay feriados de 2026';
  end if;
  if to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'precheck: falta pgcrypto en extensions';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'rrhh'
                 and table_name = 'asistencia_marcas' and column_name = 'contrato_id') then
    raise exception 'precheck: falta asistencia_marcas.contrato_id (P3)';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contratos_id_company_empleado_key'
                 and conrelid = 'rrhh.contratos'::regclass) then
    raise exception 'precheck: falta la unique (id, company_id, empleado_id) de contratos';
  end if;
  if to_regprocedure('rrhh.fn_crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric)') is null
     or to_regprocedure('rrhh.fn_editar_contrato(uuid,uuid,uuid,uuid,uuid,text,date,date,numeric)') is null
     or to_regprocedure('public.crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric)') is null
     or to_regprocedure('public.editar_contrato(uuid,uuid,uuid,uuid,uuid,text,date,date,numeric)') is null then
    raise exception 'precheck: las RPC de contrato no tienen la firma de 20260918043955';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Parámetros de ley (plan 20 §2, §5.1)
-- -----------------------------------------------------------------------------
alter table rrhh.parametros_ley drop constraint parametros_ley_unidad_check;
alter table rrhh.parametros_ley add constraint parametros_ley_unidad_check
  check (unidad in ('porcentaje', 'monto', 'numero'));
alter table rrhh.parametros_ley
  add column certeza text not null default 'verificar' check (certeza in ('oficial', 'coincidente', 'verificar')),
  add column fuente text check (fuente is null or length(fuente) <= 200);
comment on column rrhh.parametros_ley.certeza is
  'Grado de certeza (plan 20 §2): oficial, coincidente o verificar. Un valor "verificar" sirve para simular; la planilla lo lista en sus avisos.';

update rrhh.parametros_ley set certeza = 'coincidente', fuente = 'Decreto 06-2019'
  where codigo = 'inss_laboral' and vigente_hasta is null;
update rrhh.parametros_ley set certeza = 'coincidente', fuente = 'Decreto 40-94'
  where codigo = 'inatec' and vigente_hasta is null;
update rrhh.parametros_ley set certeza = 'verificar', fuente = 'Valor de ejemplo; confirmar con la factura del INSS'
  where codigo = 'techo_inss' and vigente_hasta is null;

-- El 22.5% de la semilla de 2026-09-02 no aplica (menos de 50 trabajadores,
-- régimen Integral en AG). Se cierra el mismo día de la semilla, sin
-- solaparse, y el 21.5% rige desde el día siguiente. Ninguna planilla lo usó
-- (prechequeo).
with cerrada as (
  update rrhh.parametros_ley set vigente_hasta = vigente_desde
  where codigo = 'inss_patronal' and vigente_hasta is null and valor = 0.225
  returning company_id, vigente_desde
)
insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde, certeza, fuente)
select company_id, 'inss_patronal', 'porcentaje', 0.215, vigente_desde + 1, 'verificar',
       'Decreto 06-2019, menos de 50 trabajadores; AG régimen Integral'
from cerrada;

-- Convenciones y valores de ley, por empresa que ya usa planilla (tiene
-- inss_laboral). Rigen desde 2026-01-01 para poder simular liquidaciones del año.
insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde, certeza, fuente)
select e.company_id, x.codigo, x.unidad, x.valor, date '2026-01-01', x.certeza, x.fuente
from (select distinct company_id from rrhh.parametros_ley where codigo = 'inss_laboral') e
cross join (values
  ('dias_mes_comercial', 'numero', 30::numeric, 'coincidente', 'AG Planilla, coeficiente de 30 días'),
  ('vacaciones_dias_por_mes', 'numero', 2.5, 'oficial', 'CT art. 76'),
  ('aguinaldo_dias_por_mes', 'numero', 2.5, 'oficial', 'CT art. 93'),
  ('aguinaldo_mes_inicio', 'numero', 1, 'verificar', 'Decisión del usuario 2026-10-21: ene–dic como AG'),
  ('indemnizacion_anios_iniciales', 'numero', 3, 'oficial', 'CT art. 45'),
  ('indemnizacion_dias_anio_inicial', 'numero', 30, 'oficial', 'CT art. 45'),
  ('indemnizacion_dias_anio_siguiente', 'numero', 20, 'oficial', 'CT art. 45'),
  ('indemnizacion_dias_minimo', 'numero', 30, 'verificar', 'CT art. 45; confirmar con menos de un año'),
  ('indemnizacion_dias_maximo', 'numero', 150, 'oficial', 'CT art. 45'),
  ('indemnizacion_exencion_ir', 'monto', 500000, 'verificar', 'Ley 822 art. 19'),
  ('confianza_meses_minimo', 'numero', 2, 'verificar', 'CT art. 47'),
  ('confianza_meses_maximo', 'numero', 6, 'verificar', 'CT art. 47'),
  ('provision_indemnizacion_divisor', 'numero', 12, 'verificar', 'Decisión del usuario 2026-10-21: 1/12 como AG'),
  ('factor_horas_extra', 'numero', 2, 'oficial', 'CT art. 62'),
  ('horas_extra_max_dia', 'numero', 3, 'oficial', 'CT art. 57'),
  ('horas_extra_max_semana', 'numero', 9, 'oficial', 'CT art. 57')
) as x(codigo, unidad, valor, certeza, fuente);

-- Escritura solo por public.planilla_parametro_vigencia_nueva (auditada).
-- Ninguna app escribe parametros_ley directo (verificado en apps/ el 2026-10-21).
drop policy if exists "parametros_ley: crear con permiso" on rrhh.parametros_ley;
drop policy if exists "parametros_ley: editar con permiso" on rrhh.parametros_ley;
revoke insert, update, delete, truncate on rrhh.parametros_ley from authenticated;
revoke all on rrhh.parametros_ley from anon;

-- -----------------------------------------------------------------------------
-- 2. Tabla de IR con vigencia (plan 20 §2.1, DGI, Ley 822 art. 23 con Ley 891)
-- -----------------------------------------------------------------------------
create table rrhh.ir_tramos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  vigente_desde date not null,
  vigente_hasta date,
  desde numeric(14,2) not null check (desde >= 0),
  hasta numeric(14,2),
  impuesto_base numeric(14,2) not null check (impuesto_base >= 0),
  porcentaje numeric(6,4) not null check (porcentaje between 0 and 1),
  sobre_exceso numeric(14,2) not null check (sobre_exceso >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (hasta is null or hasta > desde),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  unique (company_id, vigente_desde, desde)
);
create index ir_tramos_company_vigencia_idx on rrhh.ir_tramos (company_id, vigente_desde);
create index ir_tramos_created_by_idx on rrhh.ir_tramos (created_by);
comment on table rrhh.ir_tramos is
  'Tabla progresiva de IR de rentas del trabajo, renta neta anual en C$. Una fila por tramo; cada vigencia es contigua y sin huecos.';

insert into rrhh.ir_tramos (company_id, vigente_desde, desde, hasta, impuesto_base, porcentaje, sobre_exceso)
select e.company_id, date '2015-01-01', x.desde, x.hasta, x.base, x.pct, x.exceso
from (select distinct company_id from rrhh.parametros_ley where codigo = 'inss_laboral') e
cross join (values
  (0.00::numeric, 100000.00::numeric, 0::numeric, 0.00::numeric, 0::numeric),
  (100000.01, 200000.00, 0, 0.15, 100000.00),
  (200000.01, 350000.00, 15000.00, 0.20, 200000.00),
  (350000.01, 500000.00, 45000.00, 0.25, 350000.00),
  (500000.01, null, 82500.00, 0.30, 500000.00)
) as x(desde, hasta, base, pct, exceso);

-- -----------------------------------------------------------------------------
-- 3. Feriados 2026 (plan 20 §1.3, §5.4)
-- -----------------------------------------------------------------------------
alter table rrhh.feriados add column tipo text not null default 'nacional'
  check (tipo in ('nacional', 'asueto', 'local'));
comment on column rrhh.feriados.tipo is
  'nacional: CT art. 66. asueto: declarado por el Ejecutivo o conmemorativo. local: fiesta municipal. La clasificación de 2026 viene de AG y se confirma con el contador.';

insert into rrhh.feriados (company_id, fecha, nombre, tipo)
select e.company_id, x.fecha, x.nombre, x.tipo
from (select distinct company_id from rrhh.parametros_ley where codigo = 'inss_laboral') e
cross join (values
  (date '2026-01-01', 'Año Nuevo', 'nacional'),
  (date '2026-01-18', 'Natalicio de Rubén Darío', 'asueto'),
  (date '2026-02-02', 'Día de Obando y Bravo', 'asueto'),
  (date '2026-02-21', 'Día de Sandino', 'asueto'),
  (date '2026-04-02', 'Jueves Santo', 'nacional'),
  (date '2026-04-03', 'Viernes Santo', 'nacional'),
  (date '2026-05-01', 'Día del Trabajo', 'nacional'),
  (date '2026-05-30', 'Día de las Madres', 'asueto'),
  (date '2026-07-19', 'Día de la Revolución', 'nacional'),
  (date '2026-09-14', 'Batalla de San Jacinto', 'nacional'),
  (date '2026-09-15', 'Día de la Independencia', 'nacional'),
  (date '2026-11-08', 'Día de Carlos Fonseca', 'asueto'),
  (date '2026-12-08', 'Inmaculada Concepción', 'nacional'),
  (date '2026-12-25', 'Navidad', 'nacional')
) as x(fecha, nombre, tipo)
on conflict (company_id, fecha) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Antigüedad que continúa entre contratos
-- -----------------------------------------------------------------------------
alter table rrhh.contratos add column fecha_antiguedad date;
alter table rrhh.contratos add constraint contratos_fecha_antiguedad_check
  check (fecha_antiguedad is null or fecha_inicio is null or fecha_antiguedad <= fecha_inicio);
comment on column rrhh.contratos.fecha_antiguedad is
  'Inicio de la antigüedad laboral. Si es null, se usa fecha_inicio. Cuando un contrato continúa a otro (p. ej. por aumento de salario) hereda la fecha del anterior: el tiempo se conserva y las prestaciones se valoran con el último salario (decisión del usuario 2026-10-21). Solo cambia por public.planilla_contrato_antiguedad_fijar.';

-- Decide el monto de la liquidación: nadie la escribe directo desde la API
-- (las policies de contratos permiten INSERT/UPDATE de borradores).
create or replace function rrhh.fn_contrato_antiguedad_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and ((tg_op = 'INSERT' and new.fecha_antiguedad is not null)
          or (tg_op = 'UPDATE' and new.fecha_antiguedad is distinct from old.fecha_antiguedad)) then
    raise exception 'La fecha de antigüedad solo se cambia desde Planilla, con permiso y motivo.';
  end if;
  return new;
end;
$$;
create trigger trg_contrato_antiguedad_proteger before insert or update on rrhh.contratos
  for each row execute function rrhh.fn_contrato_antiguedad_proteger();

-- -----------------------------------------------------------------------------
-- 5. Frecuencia de pago quincenal (decisión del usuario 2026-10-21)
-- -----------------------------------------------------------------------------
alter table rrhh.contrato_compensacion alter column frecuencia_pago set default 'quincenal';

-- Activos y borradores (un borrador ya no cambia la frecuencia después de
-- activarse). La auditoría guarda el valor anterior real, para el rollback.
with previos as (
  select cc.contrato_id, cc.company_id, cc.frecuencia_pago
  from rrhh.contrato_compensacion cc join rrhh.contratos c on c.id = cc.contrato_id
  where c.estado in ('borrador', 'activo') and cc.frecuencia_pago <> 'quincenal'
), migrados as (
  update rrhh.contrato_compensacion cc set frecuencia_pago = 'quincenal', updated_at = now()
  from previos p where cc.contrato_id = p.contrato_id
  returning cc.contrato_id
)
select core.fn_auditar(null, p.company_id, 'rrhh.planilla.frecuencia_migrada', 'rrhh.contrato_compensacion',
         p.contrato_id::text, jsonb_build_object('antes', p.frecuencia_pago, 'despues', 'quincenal', 'migracion', '20261021220000'))
from previos p join migrados m on m.contrato_id = p.contrato_id;

-- Las RPC de contrato reciben la frecuencia (parámetro opcional al final: la app
-- llama con argumentos por nombre y no cambia). Cuerpo copiado de
-- 20260918043955 sin otros cambios.
drop function public.crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric);
drop function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric);
drop function public.editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric);
drop function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric);

create function rrhh.fn_crear_contrato(p_company_id uuid, p_empleado_id uuid, p_puesto_id uuid, p_departamento_id uuid,
  p_plantilla_contrato_id uuid, p_modalidad_contrato text default null, p_fecha_inicio date default null,
  p_salario_base numeric default null, p_frecuencia_pago text default null)
returns table(contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language plpgsql security definer set search_path to 'rrhh', 'core', 'extensions', 'pg_temp'
as $function$
declare
  v_contrato_id uuid;
  v_numero_contrato bigint;
  v_puesto_departamento_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.crear';
  end if;

  if p_frecuencia_pago is not null and p_frecuencia_pago not in ('mensual', 'quincenal', 'semanal') then
    raise exception 'Frecuencia de pago no válida';
  end if;
  if p_frecuencia_pago is not null and coalesce(p_salario_base, 0) = 0 then
    raise exception 'Indica el salario para fijar la frecuencia de pago';
  end if;

  if not exists (select 1 from rrhh.empleados where id = p_empleado_id and company_id = p_company_id) then
    raise exception 'Empleado no encontrado en esta empresa';
  end if;

  if exists (
    select 1 from rrhh.contratos
    where empleado_id = p_empleado_id and company_id = p_company_id
      and estado in ('activo', 'borrador')
  ) then
    raise exception 'Este empleado ya tiene un contrato activo o en borrador -- finalizalo antes de crear uno nuevo';
  end if;

  select departamento_id into v_puesto_departamento_id
  from rrhh.puestos
  where id = p_puesto_id and company_id = p_company_id and activo;
  if v_puesto_departamento_id is null then
    raise exception 'Puesto no encontrado, inactivo o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.departamentos where id = p_departamento_id and company_id = p_company_id and activo
  ) then
    raise exception 'Departamento no encontrado, inactivo o de otra empresa';
  end if;

  if v_puesto_departamento_id <> p_departamento_id then
    raise exception 'El puesto seleccionado no pertenece al departamento indicado';
  end if;

  if not exists (
    select 1 from rrhh.plantillas_contrato
    where id = p_plantilla_contrato_id and company_id = p_company_id and activo
  ) then
    raise exception 'Plantilla de contrato no encontrada, inactiva o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.puesto_plantillas
    where puesto_id = p_puesto_id and plantilla_id = p_plantilla_contrato_id
      and company_id = p_company_id and activo
  ) then
    raise exception 'La plantilla seleccionada no está asignada a este puesto';
  end if;

  insert into rrhh.contratos as c (
    company_id, empleado_id, puesto_id, departamento_id, plantilla_contrato_id,
    modalidad_contrato, fecha_inicio, created_by
  )
  values (
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, auth.uid()
  )
  returning c.id, c.numero_contrato into v_contrato_id, v_numero_contrato;

  if coalesce(p_salario_base, 0) <> 0 then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar (requerido para fijar salario)';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (v_contrato_id, p_company_id, p_salario_base, auth.uid());
    if p_frecuencia_pago is not null then
      -- Alias obligatorio: contrato_id también es columna OUT de RETURNS TABLE (ver 20260907154942).
      update rrhh.contrato_compensacion cc set frecuencia_pago = p_frecuencia_pago where cc.contrato_id = v_contrato_id;
    end if;
  end if;

  return query select v_contrato_id, v_numero_contrato, p_plantilla_contrato_id;
end;
$function$;
comment on function rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric, text) is
  '2026-09-17: puesto_id/departamento_id/plantilla_contrato_id obligatorios y validados server-side (mismo tenant, puesto pertenece al departamento, plantilla asignada y activa para el puesto). Sin parametro de fecha_fin_prevista -- un borrador nunca puede nacer con fecha de fin. Rechaza crear un segundo contrato abierto (activo/borrador) para el mismo empleado. 2026-10-21 (PL2a): p_frecuencia_pago opcional; sin ella queda el default quincenal.';

create function public.crear_contrato(p_company_id uuid, p_empleado_id uuid, p_puesto_id uuid, p_departamento_id uuid,
  p_plantilla_contrato_id uuid, p_modalidad_contrato text default null, p_fecha_inicio date default null,
  p_salario_base numeric default null, p_frecuencia_pago text default null)
returns table(contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language sql security definer set search_path to 'rrhh', 'public'
as $function$
  select * from rrhh.fn_crear_contrato(
    p_company_id, p_empleado_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, p_salario_base, p_frecuencia_pago
  );
$function$;

create function rrhh.fn_editar_contrato(p_contrato_id uuid, p_company_id uuid, p_puesto_id uuid default null,
  p_departamento_id uuid default null, p_plantilla_contrato_id uuid default null, p_modalidad_contrato text default null,
  p_fecha_inicio date default null, p_fecha_fin_prevista date default null, p_salario_base numeric default null,
  p_frecuencia_pago text default null)
returns void
language plpgsql security definer set search_path to 'rrhh', 'core', 'extensions', 'pg_temp'
as $function$
declare
  v_estado text;
  v_puesto_id uuid;
  v_departamento_id uuid;
  v_plantilla_id uuid;
  v_puesto_departamento_id uuid;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.contratos.editar') then
    raise exception 'Permiso denegado: rrhh.expedientes.contratos.editar';
  end if;

  if p_frecuencia_pago is not null and p_frecuencia_pago not in ('mensual', 'quincenal', 'semanal') then
    raise exception 'Frecuencia de pago no válida';
  end if;

  select estado, puesto_id, departamento_id, plantilla_contrato_id
  into v_estado, v_puesto_id, v_departamento_id, v_plantilla_id
  from rrhh.contratos where id = p_contrato_id and company_id = p_company_id;

  if v_estado is null then
    raise exception 'Contrato no encontrado en esta empresa';
  elsif v_estado <> 'borrador' then
    raise exception 'Solo se puede editar un contrato en estado borrador';
  end if;

  if p_fecha_inicio is not null and exists (select 1 from rrhh.contratos x where x.id = p_contrato_id
                                            and x.fecha_antiguedad is not null and x.fecha_antiguedad > p_fecha_inicio) then
    raise exception 'La fecha de inicio no puede ser anterior a la fecha de antigüedad del contrato';
  end if;

  v_puesto_id := coalesce(p_puesto_id, v_puesto_id);
  v_departamento_id := coalesce(p_departamento_id, v_departamento_id);
  v_plantilla_id := coalesce(p_plantilla_contrato_id, v_plantilla_id);

  select departamento_id into v_puesto_departamento_id
  from rrhh.puestos
  where id = v_puesto_id and company_id = p_company_id and activo;
  if v_puesto_departamento_id is null then
    raise exception 'Puesto no encontrado, inactivo o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.departamentos where id = v_departamento_id and company_id = p_company_id and activo
  ) then
    raise exception 'Departamento no encontrado, inactivo o de otra empresa';
  end if;

  if v_puesto_departamento_id <> v_departamento_id then
    raise exception 'El puesto seleccionado no pertenece al departamento indicado';
  end if;

  if not exists (
    select 1 from rrhh.plantillas_contrato
    where id = v_plantilla_id and company_id = p_company_id and activo
  ) then
    raise exception 'Plantilla de contrato no encontrada, inactiva o de otra empresa';
  end if;

  if not exists (
    select 1 from rrhh.puesto_plantillas
    where puesto_id = v_puesto_id and plantilla_id = v_plantilla_id
      and company_id = p_company_id and activo
  ) then
    raise exception 'La plantilla seleccionada no está asignada a este puesto';
  end if;

  update rrhh.contratos set
    puesto_id = v_puesto_id,
    departamento_id = v_departamento_id,
    plantilla_contrato_id = v_plantilla_id,
    modalidad_contrato = coalesce(p_modalidad_contrato, modalidad_contrato),
    fecha_inicio = coalesce(p_fecha_inicio, fecha_inicio),
    fecha_fin_prevista = coalesce(p_fecha_fin_prevista, fecha_fin_prevista),
    updated_at = now()
  where id = p_contrato_id and company_id = p_company_id;

  if p_salario_base is not null then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar';
    end if;

    insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base, updated_by)
    values (p_contrato_id, p_company_id, p_salario_base, auth.uid())
    on conflict (contrato_id) do update set
      salario_base = excluded.salario_base,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;

  if p_frecuencia_pago is not null then
    if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.compensacion.editar') then
      raise exception 'Permiso denegado: rrhh.expedientes.compensacion.editar';
    end if;
    update rrhh.contrato_compensacion cc set frecuencia_pago = p_frecuencia_pago, updated_by = auth.uid(), updated_at = now()
    where cc.contrato_id = p_contrato_id and cc.company_id = p_company_id;
    if not found then
      raise exception 'Indica el salario para fijar la frecuencia de pago';
    end if;
  end if;
end;
$function$;
comment on function rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text) is
  '2026-09-17: agrega plantilla_contrato_id (obligatorio ya en la fila, editable) y revalida puesto/departamento/plantilla contra el estado RESULTANTE (no solo el campo que cambio) en cada edicion. fecha_fin_prevista se sigue pudiendo completar aca -- la restriccion de "no debe existir" es solo al crear (fn_crear_contrato). 2026-10-21 (PL2a): p_frecuencia_pago opcional (exige compensacion.editar y salario ya fijado).';

create function public.editar_contrato(p_contrato_id uuid, p_company_id uuid, p_puesto_id uuid default null,
  p_departamento_id uuid default null, p_plantilla_contrato_id uuid default null, p_modalidad_contrato text default null,
  p_fecha_inicio date default null, p_fecha_fin_prevista date default null, p_salario_base numeric default null,
  p_frecuencia_pago text default null)
returns void
language sql security definer set search_path to 'rrhh', 'public'
as $function$
  select rrhh.fn_editar_contrato(
    p_contrato_id, p_company_id, p_puesto_id, p_departamento_id, p_plantilla_contrato_id,
    p_modalidad_contrato, p_fecha_inicio, p_fecha_fin_prevista, p_salario_base, p_frecuencia_pago
  );
$function$;

-- -----------------------------------------------------------------------------
-- 6. Régimen de contratación por contrato y con vigencia (plan 20 §8.3)
-- -----------------------------------------------------------------------------
create table rrhh.contrato_regimen (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  regimen text not null check (regimen in ('laboral', 'servicios_profesionales')),
  regimen_inss text not null check (regimen_inss in ('integral', 'ivm', 'ninguno')),
  metodo_ir text not null check (metodo_ir in ('tabla_progresiva', 'retencion_fija', 'exento')),
  porcentaje_ir numeric(6,4),
  paga_vacaciones boolean not null,
  paga_aguinaldo boolean not null,
  paga_indemnizacion boolean not null,
  vigente_desde date not null,
  vigente_hasta date,
  motivo text not null check (length(btrim(motivo)) between 5 and 500),
  aprobado_por uuid references auth.users(id),
  aviso_descartado_por uuid references auth.users(id),
  aviso_descartado_en timestamptz,
  aviso_motivo text check (aviso_motivo is null or length(aviso_motivo) <= 500),
  created_at timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  constraint contrato_regimen_coherencia check (
    (regimen = 'laboral' and regimen_inss in ('integral', 'ivm') and metodo_ir = 'tabla_progresiva'
      and porcentaje_ir is null and paga_vacaciones and paga_aguinaldo and paga_indemnizacion)
    or (regimen = 'servicios_profesionales' and regimen_inss = 'ninguno'
      and ((metodo_ir = 'retencion_fija' and porcentaje_ir is not null and porcentaje_ir between 0 and 1)
        or (metodo_ir = 'exento' and porcentaje_ir is null)))
  ),
  unique (id, company_id),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id) on delete cascade
);
create unique index contrato_regimen_abierto_unico on rrhh.contrato_regimen (contrato_id) where vigente_hasta is null;
create index contrato_regimen_contrato_vigencia_idx on rrhh.contrato_regimen (contrato_id, vigente_desde);
create index contrato_regimen_company_idx on rrhh.contrato_regimen (company_id, contrato_id);
create index contrato_regimen_empleado_idx on rrhh.contrato_regimen (empleado_id);
create index contrato_regimen_aprobado_por_idx on rrhh.contrato_regimen (aprobado_por);
create index contrato_regimen_aviso_por_idx on rrhh.contrato_regimen (aviso_descartado_por);
comment on table rrhh.contrato_regimen is
  'Régimen de cada contrato con vigencia: laboral (INSS, INATEC, IR por tabla, prestaciones) o servicios_profesionales (sin INSS; IR fijo o exento; prestaciones configurables). Lo decide el contador; Nexo no da asesoría legal. Escritura solo por public.planilla_regimen_cambiar.';

-- -----------------------------------------------------------------------------
-- 7. Tipos de planilla, conceptos y planillas
-- -----------------------------------------------------------------------------
create table rrhh.planilla_tipos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  clase text not null check (clase in ('ordinaria', 'aguinaldo')),
  frecuencia text not null check (frecuencia in ('mensual', 'quincenal', 'semanal', 'anual')),
  moneda text not null default 'NIO' check (moneda in ('NIO')),
  centro_costo text check (centro_costo is null or length(centro_costo) <= 80),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((clase = 'aguinaldo') = (frecuencia = 'anual')),
  unique (company_id, nombre),
  unique (id, company_id)
);
-- Mientras un contrato no se asigne a un tipo (multiplanilla, PL4+), solo
-- puede haber un tipo activo por clase y frecuencia: evita pagar dos veces.
create unique index planilla_tipos_activo_unico on rrhh.planilla_tipos (company_id, clase, frecuencia) where activo;
comment on table rrhh.planilla_tipos is
  'Las distintas planillas de la empresa (las "Plantillas" de AG). Un contrato entra en una planilla ordinaria cuando su frecuencia_pago coincide con la del tipo; por eso hay un solo tipo activo por clase y frecuencia.';

create table rrhh.conceptos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  codigo text not null check (codigo ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  tipo text not null check (tipo in ('devengado', 'deduccion', 'aporte_patronal', 'provision')),
  metodo text not null check (metodo in ('sistema', 'fijo', 'horas', 'dias')),
  afecta_inss boolean not null default false,
  afecta_ir boolean not null default false,
  afecta_inatec boolean not null default false,
  cuenta_aguinaldo boolean not null default false,
  cuenta_vacaciones boolean not null default false,
  cuenta_indemnizacion boolean not null default false,
  es_ordinario boolean not null default false,
  en_colilla boolean not null default true,
  permite_novedad boolean not null default false,
  es_sistema boolean not null default false,
  orden integer not null default 500,
  articulo text check (articulo is null or length(articulo) <= 120),
  cuenta_contable text check (cuenta_contable is null or length(cuenta_contable) <= 40),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permite_novedad = false or metodo in ('fijo', 'horas', 'dias')),
  unique (company_id, codigo),
  unique (id, company_id)
);
comment on table rrhh.conceptos is
  'Catálogo de ingresos, deducciones, aportes y provisiones. Los es_sistema son legales y no se editan. Las líneas copian los flags, así que una planilla aprobada no cambia si el concepto cambia.';

insert into rrhh.planilla_tipos (company_id, nombre, clase, frecuencia)
select distinct company_id, 'Planilla quincenal', 'ordinaria', 'quincenal'
from rrhh.parametros_ley where codigo = 'inss_laboral';

insert into rrhh.conceptos (company_id, codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec,
  cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, es_ordinario, permite_novedad, es_sistema, orden, articulo)
select e.company_id, x.* from (select distinct company_id from rrhh.parametros_ley where codigo = 'inss_laboral') e
cross join (values
  ('SALARIO', 'Salario ordinario', 'devengado', 'sistema', true, true, true, true, true, true, true, false, true, 10, 'CT art. 86'),
  ('AUSENCIA', 'Ausencia injustificada (días)', 'deduccion', 'dias', false, false, false, false, false, false, false, true, true, 15, 'CT art. 86'),
  ('HORAS_EXTRA', 'Horas extra', 'devengado', 'horas', true, true, true, false, false, false, false, true, true, 20, 'CT arts. 57, 58 y 62'),
  ('COMISION', 'Comisiones', 'devengado', 'fijo', true, true, true, false, false, false, false, true, false, 30, null),
  ('BONO', 'Bono', 'devengado', 'fijo', true, true, true, false, false, false, false, true, false, 40, null),
  ('INSS_LABORAL', 'INSS laboral', 'deduccion', 'sistema', false, false, false, false, false, false, false, false, true, 100, 'Decreto 06-2019'),
  ('IR', 'IR rentas del trabajo', 'deduccion', 'sistema', false, false, false, false, false, false, false, false, true, 110, 'Ley 822 art. 23'),
  ('IR_SP', 'Retención IR servicios profesionales', 'deduccion', 'sistema', false, false, false, false, false, false, false, false, true, 111, 'Ley 822'),
  ('ADELANTO', 'Adelanto salarial', 'deduccion', 'fijo', false, false, false, false, false, false, false, true, false, 200, null),
  ('FALTANTE', 'Faltante de caja o producto', 'deduccion', 'fijo', false, false, false, false, false, false, false, true, false, 210, null),
  ('DEDUCCION_OTRA', 'Otra deducción', 'deduccion', 'fijo', false, false, false, false, false, false, false, true, false, 290, null),
  ('INSS_PATRONAL', 'INSS patronal', 'aporte_patronal', 'sistema', false, false, false, false, false, false, false, false, true, 300, 'Decreto 06-2019'),
  ('INATEC', 'INATEC', 'aporte_patronal', 'sistema', false, false, false, false, false, false, false, false, true, 310, 'Decreto 40-94'),
  ('PROV_VACACIONES', 'Provisión de vacaciones', 'provision', 'sistema', false, false, false, false, false, false, false, false, true, 400, 'CT art. 76'),
  ('PROV_AGUINALDO', 'Provisión de aguinaldo', 'provision', 'sistema', false, false, false, false, false, false, false, false, true, 410, 'CT art. 93'),
  ('PROV_INDEMNIZACION', 'Provisión de indemnización', 'provision', 'sistema', false, false, false, false, false, false, false, false, true, 420, 'CT art. 45')
) as x(codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec, cuenta_aguinaldo, cuenta_vacaciones,
       cuenta_indemnizacion, es_ordinario, permite_novedad, es_sistema, orden, articulo);

-- planillas (existe, 0 filas): estados nuevos, tipo, huellas, pago y anulación.
alter table rrhh.planillas drop constraint planillas_estado_check;
alter table rrhh.planillas add constraint planillas_estado_check
  check (estado in ('borrador', 'calculada', 'aprobada', 'pagada', 'anulada'));
alter table rrhh.planillas
  add column planilla_tipo_id uuid not null,
  add column fecha_pago date,
  add column hash_insumos text,
  add column calculada_por uuid references auth.users(id),
  add column calculada_en timestamptz,
  add column hash_aprobado text,
  add column pagada_por uuid references auth.users(id),
  add column pagada_en timestamptz,
  add column metodo_pago text check (metodo_pago is null or metodo_pago in ('cheque', 'transferencia')),
  add column referencia_pago text check (referencia_pago is null or length(referencia_pago) <= 120),
  add column motivo_anulacion text check (motivo_anulacion is null or length(motivo_anulacion) <= 500),
  add column reemplaza_a uuid,
  add column totales jsonb not null default '{}'::jsonb;
alter table rrhh.planillas add constraint planillas_id_company_key unique (id, company_id);
alter table rrhh.planillas add constraint planillas_tipo_company_fk
  foreign key (planilla_tipo_id, company_id) references rrhh.planilla_tipos (id, company_id);
alter table rrhh.planillas add constraint planillas_reemplaza_company_fk
  foreign key (reemplaza_a, company_id) references rrhh.planillas (id, company_id);
create unique index planillas_periodo_vivo_unico on rrhh.planillas (company_id, planilla_tipo_id, periodo_inicio, periodo_fin)
  where estado <> 'anulada';
create unique index planillas_reemplaza_a_unico on rrhh.planillas (reemplaza_a) where reemplaza_a is not null;
create index planillas_company_periodo_fin_idx on rrhh.planillas (company_id, periodo_fin);
create index planillas_tipo_idx on rrhh.planillas (planilla_tipo_id);
create index planillas_calculada_por_idx on rrhh.planillas (calculada_por);
create index planillas_pagada_por_idx on rrhh.planillas (pagada_por);
comment on column rrhh.planillas.generada_por is 'Quien creó la planilla. No puede aprobarla.';
comment on column rrhh.planillas.hash_insumos is 'Huella sha256 de los insumos usados en el último cálculo. Aprobar la recalcula y rechaza si cambió.';
comment on column rrhh.planillas.hash_aprobado is 'Huella sha256 de las líneas al aprobar.';

-- Escritura solo por RPC: se retiran las policies y los grants de escritura
-- directa (ninguna app los usa; verificado en apps/ el 2026-10-21).
drop policy if exists "planillas: crear con permiso" on rrhh.planillas;
drop policy if exists "planillas: editar borrador con permiso" on rrhh.planillas;
revoke insert, update, delete, truncate on rrhh.planillas from authenticated;
revoke all on rrhh.planillas from anon;

-- planilla_detalles queda en desuso (plan 20 §7): no se borra, pero ya no se escribe.
drop policy if exists "detalles: crear con permiso" on rrhh.planilla_detalles;
drop policy if exists "detalles: editar con permiso" on rrhh.planilla_detalles;
drop policy if exists "detalles: eliminar con permiso" on rrhh.planilla_detalles;
revoke insert, update, delete, truncate on rrhh.planilla_detalles from authenticated;
revoke all on rrhh.planilla_detalles from anon;
comment on table rrhh.planilla_detalles is 'EN DESUSO desde PL2a (2026-10-21): reemplazada por planilla_empleados + planilla_lineas. Sin escritura.';

-- -----------------------------------------------------------------------------
-- 8. Renglón por contrato, líneas y novedades (hechos particionados)
-- -----------------------------------------------------------------------------
-- planilla_empleados no se particiona: crece con las corridas (un renglón por
-- contrato y planilla, unas pocas decenas al mes) y es el padre de las líneas
-- particionadas, que sí crecen sin límite.
create table rrhh.planilla_empleados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  planilla_id uuid not null,
  contrato_id uuid not null,
  empleado_id uuid not null,
  contrato_regimen_id uuid not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  salario_mensual numeric(14,2) not null,
  salario_diario numeric(14,4) not null,
  horas_jornada numeric(6,2),
  frecuencia text not null,
  regimen text not null,
  regimen_inss text not null,
  metodo_ir text not null,
  porcentaje_ir numeric(6,4),
  paga_vacaciones boolean not null,
  paga_aguinaldo boolean not null,
  paga_indemnizacion boolean not null,
  dias_pagados numeric(8,4) not null default 0,
  devengado numeric(14,2) not null default 0,
  deducciones numeric(14,2) not null default 0,
  neto numeric(14,2) not null default 0,
  aportes numeric(14,2) not null default 0,
  provisiones numeric(14,2) not null default 0,
  avisos text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (planilla_id, contrato_id),
  unique (id, company_id),
  foreign key (planilla_id, company_id) references rrhh.planillas (id, company_id) on delete cascade,
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id),
  foreign key (contrato_regimen_id, company_id) references rrhh.contrato_regimen (id, company_id)
);
create index planilla_empleados_company_idx on rrhh.planilla_empleados (company_id, planilla_id);
create index planilla_empleados_contrato_idx on rrhh.planilla_empleados (contrato_id);
create index planilla_empleados_empleado_idx on rrhh.planilla_empleados (empleado_id, planilla_id);
create index planilla_empleados_regimen_idx on rrhh.planilla_empleados (contrato_regimen_id);
comment on table rrhh.planilla_empleados is
  'Un renglón por contrato y corrida, con la copia congelada de salario, diario, jornada y régimen. Los totales son suma de planilla_lineas.';

create table rrhh.planilla_lineas (
  id uuid not null default gen_random_uuid(),
  periodo_fin date not null,
  company_id uuid not null references core.companies(id),
  planilla_id uuid not null,
  planilla_empleado_id uuid not null,
  contrato_id uuid not null,
  concepto_id uuid not null,
  concepto_codigo text not null,
  concepto_nombre text not null,
  tipo text not null check (tipo in ('devengado', 'deduccion', 'aporte_patronal', 'provision')),
  afecta_inss boolean not null,
  afecta_ir boolean not null,
  afecta_inatec boolean not null,
  cuenta_aguinaldo boolean not null,
  cuenta_vacaciones boolean not null,
  cuenta_indemnizacion boolean not null,
  cantidad numeric(14,4),
  unidad text not null check (unidad in ('dias', 'horas', 'monto', 'porcentaje')),
  base numeric(14,4),
  tasa numeric(14,6),
  monto numeric(14,2) not null check (monto >= 0),
  origen text not null check (origen in ('sistema', 'novedad')),
  origen_ids uuid[],
  parametro_ref jsonb,
  articulo text,
  orden integer not null,
  created_at timestamptz not null default now(),
  primary key (id, periodo_fin),
  foreign key (planilla_id, company_id) references rrhh.planillas (id, company_id) on delete cascade,
  foreign key (planilla_empleado_id, company_id) references rrhh.planilla_empleados (id, company_id) on delete cascade,
  foreign key (concepto_id, company_id) references rrhh.conceptos (id, company_id)
) partition by range (periodo_fin);
create index planilla_lineas_company_fecha_idx on rrhh.planilla_lineas (company_id, periodo_fin);
create index planilla_lineas_planilla_idx on rrhh.planilla_lineas (planilla_id);
create index planilla_lineas_empleado_idx on rrhh.planilla_lineas (planilla_empleado_id);
create index planilla_lineas_contrato_idx on rrhh.planilla_lineas (contrato_id, periodo_fin);
create index planilla_lineas_concepto_idx on rrhh.planilla_lineas (concepto_id);
comment on table rrhh.planilla_lineas is
  'Una línea por concepto, con base, cantidad, tasa y monto ya redondeado, y copia de los flags del concepto. Particionada por mes de periodo_fin. Ninguna tabla le apunta con FK.';

create table rrhh.novedades (
  id uuid not null default gen_random_uuid(),
  fecha date not null,
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  concepto_id uuid not null,
  planilla_tipo_id uuid,
  cantidad numeric(10,4) check (cantidad is null or cantidad > 0),
  monto numeric(14,2) check (monto is null or monto > 0),
  nota text check (nota is null or length(nota) <= 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aplicada', 'anulada')),
  planilla_id uuid,
  origen text not null default 'manual' check (origen in ('manual', 'excel', 'asistencia')),
  lote uuid,
  clave_idempotencia uuid,
  creado_por uuid references auth.users(id),
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cantidad is null) <> (monto is null)),
  primary key (id, fecha),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id),
  foreign key (concepto_id, company_id) references rrhh.conceptos (id, company_id),
  foreign key (planilla_tipo_id, company_id) references rrhh.planilla_tipos (id, company_id),
  foreign key (planilla_id, company_id) references rrhh.planillas (id, company_id)
) partition by range (fecha);
create index novedades_company_fecha_idx on rrhh.novedades (company_id, fecha);
create index novedades_contrato_fecha_idx on rrhh.novedades (contrato_id, fecha);
create index novedades_empleado_idx on rrhh.novedades (empleado_id);
create index novedades_concepto_idx on rrhh.novedades (concepto_id);
create index novedades_tipo_idx on rrhh.novedades (planilla_tipo_id);
create index novedades_planilla_idx on rrhh.novedades (planilla_id);
create index novedades_pendientes_idx on rrhh.novedades (company_id, fecha) where estado = 'pendiente';
create index novedades_creado_por_idx on rrhh.novedades (creado_por);
create index novedades_anulada_por_idx on rrhh.novedades (anulada_por);
create unique index novedades_clave_unica on rrhh.novedades (company_id, clave_idempotencia, fecha)
  where clave_idempotencia is not null;
comment on table rrhh.novedades is
  'Movimientos del período (horas extra, ausencias, comisiones, bonos, deducciones puntuales). Particionada por mes de fecha. Al calcular pasan a aplicada; al anular la planilla vuelven a pendiente. clave_idempotencia evita duplicados en reintentos (Mobile).';

create or replace function rrhh.fn_asegurar_particion_planilla_lineas(p_mes date)
returns void language plpgsql set search_path = '' as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_particion text := 'planilla_lineas_' || to_char(v_inicio, 'YYYY_MM');
begin
  if to_regclass('rrhh.' || v_particion) is null then
    execute format('create table rrhh.%I partition of rrhh.planilla_lineas for values from (%L) to (%L)',
      v_particion, v_inicio, (v_inicio + interval '1 month')::date);
    execute format('alter table rrhh.%I enable row level security', v_particion);
    execute format('revoke all on table rrhh.%I from public, anon, authenticated', v_particion);
  end if;
end;
$$;

create or replace function rrhh.fn_asegurar_particion_novedades(p_mes date)
returns void language plpgsql set search_path = '' as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_particion text := 'novedades_' || to_char(v_inicio, 'YYYY_MM');
begin
  if to_regclass('rrhh.' || v_particion) is null then
    execute format('create table rrhh.%I partition of rrhh.novedades for values from (%L) to (%L)',
      v_particion, v_inicio, (v_inicio + interval '1 month')::date);
    execute format('alter table rrhh.%I enable row level security', v_particion);
    execute format('revoke all on table rrhh.%I from public, anon, authenticated', v_particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('rrhh', 'planilla_lineas', 'rrhh.fn_asegurar_particion_planilla_lineas'),
  ('rrhh', 'novedades', 'rrhh.fn_asegurar_particion_novedades');

-- Desde enero de 2026, para la corrida en paralelo con AG del año en curso.
do $$
declare m date := date '2026-01-01';
begin
  while m <= date_trunc('month', now())::date loop
    perform rrhh.fn_asegurar_particion_planilla_lineas(m);
    perform rrhh.fn_asegurar_particion_novedades(m);
    m := (m + interval '1 month')::date;
  end loop;
end;
$$;
select core.fn_asegurar_particiones_futuras(3);

-- -----------------------------------------------------------------------------
-- 9. RLS, policies de lectura y grants
-- -----------------------------------------------------------------------------
alter table rrhh.ir_tramos enable row level security;
alter table rrhh.contrato_regimen enable row level security;
alter table rrhh.planilla_tipos enable row level security;
alter table rrhh.conceptos enable row level security;
alter table rrhh.planilla_empleados enable row level security;
alter table rrhh.planilla_lineas enable row level security;
alter table rrhh.novedades enable row level security;

create policy "ir_tramos: ver con permiso" on rrhh.ir_tramos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.ver'));
create policy "contrato_regimen: ver con permiso" on rrhh.contrato_regimen for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.regimen.ver'));
create policy "planilla_tipos: ver con permiso" on rrhh.planilla_tipos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.conceptos.ver'));
create policy "conceptos: ver con permiso" on rrhh.conceptos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.conceptos.ver'));
create policy "planilla_empleados: ver con permiso" on rrhh.planilla_empleados for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.ver'));
create policy "planilla_lineas: ver con permiso" on rrhh.planilla_lineas for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.ver'));
create policy "novedades: ver con permiso" on rrhh.novedades for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.ver'));

revoke all on rrhh.ir_tramos, rrhh.contrato_regimen, rrhh.planilla_tipos, rrhh.conceptos,
  rrhh.planilla_empleados, rrhh.planilla_lineas, rrhh.novedades from public, anon, authenticated;
grant select on rrhh.ir_tramos, rrhh.contrato_regimen, rrhh.planilla_tipos, rrhh.conceptos,
  rrhh.planilla_empleados, rrhh.planilla_lineas, rrhh.novedades to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Núcleo interno (sin EXECUTE para la API)
-- -----------------------------------------------------------------------------
-- Valor de un parámetro vigente a la fecha. Sin fila, o con dos, falla con motivo.
create or replace function rrhh.fn_planilla_parametro(p_company_id uuid, p_codigo text, p_fecha date)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  n integer;
  v numeric;
begin
  select count(*), max(pl.valor) into n, v
  from rrhh.parametros_ley pl
  where pl.company_id = p_company_id and pl.codigo = p_codigo
    and pl.vigente_desde <= p_fecha and (pl.vigente_hasta is null or pl.vigente_hasta >= p_fecha);
  if n = 0 then
    raise exception 'Falta el parámetro % vigente al %.', p_codigo, to_char(p_fecha, 'YYYY-MM-DD');
  elsif n > 1 then
    raise exception 'El parámetro % tiene más de una vigencia al %. Corrige sus fechas.', p_codigo, to_char(p_fecha, 'YYYY-MM-DD');
  end if;
  return v;
end;
$$;

-- Impuesto anual por la tabla progresiva vigente (sin redondear).
create or replace function rrhh.fn_planilla_ir_anual(p_company_id uuid, p_renta_anual numeric, p_fecha date)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  t record;
begin
  if not exists (select 1 from rrhh.ir_tramos it where it.company_id = p_company_id and it.vigente_desde <= p_fecha
                 and (it.vigente_hasta is null or it.vigente_hasta >= p_fecha)) then
    raise exception 'Falta la tabla de IR vigente al %.', to_char(p_fecha, 'YYYY-MM-DD');
  end if;
  if p_renta_anual <= 0 then
    return 0;
  end if;
  select it.* into t from rrhh.ir_tramos it
  where it.company_id = p_company_id and it.vigente_desde <= p_fecha
    and (it.vigente_hasta is null or it.vigente_hasta >= p_fecha)
    and p_renta_anual >= it.desde and (it.hasta is null or p_renta_anual <= it.hasta)
  order by it.desde desc limit 1;
  if not found then
    raise exception 'La tabla de IR vigente al % tiene un hueco para la renta calculada.', to_char(p_fecha, 'YYYY-MM-DD');
  end if;
  return t.impuesto_base + (p_renta_anual - t.sobre_exceso) * t.porcentaje;
end;
$$;

-- Día del mes con la regla 30/360: el último día del mes cuenta como el día
-- p_dias_mes (30), aunque el mes tenga 28 o 31.
create or replace function rrhh.fn_planilla_dia_comercial(p_fecha date, p_dias_mes numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_fecha = (date_trunc('month', p_fecha::timestamp) + interval '1 month - 1 day')::date then p_dias_mes
              else least(extract(day from p_fecha), p_dias_mes) end
$$;

-- Contratos que entran en una planilla ordinaria y su tramo efectivo del período.
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
    and cc.frecuencia_pago = t.frecuencia
$$;

-- Novedades que aplican a una planilla (no anuladas, del período, libres o ya suyas).
create or replace function rrhh.fn_planilla_novedades(p_planilla_id uuid)
returns table (id uuid, fecha date, contrato_id uuid, concepto_id uuid, codigo text, tipo text, metodo text,
               orden integer, cantidad numeric, monto numeric, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.fecha, n.contrato_id, n.concepto_id, co.codigo, co.tipo, co.metodo, co.orden,
         n.cantidad, n.monto, n.updated_at
  from rrhh.planillas p
  join rrhh.novedades n on n.company_id = p.company_id and n.fecha between p.periodo_inicio and p.periodo_fin
  join rrhh.conceptos co on co.id = n.concepto_id and co.company_id = n.company_id
  where p.id = p_planilla_id
    and n.estado <> 'anulada'
    and (n.planilla_id is null or n.planilla_id = p.id)
    and (n.planilla_tipo_id is null or n.planilla_tipo_id = p.planilla_tipo_id)
$$;

-- Huella de los insumos de los contratos de la planilla: salario, régimen,
-- jornada, novedades, parámetros y tramos (con valores) y la 1.ª quincena
-- aprobada de la que depende el IR de la 2.ª. Las fechas van en epoch para que
-- no dependa de la zona horaria de la sesión.
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
    'parametros', (select coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'v', pl.valor) order by pl.codigo, pl.id), '[]'::jsonb)
                   from rrhh.parametros_ley pl
                   where pl.company_id = p.company_id and pl.vigente_desde <= p.periodo_fin
                     and (pl.vigente_hasta is null or pl.vigente_hasta >= p.periodo_fin)),
    'ir', (select coalesce(jsonb_agg(jsonb_build_array(it.id, it.desde, it.hasta, it.impuesto_base, it.porcentaje, it.sobre_exceso)
             order by it.desde), '[]'::jsonb)
           from rrhh.ir_tramos it
           where it.company_id = p.company_id and it.vigente_desde <= p.periodo_fin
             and (it.vigente_hasta is null or it.vigente_hasta >= p.periodo_fin)),
    'quincena1', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'h', q.hash_aprobado) order by q.id), '[]'::jsonb)
                  from rrhh.planillas q
                  where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id and q.id <> p.id
                    and q.estado <> 'anulada' and q.periodo_inicio = date_trunc('month', p.periodo_inicio)::date
                    and q.periodo_fin < p.periodo_inicio)
  );
  return encode(extensions.digest(v::text, 'sha256'), 'hex');
end;
$$;

create or replace function rrhh.fn_planilla_huella_lineas(p_planilla_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object('c', l.contrato_id, 'k', l.concepto_codigo,
           'q', l.cantidad, 'b', l.base, 't', l.tasa, 'm', l.monto)
           order by l.contrato_id, l.orden, l.concepto_codigo, l.monto), '[]'::jsonb)::text, 'sha256'), 'hex')
  from rrhh.planilla_lineas l where l.planilla_id = p_planilla_id
$$;

-- Inserta una línea copiando el concepto. Devuelve el monto redondeado.
create or replace function rrhh.fn_planilla_linea(
  p_planilla_empleado_id uuid, p_codigo text, p_cantidad numeric, p_unidad text,
  p_base numeric, p_tasa numeric, p_monto numeric,
  p_origen text default 'sistema', p_origen_ids uuid[] default null, p_ref jsonb default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  e record;
  c rrhh.conceptos;
  v_monto numeric := round(p_monto, 2);
begin
  select pe.company_id, pe.planilla_id, pe.contrato_id, p.periodo_fin into e
  from rrhh.planilla_empleados pe join rrhh.planillas p on p.id = pe.planilla_id
  where pe.id = p_planilla_empleado_id;
  select * into c from rrhh.conceptos where company_id = e.company_id and codigo = p_codigo;
  if not found then
    raise exception 'Falta el concepto % en el catálogo de la empresa.', p_codigo;
  end if;
  insert into rrhh.planilla_lineas (periodo_fin, company_id, planilla_id, planilla_empleado_id, contrato_id,
    concepto_id, concepto_codigo, concepto_nombre, tipo, afecta_inss, afecta_ir, afecta_inatec,
    cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, cantidad, unidad, base, tasa, monto,
    origen, origen_ids, parametro_ref, articulo, orden)
  values (e.periodo_fin, e.company_id, e.planilla_id, p_planilla_empleado_id, e.contrato_id,
    c.id, c.codigo, c.nombre, c.tipo, c.afecta_inss, c.afecta_ir, c.afecta_inatec,
    c.cuenta_aguinaldo, c.cuenta_vacaciones, c.cuenta_indemnizacion, p_cantidad, p_unidad, p_base, p_tasa, v_monto,
    p_origen, p_origen_ids, p_ref, c.articulo, c.orden);
  return v_monto;
end;
$$;

-- Motor: borra y regenera renglones y líneas de la planilla (idempotente).
-- Orden por contrato (skill nexo-planilla-motor §2): días y salario →
-- devengados → base INSS → INSS laboral → IR → deducciones → neto → aportes
-- patronales → provisiones → avisos. Los contratos se recorren por persona: el
-- IR y el techo del INSS suman los contratos de la misma persona en el mes.
-- El llamador ya validó permiso y estado.
create or replace function rrhh.fn_planilla_calcular_nucleo(p_planilla_id uuid, p_uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p rrhh.planillas;
  t rrhh.planilla_tipos;
  k record;
  r rrhh.contrato_regimen;
  nv record;
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
  v_ded numeric;
  v_avisos text[];
  v_usados text[] := '{}';
  v_avisos_pl text[] := '{}';
  v_sin_salario integer;
  v_otra_frec integer;
  v_n integer := 0;
  v_tot jsonb;
begin
  select * into p from rrhh.planillas where id = p_planilla_id for update;
  select * into t from rrhh.planilla_tipos where id = p.planilla_tipo_id;
  v_hash_ini := rrhh.fn_planilla_huella_insumos(p.id);
  v_mes_ini := date_trunc('month', p.periodo_inicio)::date;

  -- Regenerar desde cero: libera novedades y borra renglones (y sus líneas).
  update rrhh.novedades set estado = 'pendiente', planilla_id = null
  where planilla_id = p.id and estado = 'aplicada' and fecha between p.periodo_inicio and p.periodo_fin;
  delete from rrhh.planilla_empleados where planilla_id = p.id;

  v_dias_mes := rrhh.fn_planilla_parametro(p.company_id, 'dias_mes_comercial', p.periodo_fin);
  v_usados := v_usados || 'dias_mes_comercial'::text;
  v_dias_base := case t.frecuencia when 'mensual' then v_dias_mes when 'quincenal' then v_dias_mes / 2 else 7 end;

  for k in select * from rrhh.fn_planilla_contratos(p.id) order by empleado_id, contrato_id loop
    v_n := v_n + 1;
    v_avisos := '{}';
    v_ids_usados := '{}';

    -- Un contrato no entra en dos planillas vivas que se solapan.
    if exists (select 1 from rrhh.planilla_empleados e2 join rrhh.planillas q on q.id = e2.planilla_id
               where e2.contrato_id = k.contrato_id and q.id <> p.id and q.estado <> 'anulada'
                 and q.periodo_inicio <= p.periodo_fin and q.periodo_fin >= p.periodo_inicio) then
      raise exception 'El contrato % ya está en otra planilla del mismo período.', k.numero_contrato;
    end if;

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
    perform rrhh.fn_planilla_linea(v_pe, 'SALARIO', v_dias_pag, 'dias', v_diario, null,
      case when v_fuera = 0 and v_ausencias = 0 then v_mensual * v_dias_base / v_dias_mes else v_diario * v_dias_pag end,
      'sistema', v_ids, jsonb_build_object('dias_base', v_dias_base, 'dias_fuera', v_fuera, 'dias_ausencia', v_ausencias));

    -- 2. Devengados: horas extra y novedades de monto fijo.
    select coalesce(sum(n.cantidad), 0), coalesce(array_agg(n.id), '{}') into v_hx, v_ids
    from rrhh.fn_planilla_novedades(p.id) n where n.contrato_id = k.contrato_id and n.codigo = 'HORAS_EXTRA';
    if v_hx > 0 then
      v_max := rrhh.fn_planilla_parametro(p.company_id, 'horas_extra_max_dia', p.periodo_fin);
      if exists (select 1 from rrhh.fn_planilla_novedades(p.id) n where n.contrato_id = k.contrato_id
                 and n.codigo = 'HORAS_EXTRA' group by n.fecha having sum(n.cantidad) > v_max) then
        raise exception 'El contrato % tiene más de % horas extra en un día.', k.numero_contrato, trim_scale(v_max);
      end if;
      -- La semana completa, aunque cruce el inicio o el fin del período.
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

    -- 6. Deducciones de novedades, en orden; nunca dejan el neto negativo.
    v_disp := v_dev - v_inss - v_ir;
    for nv in select * from rrhh.fn_planilla_novedades(p.id) n
              where n.contrato_id = k.contrato_id and n.tipo = 'deduccion' and n.metodo = 'fijo'
              order by n.orden, n.fecha, n.id loop
      if nv.monto > v_disp then
        raise exception 'Las deducciones del contrato % superan lo disponible del período.', k.numero_contrato;
      end if;
      v_ded := rrhh.fn_planilla_linea(v_pe, nv.codigo, null, 'monto', null, null, nv.monto, 'novedad', array[nv.id]);
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

    update rrhh.novedades set estado = 'aplicada', planilla_id = p.id
    where id = any (v_ids_usados) and fecha between p.periodo_inicio and p.periodo_fin;

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

  -- Si un insumo cambió mientras se calculaba, no se guarda una huella falsa.
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

-- Liquidación pura (sin guardar nada): arts. 42, 43, 45, 47, 48, 76, 93.
-- Las cifras usan el diario del salario recibido (el último) y la antigüedad desde p_fecha_antiguedad.
create or replace function rrhh.fn_liquidacion_calcular(
  p_company_id uuid, p_salario_mensual numeric, p_fecha_antiguedad date, p_fecha_egreso date,
  p_causa text, p_indeterminado boolean, p_dias_vacaciones numeric, p_dias_salario_pendiente numeric,
  p_meses_confianza numeric, p_paga_vacaciones boolean, p_paga_aguinaldo boolean, p_paga_indemnizacion boolean)
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
    v_ag_desde := greatest(v_ag_inicio, p_fecha_antiguedad);
    v_edad := age(p_fecha_egreso, v_ag_desde);
    v_meses_ag := extract(year from v_edad) * 12 + extract(month from v_edad) + extract(day from v_edad) / v_dias_mes;
    v_dias_ag := round(v_meses_ag * rrhh.fn_planilla_parametro(p_company_id, 'aguinaldo_dias_por_mes', p_fecha_egreso), 4);
    v_monto := round(v_dias_ag * v_diario, 2);
    v_lineas := v_lineas || jsonb_build_object('concepto', 'AGUINALDO', 'nombre', 'Aguinaldo proporcional',
      'dias', v_dias_ag, 'diario', v_diario, 'monto', v_monto, 'articulo', 'CT arts. 93 y 97', 'desde', v_ag_desde);
    v_total := v_total + v_monto;
    v_avisos := v_avisos || case when v_mes_inicio = 1
      then 'Período del aguinaldo por año calendario: pendiente de confirmar con el contador'
      else format('Período del aguinaldo desde el mes %s: pendiente de confirmar con el contador', v_mes_inicio) end;
  end if;

  -- Vacaciones no gozadas (art. 76, 77): saldo ingresado hasta que exista su registro (PL2b).
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

-- -----------------------------------------------------------------------------
-- 11. Inmutabilidad (defensa en profundidad; la escritura ya es solo por RPC)
-- -----------------------------------------------------------------------------
create or replace function rrhh.fn_planilla_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las planillas no se eliminan: se anulan con motivo.';
  end if;
  if old.estado in ('borrador', 'calculada') then
    return new;
  end if;
  if old.estado = 'aprobada' and new.estado in ('pagada', 'anulada')
     and (new.planilla_tipo_id, new.periodo_inicio, new.periodo_fin, new.hash_insumos, new.hash_aprobado,
          new.totales, new.total, new.calculada_por, new.aprobada_por, new.generada_por)
         is not distinct from
         (old.planilla_tipo_id, old.periodo_inicio, old.periodo_fin, old.hash_insumos, old.hash_aprobado,
          old.totales, old.total, old.calculada_por, old.aprobada_por, old.generada_por) then
    return new;
  end if;
  raise exception '%', case old.estado
    when 'aprobada' then 'La planilla está aprobada y ya no se modifica. Para corregirla, anúlala y genera otra.'
    when 'pagada' then 'La planilla está pagada y ya no se modifica.'
    else 'La planilla está anulada y ya no se modifica.' end;
end;
$$;
create trigger trg_planilla_proteger before update or delete on rrhh.planillas
  for each row execute function rrhh.fn_planilla_proteger();

create or replace function rrhh.fn_planilla_detalle_proteger()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_estado text;
begin
  select p.estado into v_estado from rrhh.planillas p
  where p.id = case when tg_op = 'DELETE' then old.planilla_id else new.planilla_id end;
  if v_estado is not null and v_estado not in ('borrador', 'calculada') then
    raise exception 'La planilla está % y su detalle ya no se modifica.', v_estado;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger trg_planilla_empleados_proteger before insert or update or delete on rrhh.planilla_empleados
  for each row execute function rrhh.fn_planilla_detalle_proteger();
create trigger trg_planilla_lineas_proteger before insert or update or delete on rrhh.planilla_lineas
  for each row execute function rrhh.fn_planilla_detalle_proteger();

-- -----------------------------------------------------------------------------
-- 12. RPC públicas (Web y Mobile)
-- -----------------------------------------------------------------------------
create or replace function public.planilla_crear(
  p_company_id uuid, p_planilla_tipo_id uuid, p_periodo_inicio date, p_periodo_fin date,
  p_fecha_pago date default null, p_reemplaza_a uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.generar');
  t rrhh.planilla_tipos;
  v_ultimo date;
  v_id uuid;
begin
  if p_periodo_inicio is null or p_periodo_fin is null or p_periodo_fin < p_periodo_inicio then
    raise exception 'Indica un período válido.';
  end if;
  select * into t from rrhh.planilla_tipos where id = p_planilla_tipo_id and company_id = p_company_id and activo;
  if not found then
    raise exception 'Tipo de planilla no encontrado.';
  end if;
  if t.clase <> 'ordinaria' then
    raise exception 'Por ahora solo se calculan planillas ordinarias. El aguinaldo llega en una etapa posterior.';
  end if;
  v_ultimo := (date_trunc('month', p_periodo_inicio) + interval '1 month - 1 day')::date;
  if (t.frecuencia = 'mensual' and not (extract(day from p_periodo_inicio) = 1 and p_periodo_fin = v_ultimo))
     or (t.frecuencia = 'quincenal' and not (
          (extract(day from p_periodo_inicio) = 1 and p_periodo_fin = p_periodo_inicio + 14)
          or (extract(day from p_periodo_inicio) = 16 and p_periodo_fin = v_ultimo)))
     or (t.frecuencia = 'semanal' and p_periodo_fin <> p_periodo_inicio + 6) then
    raise exception 'El período no corresponde a una planilla %.', t.frecuencia;
  end if;
  if p_fecha_pago is not null and p_fecha_pago < p_periodo_inicio then
    raise exception 'La fecha de pago no puede ser anterior al período.';
  end if;
  if p_reemplaza_a is not null and not exists (
       select 1 from rrhh.planillas q where q.id = p_reemplaza_a and q.company_id = p_company_id and q.estado = 'anulada'
         and q.planilla_tipo_id = p_planilla_tipo_id and q.periodo_inicio = p_periodo_inicio and q.periodo_fin = p_periodo_fin) then
    raise exception 'Solo se reemplaza una planilla anulada del mismo tipo y período.';
  end if;
  if exists (select 1 from rrhh.planillas q where q.company_id = p_company_id and q.planilla_tipo_id = p_planilla_tipo_id
             and q.periodo_inicio = p_periodo_inicio and q.periodo_fin = p_periodo_fin and q.estado <> 'anulada') then
    raise exception 'Ya existe una planilla de este tipo para ese período.';
  end if;
  perform rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', p_periodo_fin);
  perform rrhh.fn_asegurar_particion_planilla_lineas(p_periodo_fin);

  begin
    insert into rrhh.planillas (company_id, planilla_tipo_id, periodo_inicio, periodo_fin, fecha_pago, estado, total,
                                generada_por, generada_en, reemplaza_a)
    values (p_company_id, p_planilla_tipo_id, p_periodo_inicio, p_periodo_fin, p_fecha_pago, 'borrador', 0,
            v_uid, now(), p_reemplaza_a)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya existe una planilla de este tipo para ese período, o esa anulada ya tiene reemplazo.';
  end;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.creada', 'rrhh.planillas', v_id::text,
    jsonb_build_object('tipo', p_planilla_tipo_id, 'inicio', p_periodo_inicio, 'fin', p_periodo_fin, 'reemplaza_a', p_reemplaza_a));
  return v_id;
end;
$$;

create or replace function public.planilla_calcular(p_company_id uuid, p_planilla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.generar');
  v_estado text;
  v_tot jsonb;
begin
  select estado into v_estado from rrhh.planillas where id = p_planilla_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if v_estado not in ('borrador', 'calculada') then
    raise exception 'La planilla está % y no se recalcula. Para corregirla, anúlala y genera otra.', v_estado;
  end if;
  v_tot := rrhh.fn_planilla_calcular_nucleo(p_planilla_id, v_uid);
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.calculada', 'rrhh.planillas', p_planilla_id::text,
    jsonb_build_object('empleados', v_tot->'empleados', 'neto', v_tot->'neto', 'costo_total', v_tot->'costo_total'));
  return v_tot;
end;
$$;

create or replace function public.planilla_aprobar(p_company_id uuid, p_planilla_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.aprobar');
  p rrhh.planillas;
begin
  select * into p from rrhh.planillas where id = p_planilla_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if p.estado <> 'calculada' then
    raise exception 'Solo se aprueba una planilla calculada. Esta está %.', p.estado;
  end if;
  if v_uid = p.calculada_por or v_uid = p.generada_por then
    raise exception 'Quien genera o calcula una planilla no puede aprobarla. Pide la aprobación a otra persona.';
  end if;
  if rrhh.fn_planilla_huella_insumos(p.id) is distinct from p.hash_insumos then
    raise exception 'Hubo cambios después del cálculo. Vuelve a calcular.';
  end if;
  update rrhh.planillas set estado = 'aprobada', aprobada_por = v_uid, aprobada_en = now(),
    hash_aprobado = rrhh.fn_planilla_huella_lineas(p.id), updated_at = now()
  where id = p.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.aprobada', 'rrhh.planillas', p.id::text,
    jsonb_build_object('neto', p.totales->'neto', 'hash_insumos', p.hash_insumos));
end;
$$;

create or replace function public.planilla_pagar(
  p_company_id uuid, p_planilla_id uuid, p_metodo_pago text, p_referencia text default null, p_fecha_pago date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.pagar');
  p rrhh.planillas;
begin
  if p_metodo_pago is null or p_metodo_pago not in ('cheque', 'transferencia') then
    raise exception 'Indica el método de pago: cheque o transferencia.';
  end if;
  if p_referencia is not null and length(p_referencia) > 120 then
    raise exception 'La referencia de pago es demasiado larga.';
  end if;
  select * into p from rrhh.planillas where id = p_planilla_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if p.estado <> 'aprobada' then
    raise exception 'Solo se paga una planilla aprobada. Esta está %.', p.estado;
  end if;
  if p_fecha_pago is not null and (p_fecha_pago < p.periodo_inicio or p_fecha_pago > current_date + 31) then
    raise exception 'La fecha de pago no puede ser anterior al período ni de más de un mes adelante.';
  end if;
  if p_metodo_pago = 'transferencia' and exists (
       select 1 from rrhh.planilla_empleados e where e.planilla_id = p.id and not exists (
         select 1 from rrhh.empleado_cuentas_bancarias b
         where b.empleado_id = e.empleado_id and b.company_id = e.company_id and b.activo)) then
    raise exception 'Hay personas sin cuenta bancaria activa. Paga con cheque o registra la cuenta.';
  end if;
  update rrhh.planillas set estado = 'pagada', pagada_por = v_uid, pagada_en = now(), metodo_pago = p_metodo_pago,
    referencia_pago = nullif(btrim(p_referencia), ''), fecha_pago = coalesce(p_fecha_pago, fecha_pago, current_date),
    updated_at = now()
  where id = p.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.pagada', 'rrhh.planillas', p.id::text,
    jsonb_build_object('metodo', p_metodo_pago));
end;
$$;

create or replace function public.planilla_anular(p_company_id uuid, p_planilla_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.anular');
  p rrhh.planillas;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo de la anulación (5 a 500 caracteres).';
  end if;
  select * into p from rrhh.planillas where id = p_planilla_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if p.estado = 'pagada' then
    raise exception 'Una planilla pagada no se anula. La corrección de un pago está pendiente de definir con el contador.';
  elsif p.estado = 'anulada' then
    raise exception 'La planilla ya está anulada.';
  end if;
  -- El IR de la 2.ª quincena usa la 1.ª: no se anula la 1.ª mientras la 2.ª siga viva.
  if exists (select 1 from rrhh.planillas q where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id
             and q.estado in ('calculada', 'aprobada', 'pagada') and q.periodo_inicio > p.periodo_fin
             and date_trunc('month', q.periodo_inicio) = date_trunc('month', p.periodo_inicio)) then
    raise exception 'Anula primero la planilla de la segunda quincena: su IR depende de esta.';
  end if;
  update rrhh.novedades set estado = 'pendiente', planilla_id = null
  where planilla_id = p.id and estado = 'aplicada' and fecha between p.periodo_inicio and p.periodo_fin;
  update rrhh.planillas set estado = 'anulada', anulada_por = v_uid, anulada_en = now(),
    motivo_anulacion = btrim(p_motivo), updated_at = now()
  where id = p.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.anulada', 'rrhh.planillas', p.id::text,
    jsonb_build_object('estado_anterior', p.estado));
end;
$$;

create or replace function public.planilla_novedad_crear(
  p_company_id uuid, p_contrato_id uuid, p_concepto_id uuid, p_fecha date,
  p_cantidad numeric default null, p_monto numeric default null, p_nota text default null,
  p_planilla_tipo_id uuid default null, p_clave uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.crear');
  c record;
  co rrhh.conceptos;
  v_id uuid;
begin
  if p_fecha is null then
    raise exception 'Indica la fecha de la novedad.';
  end if;
  -- Reintento con la misma clave (Mobile): devuelve la novedad ya creada.
  if p_clave is not null then
    select n.id into v_id from rrhh.novedades n
    where n.company_id = p_company_id and n.clave_idempotencia = p_clave and n.fecha = p_fecha;
    if v_id is not null then
      if not exists (select 1 from rrhh.novedades n where n.id = v_id and n.fecha = p_fecha
                     and n.contrato_id = p_contrato_id and n.concepto_id = p_concepto_id) then
        raise exception 'Esa clave ya se usó para otra novedad.';
      end if;
      return v_id;
    end if;
  end if;
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real, cc.frecuencia_pago into c
  from rrhh.contratos ct left join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id
  where ct.id = p_contrato_id and ct.company_id = p_company_id;
  if not found or c.estado not in ('activo', 'finalizado') then
    raise exception 'Contrato no encontrado o no vigente.';
  end if;
  if (c.fecha_inicio is not null and p_fecha < c.fecha_inicio) or (c.fecha_fin_real is not null and p_fecha > c.fecha_fin_real) then
    raise exception 'La fecha está fuera de la vigencia del contrato.';
  end if;
  select * into co from rrhh.conceptos where id = p_concepto_id and company_id = p_company_id and activo and permite_novedad;
  if not found then
    raise exception 'Concepto no encontrado o no admite novedades.';
  end if;
  if co.metodo in ('horas', 'dias') then
    if p_cantidad is null or p_monto is not null or p_cantidad <= 0 or p_cantidad > (case co.metodo when 'horas' then 24 else 31 end) then
      raise exception 'Indica una cantidad válida de %.', co.metodo;
    end if;
  elsif p_monto is null or p_cantidad is not null or p_monto <= 0 or p_monto >= 100000000 then
    raise exception 'Indica un monto válido.';
  end if;
  if p_nota is not null and length(p_nota) > 300 then
    raise exception 'La nota es demasiado larga.';
  end if;
  if p_planilla_tipo_id is not null and not exists (
       select 1 from rrhh.planilla_tipos pt where pt.id = p_planilla_tipo_id and pt.company_id = p_company_id
         and pt.frecuencia = c.frecuencia_pago) then
    raise exception 'Tipo de planilla no encontrado o de otra frecuencia que el contrato.';
  end if;
  -- Bloquea las planillas de esa fecha frente a una aprobación concurrente.
  perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
    and p_fecha between q.periodo_inicio and q.periodo_fin for share;
  if exists (select 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
             and p_fecha between q.periodo_inicio and q.periodo_fin
             and (p_planilla_tipo_id is null or q.planilla_tipo_id = p_planilla_tipo_id)
             and exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = q.id and e.contrato_id = p_contrato_id)) then
    raise exception 'La planilla de esa fecha ya está aprobada. Registra la novedad en el período siguiente.';
  end if;
  perform rrhh.fn_asegurar_particion_novedades(p_fecha);
  begin
    insert into rrhh.novedades (fecha, company_id, contrato_id, empleado_id, concepto_id, planilla_tipo_id,
                                cantidad, monto, nota, clave_idempotencia, creado_por)
    values (p_fecha, p_company_id, p_contrato_id, c.empleado_id, p_concepto_id, p_planilla_tipo_id,
            p_cantidad, p_monto, nullif(btrim(p_nota), ''), p_clave, v_uid)
    returning id into v_id;
  exception when unique_violation then
    -- Dos reintentos simultáneos con la misma clave: gana el primero.
    select n.id into v_id from rrhh.novedades n
    where n.company_id = p_company_id and n.clave_idempotencia = p_clave and n.fecha = p_fecha;
    return v_id;
  end;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.novedad_creada', 'rrhh.novedades', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'concepto', co.codigo, 'fecha', p_fecha));
  return v_id;
end;
$$;

create or replace function public.planilla_novedad_anular(p_company_id uuid, p_novedad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.eliminar');
  n rrhh.novedades;
  v_fecha date;
begin
  -- Mismo orden de bloqueo que el cálculo (planilla y después novedad), para no
  -- trabarse con un cálculo concurrente.
  select x.fecha into v_fecha from rrhh.novedades x where x.id = p_novedad_id and x.company_id = p_company_id;
  if v_fecha is null then
    raise exception 'Novedad no encontrada.';
  end if;
  perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
    and v_fecha between q.periodo_inicio and q.periodo_fin for share;
  select * into n from rrhh.novedades where id = p_novedad_id and company_id = p_company_id and fecha = v_fecha for update;
  if n.estado = 'anulada' then
    raise exception 'La novedad ya está anulada.';
  end if;
  if n.planilla_id is not null and exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                           and q.estado in ('aprobada', 'pagada')) then
    raise exception 'La novedad ya está en una planilla aprobada y no se anula.';
  end if;
  update rrhh.novedades set estado = 'anulada', planilla_id = null, anulada_por = v_uid, anulada_en = now(), updated_at = now()
  where id = n.id and fecha = n.fecha;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.novedad_anulada', 'rrhh.novedades', n.id::text,
    jsonb_build_object('contrato_id', n.contrato_id, 'fecha', n.fecha));
end;
$$;

-- Nueva vigencia de régimen, o corrección de la vigencia abierta si ninguna
-- planilla viva la usó todavía. La fecha es el inicio del contrato o el inicio
-- de un período (día 1 o 16), para no prorratear un período entre dos regímenes.
create or replace function public.planilla_regimen_cambiar(
  p_company_id uuid, p_contrato_id uuid, p_regimen text, p_regimen_inss text, p_metodo_ir text,
  p_porcentaje_ir numeric, p_paga_vacaciones boolean, p_paga_aguinaldo boolean, p_paga_indemnizacion boolean,
  p_vigente_desde date, p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.regimen.cambiar');
  c record;
  r rrhh.contrato_regimen;
  r_prev rrhh.contrato_regimen;
  v_corrige boolean := false;
  v_id uuid;
begin
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real into c
  from rrhh.contratos ct where ct.id = p_contrato_id and ct.company_id = p_company_id for update;
  if not found then
    raise exception 'Contrato no encontrado.';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo del cambio (5 a 500 caracteres).';
  end if;
  if p_vigente_desde is null or (c.fecha_inicio is not null and p_vigente_desde < c.fecha_inicio) then
    raise exception 'La fecha efectiva no puede ser anterior al inicio del contrato.';
  end if;
  if c.estado = 'finalizado' and p_vigente_desde > c.fecha_fin_real then
    raise exception 'El contrato ya terminó: la fecha efectiva debe estar dentro de su vigencia.';
  end if;
  if p_vigente_desde is distinct from c.fecha_inicio
     and (extract(day from p_vigente_desde) not in (1, 16)
          or (extract(day from p_vigente_desde) = 16 and exists (select 1 from rrhh.contrato_compensacion cc
                where cc.contrato_id = p_contrato_id and cc.frecuencia_pago = 'mensual'))) then
    raise exception 'La fecha efectiva debe ser el inicio del contrato o el inicio de un período (día 1, o 16 en quincenal).';
  end if;
  if p_regimen is null or p_regimen not in ('laboral', 'servicios_profesionales') then
    raise exception 'Régimen no válido.';
  elsif p_regimen = 'laboral' and not coalesce(p_regimen_inss in ('integral', 'ivm') and p_metodo_ir = 'tabla_progresiva'
       and p_porcentaje_ir is null and p_paga_vacaciones and p_paga_aguinaldo and p_paga_indemnizacion, false) then
    raise exception 'El régimen laboral lleva INSS integral o IVM, IR por tabla y todas las prestaciones.';
  elsif p_regimen = 'servicios_profesionales' and not coalesce(p_regimen_inss = 'ninguno'
       and ((p_metodo_ir = 'retencion_fija' and coalesce(p_porcentaje_ir between 0 and 1, false))
            or (p_metodo_ir = 'exento' and p_porcentaje_ir is null))
       and p_paga_vacaciones is not null and p_paga_aguinaldo is not null and p_paga_indemnizacion is not null, false) then
    raise exception 'Servicios profesionales va sin INSS, con retención fija (0 a 100%%) o exento de IR.';
  end if;
  if p_regimen_inss = 'ivm' and (select count(distinct pl.codigo) from rrhh.parametros_ley pl
                                 where pl.company_id = p_company_id and pl.codigo in ('inss_laboral_ivm', 'inss_patronal_ivm')
                                   and (pl.vigente_hasta is null or pl.vigente_hasta >= p_vigente_desde)) < 2 then
    raise exception 'El régimen IVM todavía no tiene tasas cargadas. Pídelas al contador.';
  end if;

  select * into r from rrhh.contrato_regimen where contrato_id = p_contrato_id and vigente_hasta is null;
  if r.id is not null and p_vigente_desde <= r.vigente_desde then
    -- Corrección: solo si ninguna planilla viva usó la vigencia abierta.
    if exists (select 1 from rrhh.planilla_empleados e join rrhh.planillas q on q.id = e.planilla_id
               where e.contrato_regimen_id = r.id and q.estado <> 'anulada') then
      raise exception 'La vigencia actual ya se usó en una planilla. La nueva debe empezar después del %.',
        to_char(r.vigente_desde, 'YYYY-MM-DD');
    end if;
    select * into r_prev from rrhh.contrato_regimen where contrato_id = p_contrato_id and vigente_hasta = r.vigente_desde - 1;
    if r_prev.id is not null and p_vigente_desde <= r_prev.vigente_desde then
      raise exception 'La corrección debe empezar después del %.', to_char(r_prev.vigente_desde, 'YYYY-MM-DD');
    end if;
    v_corrige := true;
  end if;
  if exists (select 1 from rrhh.planilla_empleados e join rrhh.planillas q on q.id = e.planilla_id
             where e.contrato_id = p_contrato_id and q.estado in ('calculada', 'aprobada', 'pagada')
               and q.periodo_fin >= p_vigente_desde) then
    raise exception 'Ya hay una planilla calculada o aprobada después de esa fecha con el régimen actual. Anúlala o elige otra fecha.';
  end if;

  if v_corrige then
    if r_prev.id is not null then
      update rrhh.contrato_regimen set vigente_hasta = p_vigente_desde - 1 where id = r_prev.id;
    end if;
    update rrhh.contrato_regimen set regimen = p_regimen, regimen_inss = p_regimen_inss, metodo_ir = p_metodo_ir,
      porcentaje_ir = p_porcentaje_ir, paga_vacaciones = p_paga_vacaciones, paga_aguinaldo = p_paga_aguinaldo,
      paga_indemnizacion = p_paga_indemnizacion, vigente_desde = p_vigente_desde, motivo = btrim(p_motivo),
      aprobado_por = v_uid, aviso_descartado_por = null, aviso_descartado_en = null, aviso_motivo = null
    where id = r.id;
    perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.regimen_corregido', 'rrhh.contrato_regimen', r.id::text,
      jsonb_build_object('contrato_id', p_contrato_id,
        'anterior', jsonb_build_object('regimen', r.regimen, 'regimen_inss', r.regimen_inss, 'metodo_ir', r.metodo_ir,
                                       'porcentaje_ir', r.porcentaje_ir, 'desde', r.vigente_desde),
        'nuevo', jsonb_build_object('regimen', p_regimen, 'desde', p_vigente_desde)));
    return r.id;
  end if;

  -- Nueva vigencia: queda abierta también en contratos finalizados (el motor la
  -- acota por la fecha de fin), y nunca se solapa con otra.
  if exists (select 1 from rrhh.contrato_regimen x where x.contrato_id = p_contrato_id
             and x.id is distinct from r.id and (x.vigente_hasta is null or x.vigente_hasta >= p_vigente_desde)) then
    raise exception 'La nueva vigencia se solaparía con otra del mismo contrato.';
  end if;
  if r.id is not null then
    update rrhh.contrato_regimen set vigente_hasta = p_vigente_desde - 1 where id = r.id;
  end if;
  insert into rrhh.contrato_regimen (company_id, contrato_id, empleado_id, regimen, regimen_inss, metodo_ir, porcentaje_ir,
    paga_vacaciones, paga_aguinaldo, paga_indemnizacion, vigente_desde, motivo, aprobado_por)
  values (p_company_id, p_contrato_id, c.empleado_id, p_regimen, p_regimen_inss, p_metodo_ir, p_porcentaje_ir,
    p_paga_vacaciones, p_paga_aguinaldo, p_paga_indemnizacion, p_vigente_desde, btrim(p_motivo), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.regimen_cambiado', 'rrhh.contrato_regimen', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'anterior', r.regimen, 'nuevo', p_regimen, 'desde', p_vigente_desde));
  return v_id;
end;
$$;

create or replace function public.planilla_regimen_aviso_descartar(p_company_id uuid, p_contrato_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.regimen.cambiar');
  v_id uuid;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  update rrhh.contrato_regimen set aviso_descartado_por = v_uid, aviso_descartado_en = now(), aviso_motivo = btrim(p_motivo)
  where contrato_id = p_contrato_id and company_id = p_company_id and vigente_hasta is null
    and regimen = 'servicios_profesionales' and aviso_descartado_en is null
  returning id into v_id;
  if v_id is null then
    raise exception 'No hay un aviso de régimen pendiente para este contrato.';
  end if;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.aviso_regimen_descartado', 'rrhh.contrato_regimen', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id));
end;
$$;

-- Fecha de antigüedad (decisión del usuario 2026-10-21: liquidaciones.aprobar).
-- Sin fecha, la hereda del contrato anterior de la misma persona que terminó
-- justo antes de este.
create or replace function public.planilla_contrato_antiguedad_fijar(
  p_company_id uuid, p_contrato_id uuid, p_fecha_antiguedad date, p_motivo text)
returns date language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.aprobar');
  c rrhh.contratos;
  v_fecha date;
begin
  select * into c from rrhh.contratos where id = p_contrato_id and company_id = p_company_id for update;
  if not found or c.estado not in ('borrador', 'activo') then
    raise exception 'Contrato no encontrado o ya finalizado.';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  if p_fecha_antiguedad is null then
    select coalesce(a.fecha_antiguedad, a.fecha_inicio) into v_fecha
    from rrhh.contratos a
    where a.company_id = p_company_id and a.empleado_id = c.empleado_id and a.id <> c.id and a.estado = 'finalizado'
      and a.fecha_fin_real = c.fecha_inicio - 1
    order by a.fecha_fin_real desc limit 1;
    if v_fecha is null then
      raise exception 'No hay un contrato anterior que termine el día antes de este. Indica la fecha de antigüedad.';
    end if;
  else
    v_fecha := p_fecha_antiguedad;
  end if;
  if c.fecha_inicio is not null and v_fecha > c.fecha_inicio then
    raise exception 'La antigüedad no puede empezar después del inicio del contrato.';
  end if;
  update rrhh.contratos set fecha_antiguedad = v_fecha where id = c.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.antiguedad_fijada', 'rrhh.contratos', c.id::text,
    jsonb_build_object('anterior', c.fecha_antiguedad, 'nueva', v_fecha, 'heredada', p_fecha_antiguedad is null));
  return v_fecha;
end;
$$;

-- Nueva vigencia de un parámetro de ley: cierra la abierta y abre otra, auditado.
create or replace function public.planilla_parametro_vigencia_nueva(
  p_company_id uuid, p_codigo text, p_valor numeric, p_vigente_desde date, p_certeza text, p_fuente text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.parametros.editar');
  r rrhh.parametros_ley;
  v_id uuid;
begin
  select * into r from rrhh.parametros_ley where company_id = p_company_id and codigo = p_codigo and vigente_hasta is null for update;
  if not found then
    raise exception 'Parámetro no encontrado.';
  end if;
  if p_valor is null or p_valor < 0 or p_valor >= 100000000 or (r.unidad = 'porcentaje' and p_valor > 1)
     or (r.unidad = 'numero' and p_valor <= 0)
     or (p_codigo = 'aguinaldo_mes_inicio' and (p_valor <> trunc(p_valor) or p_valor not between 1 and 12)) then
    raise exception 'Indica un valor válido para %.', replace(p_codigo, '_', ' ');
  end if;
  if p_certeza is null or p_certeza not in ('oficial', 'coincidente', 'verificar') then
    raise exception 'Indica el grado de certeza: oficial, coincidente o verificar.';
  end if;
  if p_fuente is null or length(btrim(p_fuente)) not between 3 and 200 then
    raise exception 'Indica la fuente del valor (3 a 200 caracteres).';
  end if;
  if p_vigente_desde is null or p_vigente_desde <= r.vigente_desde then
    raise exception 'La nueva vigencia debe empezar después del %.', to_char(r.vigente_desde, 'YYYY-MM-DD');
  end if;
  if exists (select 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
             and q.periodo_fin >= p_vigente_desde) then
    raise exception 'Hay planillas aprobadas después de esa fecha. La nueva vigencia debe empezar después de ellas.';
  end if;
  update rrhh.parametros_ley set vigente_hasta = p_vigente_desde - 1 where id = r.id;
  insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde, certeza, fuente, created_by)
  values (p_company_id, p_codigo, r.unidad, p_valor, p_vigente_desde, p_certeza, btrim(p_fuente), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.parametro_cambiado', 'rrhh.parametros_ley', v_id::text,
    jsonb_build_object('codigo', p_codigo, 'anterior', r.valor, 'nuevo', p_valor, 'desde', p_vigente_desde, 'certeza', p_certeza));
  return v_id;
end;
$$;

create or replace function public.planilla_liquidacion_simular(
  p_company_id uuid, p_contrato_id uuid, p_fecha_egreso date, p_causa text,
  p_dias_vacaciones numeric, p_dias_salario_pendiente numeric default 0, p_meses_confianza numeric default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.calcular');
  c record;
  r rrhh.contrato_regimen;
begin
  select ct.id, ct.estado, ct.fecha_inicio, ct.fecha_antiguedad, ct.fecha_fin_prevista, cc.salario_base into c
  from rrhh.contratos ct left join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id
  where ct.id = p_contrato_id and ct.company_id = p_company_id;
  if not found or c.estado not in ('activo', 'finalizado') then
    raise exception 'Contrato no encontrado o no vigente.';
  end if;
  if p_fecha_egreso is null or c.fecha_inicio is null or p_fecha_egreso < c.fecha_inicio then
    raise exception 'La fecha de egreso debe ser posterior al inicio del contrato.';
  end if;
  select * into r from rrhh.contrato_regimen cr where cr.contrato_id = p_contrato_id and cr.vigente_desde <= p_fecha_egreso
    and (cr.vigente_hasta is null or cr.vigente_hasta >= p_fecha_egreso);
  if not found then
    raise exception 'El contrato no tiene régimen de contratación vigente a esa fecha.';
  end if;
  return rrhh.fn_liquidacion_calcular(p_company_id, c.salario_base, coalesce(c.fecha_antiguedad, c.fecha_inicio),
    p_fecha_egreso, p_causa, c.fecha_fin_prevista is null, p_dias_vacaciones, p_dias_salario_pendiente,
    p_meses_confianza, r.paga_vacaciones, r.paga_aguinaldo, r.paga_indemnizacion)
    || jsonb_build_object('contrato_id', p_contrato_id, 'regimen', r.regimen);
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Régimen inicial de los contratos activos (decisión del usuario 2026-10-21)
-- -----------------------------------------------------------------------------
insert into rrhh.contrato_regimen (company_id, contrato_id, empleado_id, regimen, regimen_inss, metodo_ir, porcentaje_ir,
  paga_vacaciones, paga_aguinaldo, paga_indemnizacion, vigente_desde, motivo)
select c.company_id, c.id, c.empleado_id, 'servicios_profesionales', 'ninguno', 'exento', null, true, true, true,
       coalesce(c.fecha_inicio, date '2026-01-01'),
       'Carga inicial PL2a: igual que AG ("Free-lance", sin INSS ni IR, con prestaciones). Decisión del usuario 2026-10-21; lo confirma el contador.'
from rrhh.contratos c
where c.estado = 'activo'
  and not exists (select 1 from rrhh.contrato_regimen r where r.contrato_id = c.id);

-- -----------------------------------------------------------------------------
-- 14. Privilegios de funciones
-- -----------------------------------------------------------------------------
revoke all on function
  rrhh.fn_asegurar_particion_planilla_lineas(date), rrhh.fn_asegurar_particion_novedades(date),
  rrhh.fn_planilla_parametro(uuid, text, date), rrhh.fn_planilla_ir_anual(uuid, numeric, date),
  rrhh.fn_planilla_dia_comercial(date, numeric),
  rrhh.fn_planilla_contratos(uuid), rrhh.fn_planilla_novedades(uuid),
  rrhh.fn_planilla_huella_insumos(uuid), rrhh.fn_planilla_huella_lineas(uuid),
  rrhh.fn_planilla_linea(uuid, text, numeric, text, numeric, numeric, numeric, text, uuid[], jsonb),
  rrhh.fn_planilla_calcular_nucleo(uuid, uuid),
  rrhh.fn_liquidacion_calcular(uuid, numeric, date, date, text, boolean, numeric, numeric, numeric, boolean, boolean, boolean),
  rrhh.fn_planilla_proteger(), rrhh.fn_planilla_detalle_proteger(), rrhh.fn_contrato_antiguedad_proteger(),
  rrhh.fn_crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric, text),
  rrhh.fn_editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text)
from public, anon, authenticated;

revoke all on function
  public.planilla_crear(uuid, uuid, date, date, date, uuid),
  public.planilla_calcular(uuid, uuid),
  public.planilla_aprobar(uuid, uuid),
  public.planilla_pagar(uuid, uuid, text, text, date),
  public.planilla_anular(uuid, uuid, text),
  public.planilla_novedad_crear(uuid, uuid, uuid, date, numeric, numeric, text, uuid, uuid),
  public.planilla_novedad_anular(uuid, uuid),
  public.planilla_regimen_cambiar(uuid, uuid, text, text, text, numeric, boolean, boolean, boolean, date, text),
  public.planilla_regimen_aviso_descartar(uuid, uuid, text),
  public.planilla_contrato_antiguedad_fijar(uuid, uuid, date, text),
  public.planilla_parametro_vigencia_nueva(uuid, text, numeric, date, text, text),
  public.planilla_liquidacion_simular(uuid, uuid, date, text, numeric, numeric, numeric),
  public.crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric, text),
  public.editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text)
from public, anon;
grant execute on function
  public.planilla_crear(uuid, uuid, date, date, date, uuid),
  public.planilla_calcular(uuid, uuid),
  public.planilla_aprobar(uuid, uuid),
  public.planilla_pagar(uuid, uuid, text, text, date),
  public.planilla_anular(uuid, uuid, text),
  public.planilla_novedad_crear(uuid, uuid, uuid, date, numeric, numeric, text, uuid, uuid),
  public.planilla_novedad_anular(uuid, uuid),
  public.planilla_regimen_cambiar(uuid, uuid, text, text, text, numeric, boolean, boolean, boolean, date, text),
  public.planilla_regimen_aviso_descartar(uuid, uuid, text),
  public.planilla_contrato_antiguedad_fijar(uuid, uuid, date, text),
  public.planilla_parametro_vigencia_nueva(uuid, text, numeric, date, text, text),
  public.planilla_liquidacion_simular(uuid, uuid, date, text, numeric, numeric, numeric),
  public.crear_contrato(uuid, uuid, uuid, uuid, uuid, text, date, numeric, text),
  public.editar_contrato(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- 15. Poscheques
-- -----------------------------------------------------------------------------
do $$
declare
  e record;
  v_tablas text[] := array['ir_tramos', 'contrato_regimen', 'planilla_tipos', 'conceptos', 'planilla_empleados',
                           'planilla_lineas', 'novedades', 'planillas', 'planilla_detalles', 'parametros_ley'];
  v_t text;
  v_f text;
begin
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 25 then
    raise exception 'postcheck: cambió el número de permisos de planillas';
  end if;
  for e in select distinct company_id from rrhh.parametros_ley where codigo = 'inss_laboral' loop
    if rrhh.fn_planilla_parametro(e.company_id, 'inss_patronal', date '2026-10-15') <> 0.215 then
      raise exception 'postcheck: el INSS patronal vigente no es 21.5%%';
    end if;
    if (select count(*) from rrhh.feriados f where f.company_id = e.company_id and f.fecha between '2026-01-01' and '2026-12-31') <> 14 then
      raise exception 'postcheck: se esperaban 14 feriados de 2026';
    end if;
    if exists (select 1 from (select it.desde, lag(it.hasta) over (order by it.desde) prev
                              from rrhh.ir_tramos it where it.company_id = e.company_id and it.vigente_hasta is null) x
               where x.prev is not null and x.desde <> x.prev + 0.01)
       or (select count(*) from rrhh.ir_tramos it where it.company_id = e.company_id and it.vigente_hasta is null and it.hasta is null) <> 1 then
      raise exception 'postcheck: la tabla de IR tiene huecos o más de un tramo final';
    end if;
  end loop;
  if exists (select 1 from rrhh.contratos c where c.estado = 'activo'
             and not exists (select 1 from rrhh.contrato_regimen r where r.contrato_id = c.id and r.vigente_hasta is null)) then
    raise exception 'postcheck: hay contratos activos sin régimen';
  end if;
  if exists (select 1 from rrhh.contrato_compensacion cc join rrhh.contratos c on c.id = cc.contrato_id
             where c.estado in ('borrador', 'activo') and cc.frecuencia_pago <> 'quincenal') then
    raise exception 'postcheck: hay contratos activos o en borrador que no quedaron en frecuencia quincenal';
  end if;
  if (select count(*) from core.tablas_particionadas where schema_nombre = 'rrhh' and tabla_nombre in ('planilla_lineas', 'novedades')) <> 2 then
    raise exception 'postcheck: faltan tablas en core.tablas_particionadas';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'rrhh' and c.relkind in ('r', 'p')
               and (c.relname = any (v_tablas) or c.relname like 'planilla\_lineas\_%' or c.relname like 'novedades\_%')
               and not c.relrowsecurity) then
    raise exception 'postcheck: hay una tabla o partición de planilla sin RLS';
  end if;
  foreach v_t in array v_tablas loop
    if has_table_privilege('authenticated', 'rrhh.' || v_t, 'INSERT') or has_table_privilege('authenticated', 'rrhh.' || v_t, 'UPDATE')
       or has_table_privilege('authenticated', 'rrhh.' || v_t, 'DELETE') or has_table_privilege('anon', 'rrhh.' || v_t, 'SELECT') then
      raise exception 'postcheck: privilegio de escritura o de anon en rrhh.%', v_t;
    end if;
  end loop;
  foreach v_f in array array['public.planilla_crear(uuid,uuid,date,date,date,uuid)', 'public.planilla_calcular(uuid,uuid)',
      'public.planilla_aprobar(uuid,uuid)', 'public.planilla_pagar(uuid,uuid,text,text,date)', 'public.planilla_anular(uuid,uuid,text)',
      'public.planilla_novedad_crear(uuid,uuid,uuid,date,numeric,numeric,text,uuid,uuid)', 'public.planilla_novedad_anular(uuid,uuid)',
      'public.planilla_regimen_cambiar(uuid,uuid,text,text,text,numeric,boolean,boolean,boolean,date,text)',
      'public.planilla_regimen_aviso_descartar(uuid,uuid,text)',
      'public.planilla_contrato_antiguedad_fijar(uuid,uuid,date,text)',
      'public.planilla_parametro_vigencia_nueva(uuid,text,numeric,date,text,text)',
      'public.planilla_liquidacion_simular(uuid,uuid,date,text,numeric,numeric,numeric)',
      'public.crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric,text)',
      'public.editar_contrato(uuid,uuid,uuid,uuid,uuid,text,date,date,numeric,text)'] loop
    if has_function_privilege('anon', v_f, 'EXECUTE') or not has_function_privilege('authenticated', v_f, 'EXECUTE') then
      raise exception 'postcheck: EXECUTE incorrecto en %', v_f;
    end if;
  end loop;
  foreach v_f in array array['rrhh.fn_planilla_calcular_nucleo(uuid,uuid)', 'rrhh.fn_planilla_parametro(uuid,text,date)',
      'rrhh.fn_planilla_ir_anual(uuid,numeric,date)', 'rrhh.fn_planilla_dia_comercial(date,numeric)',
      'rrhh.fn_planilla_contratos(uuid)', 'rrhh.fn_planilla_novedades(uuid)',
      'rrhh.fn_planilla_huella_insumos(uuid)', 'rrhh.fn_planilla_huella_lineas(uuid)',
      'rrhh.fn_planilla_linea(uuid,text,numeric,text,numeric,numeric,numeric,text,uuid[],jsonb)',
      'rrhh.fn_liquidacion_calcular(uuid,numeric,date,date,text,boolean,numeric,numeric,numeric,boolean,boolean,boolean)',
      'rrhh.fn_asegurar_particion_planilla_lineas(date)', 'rrhh.fn_asegurar_particion_novedades(date)',
      'rrhh.fn_crear_contrato(uuid,uuid,uuid,uuid,uuid,text,date,numeric,text)',
      'rrhh.fn_editar_contrato(uuid,uuid,uuid,uuid,uuid,text,date,date,numeric,text)'] loop
    if has_function_privilege('authenticated', v_f, 'EXECUTE') or has_function_privilege('anon', v_f, 'EXECUTE') then
      raise exception 'postcheck: el núcleo % es ejecutable por la API', v_f;
    end if;
  end loop;
end;
$$;
