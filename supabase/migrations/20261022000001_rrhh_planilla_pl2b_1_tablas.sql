-- =============================================================================
-- PL2b de Planilla (docs/plan/20-planilla.md §7 y §10): prestaciones.
-- Parte 1 de 5: tablas, conceptos, RLS y funciones de apoyo. Partes 2 a 5:
-- motor, liquidación pura, RPC de PL2a y vacaciones, y préstamos, embargos,
-- liquidaciones y pasivo. Se dividió para aplicarla en nexo-core por partes.
--
-- Qué hace:
--   1. Vacaciones con movimientos (saldo inicial, goce, pago, ajuste y
--      liquidación). El saldo se calcula: 2.5 días por mes mientras el régimen
--      las lleve, menos lo gozado, pagado y liquidado. Nunca se escribe a mano.
--   2. Préstamos y adelantos: cada cuota es una novedad (concepto PRESTAMO o
--      ADELANTO) con prestamo_id en la fecha de fin de cada período. Una cuota
--      que no cabe en el neto queda pendiente con aviso y se cobra en la
--      siguiente planilla.
--   3. Embargos (alimentos y judicial): el motor los descuenta después del IR,
--      alimentos primero; si el neto no alcanza, se corta y se avisa.
--   4. Planilla de aguinaldo (clase 'aguinaldo', anual): días × diario actual,
--      sin deducciones (art. 97). Período según aguinaldo_mes_inicio.
--   5. Liquidación como documento: calculada → aprobada → pagada, o anulada.
--      Vacaciones del saldo, préstamos pendientes descontados (nunca del
--      aguinaldo), aprueba otra persona y al aprobar se finaliza el contrato.
--   6. Pasivo laboral vivo por contrato y copia mensual (rrhh.provisiones,
--      particionada por mes).
--   Saldos iniciales de AG: saldo_inicial de vacaciones y préstamos con origen
--   'ag'. El aguinaldo y la indemnización salen de las fechas.
--
-- Por qué y aprobación: el usuario pidió el 2026-10-21 "dejar toda la app
-- terminada" y aprobó aplicar cada migración en nexo-core al pasar las pruebas
-- en PGlite, la revisión independiente y un ensayo revertido. Decisiones del
-- motor vigentes: plan 20 §3.1 (aguinaldo ene–dic, salario actual, quien
-- calcula no aprueba). Permisos: Paso Cero 20261022000001 (27 códigos).
--
-- Particiones (regla de CLAUDE.md y decisión del usuario del 2026-10-21:
-- "Provisiones y vacaciones"; las cuotas de préstamo no): provisiones y
-- vacaciones_movimientos nacen particionadas por mes. Las cuotas de préstamo
-- no son tabla propia: viven en novedades, que ya está particionada.
-- prestamos, embargos, liquidaciones y liquidacion_lineas no se particionan:
-- son documentos con ciclo de estados y FK entrantes, de volumen acotado
-- (unas pocas filas por persona en toda su relación laboral).
--
-- Rollback (antes de uso; en orden):
--   drop function public.planilla_vacaciones_registrar(uuid,uuid,text,date,date,numeric,text),
--     public.planilla_vacaciones_aprobar(uuid,uuid), public.planilla_vacaciones_rechazar(uuid,uuid,text),
--     public.planilla_vacaciones_anular(uuid,uuid,text), public.planilla_vacaciones_saldos(uuid,date),
--     public.planilla_vacaciones_movimientos(uuid,uuid,text),
--     public.planilla_prestamo_crear(uuid,uuid,text,numeric,integer,date,text,text),
--     public.planilla_prestamo_anular(uuid,uuid,text), public.planilla_prestamo_cancelar(uuid,uuid,text),
--     public.planilla_prestamos_saldos(uuid), public.planilla_prestamo_cuotas(uuid,uuid),
--     public.planilla_embargo_crear(uuid,uuid,text,text,numeric,numeric,text,date,date,text),
--     public.planilla_embargo_terminar(uuid,uuid,date,text), public.planilla_embargos_saldos(uuid),
--     public.planilla_liquidacion_crear(uuid,uuid,date,text,numeric,numeric,text),
--     public.planilla_liquidacion_recalcular(uuid,uuid), public.planilla_liquidacion_aprobar(uuid,uuid),
--     public.planilla_liquidacion_pagar(uuid,uuid,text,text,date), public.planilla_liquidacion_anular(uuid,uuid,text),
--     public.planilla_liquidaciones_listado(uuid), public.planilla_liquidacion_detalle(uuid,uuid),
--     public.planilla_pasivo_laboral(uuid,date), public.planilla_provisiones_generar(uuid,date),
--     rrhh.fn_planilla_prestamo_crear(uuid,uuid,uuid,text,numeric,integer,date,text,text,date);
--   Restaurar desde 20261021191441 planilla_regimen_cambiar y planilla_parametro_vigencia_nueva.
--   Restaurar desde 20261021191441 las versiones anteriores de: planilla_crear, planilla_anular,
--     planilla_novedad_crear, planilla_novedad_anular, planilla_liquidacion_simular,
--     fn_planilla_contratos, fn_planilla_novedades (drop + create), fn_planilla_huella_insumos,
--     fn_planilla_calcular_nucleo y fn_liquidacion_calcular (drop de la de 13 argumentos + create).
--   drop function rrhh.fn_planilla_calcular_aguinaldo(uuid,uuid), rrhh.fn_liquidacion_preparar(uuid,uuid,date,text,numeric,numeric,numeric,boolean,uuid),
--     rrhh.fn_planilla_pasivo(uuid,date), rrhh.fn_vacaciones_saldo(uuid,date),
--     rrhh.fn_planilla_meses_regimen(uuid,date,date,text,numeric), rrhh.fn_planilla_aguinaldo_dias(uuid,date,date),
--     rrhh.fn_planilla_aguinaldo_periodo(uuid,date), rrhh.fn_planilla_fin_periodo(date,text),
--     rrhh.fn_meses_comerciales(date,date,numeric), rrhh.fn_asegurar_particion_provisiones(date),
--     rrhh.fn_asegurar_particion_vacaciones_movimientos(date),
--     rrhh.fn_liquidacion_proteger(), rrhh.fn_liquidacion_lineas_proteger();
--   delete from core.tablas_particionadas where schema_nombre = 'rrhh' and tabla_nombre in ('provisiones', 'vacaciones_movimientos');
--   alter table rrhh.novedades drop column prestamo_id, drop column vacaciones_movimiento_id,
--     drop column liquidacion_id, drop column cuota_numero;  (y restaurar los checks de origen)
--   drop table rrhh.provisiones, rrhh.liquidacion_lineas, rrhh.vacaciones_movimientos, rrhh.embargos,
--     rrhh.prestamos, rrhh.liquidaciones;
--   delete from rrhh.conceptos where codigo in ('PRESTAMO','EMBARGO_ALIMENTOS','EMBARGO_JUDICIAL','VACACIONES_PAGADAS','AGUINALDO');
--   delete from rrhh.planilla_tipos where clase = 'aguinaldo';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechequeo
-- -----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from core.permissions_catalog where code like 'rrhh.planillas.%') <> 27 then
    raise exception 'precheck: falta el Paso Cero de PL2b (27 permisos de planillas)';
  end if;
  if to_regclass('rrhh.planilla_lineas') is null or to_regclass('rrhh.novedades') is null
     or to_regprocedure('rrhh.fn_planilla_calcular_nucleo(uuid,uuid)') is null then
    raise exception 'precheck: falta PL2a';
  end if;
  if to_regclass('rrhh.vacaciones_movimientos') is not null or to_regclass('rrhh.prestamos') is not null
     or to_regclass('rrhh.embargos') is not null or to_regclass('rrhh.liquidaciones') is not null
     or to_regclass('rrhh.liquidacion_lineas') is not null or to_regclass('rrhh.provisiones') is not null then
    raise exception 'precheck: alguna tabla de PL2b ya existe';
  end if;
  if exists (select 1 from rrhh.planilla_tipos where clase = 'aguinaldo') then
    raise exception 'precheck: ya existe un tipo de planilla de aguinaldo';
  end if;
  if exists (select 1 from rrhh.conceptos where codigo in ('PRESTAMO', 'EMBARGO_ALIMENTOS', 'EMBARGO_JUDICIAL', 'VACACIONES_PAGADAS', 'AGUINALDO')) then
    raise exception 'precheck: algún concepto de PL2b ya existe';
  end if;
  if to_regprocedure('rrhh.fn_finalizar_contrato(uuid,uuid)') is null then
    raise exception 'precheck: falta rrhh.fn_finalizar_contrato';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Conceptos nuevos y tipo de planilla de aguinaldo
-- -----------------------------------------------------------------------------
insert into rrhh.conceptos (company_id, codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec,
  cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, es_ordinario, permite_novedad, es_sistema, orden, articulo)
select e.company_id, x.* from (select distinct company_id from rrhh.conceptos where codigo = 'SALARIO') e
cross join (values
  ('AGUINALDO', 'Aguinaldo', 'devengado', 'sistema', false, false, false, false, false, false, false, false, true, 5, 'CT arts. 93 y 97'),
  -- Vacaciones pagadas sin gozar: INSS, IR e INATEC "verificar" (skill nexo-planilla-legal). Es de sistema:
  -- solo la crea la aprobación de un pago de vacaciones. Si el contador decide otras reglas, se cambian
  -- con una migración, y la planilla muestra el aviso mientras tanto.
  ('VACACIONES_PAGADAS', 'Vacaciones pagadas', 'devengado', 'dias', true, true, true, false, false, false, false, false, true, 25, 'CT art. 78'),
  ('EMBARGO_ALIMENTOS', 'Embargo por alimentos', 'deduccion', 'sistema', false, false, false, false, false, false, false, false, true, 150, 'CT art. 92'),
  ('EMBARGO_JUDICIAL', 'Embargo judicial', 'deduccion', 'sistema', false, false, false, false, false, false, false, false, true, 160, 'CT art. 92'),
  ('PRESTAMO', 'Préstamo de la empresa', 'deduccion', 'fijo', false, false, false, false, false, false, false, false, true, 220, null)
) as x(codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec, cuenta_aguinaldo, cuenta_vacaciones,
       cuenta_indemnizacion, es_ordinario, permite_novedad, es_sistema, orden, articulo);

-- Las cuotas de adelanto usan ADELANTO: pasa a ser de sistema para que nadie
-- cambie sus reglas (sigue admitiendo novedades manuales).
update rrhh.conceptos set es_sistema = true, updated_at = now() where codigo = 'ADELANTO';

insert into rrhh.planilla_tipos (company_id, nombre, clase, frecuencia)
select distinct company_id, 'Aguinaldo', 'aguinaldo', 'anual'
from rrhh.planilla_tipos where clase = 'ordinaria';

-- -----------------------------------------------------------------------------
-- 2. Documentos: vacaciones, préstamos, embargos y liquidaciones
-- -----------------------------------------------------------------------------
create table rrhh.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  contrato_regimen_id uuid not null,
  fecha_egreso date not null,
  causa text not null check (causa in ('despido_sin_causa', 'renuncia', 'mutuo_acuerdo', 'despido_causa_justa',
                                       'confianza', 'vencimiento', 'fallecimiento')),
  meses_confianza numeric(4,2),
  dias_salario_pendiente numeric(6,2) not null default 0 check (dias_salario_pendiente between 0 and 31),
  creada_por uuid not null references auth.users(id),
  salario_mensual numeric(14,2) not null,
  salario_diario numeric(14,4) not null,
  fecha_antiguedad date not null,
  dias_vacaciones numeric(8,4) not null default 0,
  aguinaldo_desde date,
  total_devengado numeric(14,2) not null default 0,
  total_deducciones numeric(14,2) not null default 0,
  neto numeric(14,2) not null default 0,
  avisos text[] not null default '{}',
  resultado jsonb not null default '{}'::jsonb,
  hash_insumos text not null,
  estado text not null default 'calculada' check (estado in ('calculada', 'aprobada', 'pagada', 'anulada')),
  nota text check (nota is null or length(nota) <= 500),
  calculada_por uuid not null references auth.users(id),
  calculada_en timestamptz not null default now(),
  aprobada_por uuid references auth.users(id),
  aprobada_en timestamptz,
  pagada_por uuid references auth.users(id),
  pagada_en timestamptz,
  metodo_pago text check (metodo_pago is null or metodo_pago in ('cheque', 'transferencia')),
  referencia_pago text check (referencia_pago is null or length(referencia_pago) <= 120),
  fecha_pago date,
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  motivo_anulacion text check (motivo_anulacion is null or length(motivo_anulacion) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id),
  foreign key (contrato_regimen_id, company_id) references rrhh.contrato_regimen (id, company_id)
);
create unique index liquidaciones_contrato_viva_unica on rrhh.liquidaciones (contrato_id) where estado <> 'anulada';
create index liquidaciones_company_egreso_idx on rrhh.liquidaciones (company_id, fecha_egreso);
create index liquidaciones_empleado_idx on rrhh.liquidaciones (empleado_id, fecha_egreso);
create index liquidaciones_regimen_idx on rrhh.liquidaciones (contrato_regimen_id);
create index liquidaciones_calculada_por_idx on rrhh.liquidaciones (calculada_por);
create index liquidaciones_aprobada_por_idx on rrhh.liquidaciones (aprobada_por);
create index liquidaciones_pagada_por_idx on rrhh.liquidaciones (pagada_por);
create index liquidaciones_anulada_por_idx on rrhh.liquidaciones (anulada_por);
comment on table rrhh.liquidaciones is
  'Liquidación final de un contrato (arts. 42, 43, 45, 47, 48, 76, 93, 97). calculada → aprobada → pagada, o anulada. Quien calcula no aprueba. hash_insumos es la huella del cálculo: aprobar la recalcula y rechaza si cambió. Escritura solo por RPC.';

create table rrhh.liquidacion_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  liquidacion_id uuid not null,
  concepto text not null,
  nombre text not null,
  tipo text not null check (tipo in ('devengado', 'deduccion')),
  dias numeric(10,4),
  diario numeric(14,4),
  monto numeric(14,2) not null check (monto >= 0),
  articulo text,
  orden integer not null,
  origen_id uuid,
  foreign key (liquidacion_id, company_id) references rrhh.liquidaciones (id, company_id) on delete cascade
);
create index liquidacion_lineas_liquidacion_idx on rrhh.liquidacion_lineas (liquidacion_id, orden);
create index liquidacion_lineas_company_idx on rrhh.liquidacion_lineas (company_id);

-- Particionada por mes de fecha_inicio (decisión del usuario del 2026-10-21:
-- "Provisiones y vacaciones"). Por eso nadie le apunta con FK (exigiría la
-- clave de partición) y el saldo inicial único se controla en la RPC con el
-- contrato bloqueado.
create table rrhh.vacaciones_movimientos (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  tipo text not null check (tipo in ('saldo_inicial', 'goce', 'pago', 'ajuste', 'liquidacion')),
  fecha_inicio date not null,
  fecha_fin date not null,
  dias numeric(8,4) not null,
  estado text not null default 'solicitada' check (estado in ('solicitada', 'aprobada', 'rechazada', 'anulada')),
  motivo text check (motivo is null or length(motivo) <= 500),
  registrado_por uuid references auth.users(id),
  registrado_en timestamptz not null default now(),
  aprobado_por uuid references auth.users(id),
  aprobado_en timestamptz,
  rechazo_motivo text check (rechazo_motivo is null or length(rechazo_motivo) <= 500),
  anulado_por uuid references auth.users(id),
  anulado_en timestamptz,
  liquidacion_id uuid,
  novedad_id uuid,
  novedad_fecha date,
  updated_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio),
  check ((tipo = 'ajuste' and dias <> 0) or (tipo <> 'ajuste' and dias >= 0)),
  check ((tipo = 'liquidacion') = (liquidacion_id is not null)),
  primary key (id, fecha_inicio),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id),
  foreign key (liquidacion_id, company_id) references rrhh.liquidaciones (id, company_id)
) partition by range (fecha_inicio);
create index vacaciones_movimientos_id_idx on rrhh.vacaciones_movimientos (id);
create index vacaciones_movimientos_contrato_idx on rrhh.vacaciones_movimientos (contrato_id, fecha_inicio);
create index vacaciones_movimientos_company_idx on rrhh.vacaciones_movimientos (company_id, fecha_inicio);
create index vacaciones_movimientos_empleado_idx on rrhh.vacaciones_movimientos (empleado_id);
create index vacaciones_movimientos_pendientes_idx on rrhh.vacaciones_movimientos (company_id) where estado = 'solicitada';
create index vacaciones_movimientos_liquidacion_idx on rrhh.vacaciones_movimientos (liquidacion_id);
create index vacaciones_movimientos_registrado_por_idx on rrhh.vacaciones_movimientos (registrado_por);
create index vacaciones_movimientos_aprobado_por_idx on rrhh.vacaciones_movimientos (aprobado_por);
create index vacaciones_movimientos_anulado_por_idx on rrhh.vacaciones_movimientos (anulado_por);
comment on table rrhh.vacaciones_movimientos is
  'Movimientos de vacaciones: saldo_inicial (traído de AG a una fecha de corte), goce, pago (crea la novedad VACACIONES_PAGADAS), ajuste (con signo) y liquidacion. Solo cuentan los aprobados. El saldo lo calcula rrhh.fn_vacaciones_saldo; nunca se escribe. Particionada por mes de fecha_inicio.';

create or replace function rrhh.fn_asegurar_particion_vacaciones_movimientos(p_mes date)
returns void language plpgsql set search_path = '' as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_particion text := 'vacaciones_movimientos_' || to_char(v_inicio, 'YYYY_MM');
begin
  if to_regclass('rrhh.' || v_particion) is null then
    execute format('create table rrhh.%I partition of rrhh.vacaciones_movimientos for values from (%L) to (%L)',
      v_particion, v_inicio, (v_inicio + interval '1 month')::date);
    execute format('alter table rrhh.%I enable row level security', v_particion);
    execute format('revoke all on table rrhh.%I from public, anon, authenticated', v_particion);
  end if;
end;
$$;

create table rrhh.prestamos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  tipo text not null check (tipo in ('prestamo', 'adelanto')),
  origen text not null default 'nexo' check (origen in ('nexo', 'ag')),
  monto numeric(14,2) not null check (monto > 0),
  cuotas integer not null check (cuotas between 1 and 120),
  monto_cuota numeric(14,2) not null check (monto_cuota > 0),
  fecha_primera date not null,
  frecuencia text not null check (frecuencia in ('mensual', 'quincenal', 'semanal')),
  estado text not null default 'activo' check (estado in ('activo', 'cancelado', 'anulado')),
  nota text check (nota is null or length(nota) <= 300),
  registrado_por uuid references auth.users(id),
  cerrado_por uuid references auth.users(id),
  cerrado_en timestamptz,
  motivo_cierre text check (motivo_cierre is null or length(motivo_cierre) <= 500),
  liquidacion_id uuid,
  monto_liquidado numeric(14,2) check (monto_liquidado is null or monto_liquidado >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id),
  foreign key (liquidacion_id, company_id) references rrhh.liquidaciones (id, company_id)
);
comment on column rrhh.prestamos.monto_liquidado is
  'Lo que la liquidación descontó del saldo. Si fue menos que las cuotas pendientes (tope del art. 97), la diferencia queda condonada.';
create index prestamos_contrato_idx on rrhh.prestamos (contrato_id);
create index prestamos_company_idx on rrhh.prestamos (company_id, created_at);
create index prestamos_empleado_idx on rrhh.prestamos (empleado_id);
create index prestamos_activos_idx on rrhh.prestamos (company_id) where estado = 'activo';
create index prestamos_liquidacion_idx on rrhh.prestamos (liquidacion_id);
create index prestamos_registrado_por_idx on rrhh.prestamos (registrado_por);
create index prestamos_cerrado_por_idx on rrhh.prestamos (cerrado_por);
comment on table rrhh.prestamos is
  'Préstamos y adelantos. Las cuotas son novedades con prestamo_id (concepto PRESTAMO o ADELANTO). Saldo = cuotas no aplicadas en planillas aprobadas ni saldadas en liquidación. origen ag = saldo traído de AG.';

create table rrhh.embargos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  tipo text not null check (tipo in ('alimentos', 'judicial')),
  metodo text not null check (metodo in ('porcentaje', 'monto')),
  valor numeric(14,4) not null check (valor > 0),
  tope_total numeric(14,2) check (tope_total is null or tope_total > 0),
  referencia text not null check (length(btrim(referencia)) between 3 and 200),
  vigente_desde date not null,
  vigente_hasta date,
  estado text not null default 'activo' check (estado in ('activo', 'terminado', 'anulado')),
  nota text check (nota is null or length(nota) <= 300),
  registrado_por uuid references auth.users(id),
  terminado_por uuid references auth.users(id),
  terminado_en timestamptz,
  motivo_termino text check (motivo_termino is null or length(motivo_termino) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (metodo <> 'porcentaje' or valor <= 1),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde),
  unique (id, company_id),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id)
);
create index embargos_contrato_idx on rrhh.embargos (contrato_id, vigente_desde);
create index embargos_company_idx on rrhh.embargos (company_id, vigente_desde);
create index embargos_empleado_idx on rrhh.embargos (empleado_id);
create index embargos_registrado_por_idx on rrhh.embargos (registrado_por);
create index embargos_terminado_por_idx on rrhh.embargos (terminado_por);
comment on table rrhh.embargos is
  'Órdenes de embargo. metodo porcentaje: valor 0–1 sobre devengado − INSS − IR; metodo monto: monto mensual, prorrateado por los días de vigencia dentro del período. tope_total = monto total de la orden. El motor descuenta alimentos primero, corta si el neto no alcanza e ignora los anulados.';

-- Cuotas de préstamo, pago de vacaciones y saldos de liquidación sobre novedades.
alter table rrhh.novedades
  add column prestamo_id uuid,
  add column cuota_numero integer check (cuota_numero is null or cuota_numero between 1 and 120),
  add column vacaciones_movimiento_id uuid,
  add column liquidacion_id uuid;
alter table rrhh.novedades add constraint novedades_prestamo_fk
  foreign key (prestamo_id, company_id) references rrhh.prestamos (id, company_id);
-- vacaciones_movimiento_id va sin FK: vacaciones_movimientos está particionada.
alter table rrhh.novedades add constraint novedades_liquidacion_fk
  foreign key (liquidacion_id, company_id) references rrhh.liquidaciones (id, company_id);
alter table rrhh.novedades drop constraint novedades_origen_check;
alter table rrhh.novedades add constraint novedades_origen_check
  check (origen in ('manual', 'excel', 'asistencia', 'prestamo', 'vacaciones'));
alter table rrhh.novedades add constraint novedades_origen_coherente check (
  (origen = 'prestamo') = (prestamo_id is not null) and (origen = 'vacaciones') = (vacaciones_movimiento_id is not null));
create index novedades_prestamo_idx on rrhh.novedades (prestamo_id);
create index novedades_vacaciones_idx on rrhh.novedades (vacaciones_movimiento_id);
create index novedades_liquidacion_idx on rrhh.novedades (liquidacion_id);
create index novedades_cuotas_pendientes_idx on rrhh.novedades (company_id, contrato_id, fecha)
  where prestamo_id is not null and estado = 'pendiente';
comment on column rrhh.novedades.liquidacion_id is
  'Cuota de préstamo saldada en esa liquidación (estado anulada). Si la liquidación se anula, vuelve a pendiente.';

alter table rrhh.planilla_lineas drop constraint planilla_lineas_origen_check;
alter table rrhh.planilla_lineas add constraint planilla_lineas_origen_check
  check (origen in ('sistema', 'novedad', 'embargo'));

-- Copia mensual del pasivo laboral por contrato (hecho mensual: particionada).
create table rrhh.provisiones (
  id uuid not null default gen_random_uuid(),
  mes date not null,
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null,
  empleado_id uuid not null,
  fecha_corte date not null,
  salario_mensual numeric(14,2) not null,
  salario_diario numeric(14,4) not null,
  vacaciones_dias numeric(10,4) not null,
  vacaciones_monto numeric(14,2) not null,
  aguinaldo_dias numeric(10,4) not null,
  aguinaldo_monto numeric(14,2) not null,
  indemnizacion_dias numeric(10,4) not null,
  indemnizacion_monto numeric(14,2) not null,
  total numeric(14,2) not null,
  generado_por uuid references auth.users(id),
  generado_en timestamptz not null default now(),
  primary key (id, mes),
  unique (company_id, contrato_id, mes),
  check (mes = date_trunc('month', mes)::date),
  foreign key (contrato_id, company_id, empleado_id) references rrhh.contratos (id, company_id, empleado_id)
) partition by range (mes);
create index provisiones_company_mes_idx on rrhh.provisiones (company_id, mes);
create index provisiones_contrato_idx on rrhh.provisiones (contrato_id, mes);
create index provisiones_empleado_idx on rrhh.provisiones (empleado_id);
create index provisiones_generado_por_idx on rrhh.provisiones (generado_por);
comment on table rrhh.provisiones is
  'Copia mensual del pasivo laboral por contrato (vacaciones, aguinaldo e indemnización: días × diario actual). La genera public.planilla_provisiones_generar; el pasivo vivo sale de rrhh.fn_planilla_pasivo. Particionada por mes.';

create or replace function rrhh.fn_asegurar_particion_provisiones(p_mes date)
returns void language plpgsql set search_path = '' as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_particion text := 'provisiones_' || to_char(v_inicio, 'YYYY_MM');
begin
  if to_regclass('rrhh.' || v_particion) is null then
    execute format('create table rrhh.%I partition of rrhh.provisiones for values from (%L) to (%L)',
      v_particion, v_inicio, (v_inicio + interval '1 month')::date);
    execute format('alter table rrhh.%I enable row level security', v_particion);
    execute format('revoke all on table rrhh.%I from public, anon, authenticated', v_particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('rrhh', 'provisiones', 'rrhh.fn_asegurar_particion_provisiones'),
  ('rrhh', 'vacaciones_movimientos', 'rrhh.fn_asegurar_particion_vacaciones_movimientos');

-- Desde enero de 2026; las RPC crean la partición de un mes anterior (por
-- ejemplo, un saldo inicial con fecha de corte de 2025) cuando hace falta.
do $$
declare m date := date '2026-01-01';
begin
  while m <= date_trunc('month', now())::date loop
    perform rrhh.fn_asegurar_particion_provisiones(m);
    perform rrhh.fn_asegurar_particion_vacaciones_movimientos(m);
    m := (m + interval '1 month')::date;
  end loop;
end;
$$;
select core.fn_asegurar_particiones_futuras(3);

-- -----------------------------------------------------------------------------
-- 3. RLS, policies de lectura y grants
-- -----------------------------------------------------------------------------
alter table rrhh.liquidaciones enable row level security;
alter table rrhh.liquidacion_lineas enable row level security;
alter table rrhh.vacaciones_movimientos enable row level security;
alter table rrhh.prestamos enable row level security;
alter table rrhh.embargos enable row level security;
alter table rrhh.provisiones enable row level security;

create policy "liquidaciones: ver con permiso" on rrhh.liquidaciones for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.liquidaciones.ver'));
create policy "liquidacion_lineas: ver con permiso" on rrhh.liquidacion_lineas for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.liquidaciones.ver'));
create policy "vacaciones_movimientos: ver con permiso" on rrhh.vacaciones_movimientos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.vacaciones.ver'));
create policy "prestamos: ver con permiso" on rrhh.prestamos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.prestamos.ver'));
create policy "embargos: ver con permiso" on rrhh.embargos for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.prestamos.ver'));
create policy "provisiones: ver con permiso" on rrhh.provisiones for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.ver'));

revoke all on rrhh.liquidaciones, rrhh.liquidacion_lineas, rrhh.vacaciones_movimientos, rrhh.prestamos,
  rrhh.embargos, rrhh.provisiones from public, anon, authenticated;
grant select on rrhh.liquidaciones, rrhh.liquidacion_lineas, rrhh.vacaciones_movimientos, rrhh.prestamos,
  rrhh.embargos, rrhh.provisiones to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Funciones de apoyo (sin EXECUTE para la API)
-- -----------------------------------------------------------------------------
-- Meses comerciales entre dos fechas con la convención de la liquidación
-- (age(hasta, desde): meses + días / 30). 0 si hasta < desde.
create or replace function rrhh.fn_meses_comerciales(p_desde date, p_hasta date, p_dias_mes numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_desde is null or p_hasta is null or p_hasta < p_desde then 0::numeric
              else extract(year from age(p_hasta, p_desde)) * 12 + extract(month from age(p_hasta, p_desde))
                   + extract(day from age(p_hasta, p_desde)) / p_dias_mes end
$$;

-- Fin del período de pago que contiene la fecha (cuotas de préstamo).
create or replace function rrhh.fn_planilla_fin_periodo(p_fecha date, p_frecuencia text)
returns date language sql immutable set search_path = '' as $$
  select case p_frecuencia
    when 'quincenal' then case when extract(day from p_fecha) <= 15
                               then make_date(extract(year from p_fecha)::int, extract(month from p_fecha)::int, 15)
                               else (date_trunc('month', p_fecha::timestamp) + interval '1 month - 1 day')::date end
    when 'mensual' then (date_trunc('month', p_fecha::timestamp) + interval '1 month - 1 day')::date
    else (date_trunc('week', p_fecha::timestamp) + interval '6 days')::date end
$$;

-- Período del aguinaldo que contiene la fecha (aguinaldo_mes_inicio; hoy enero).
create or replace function rrhh.fn_planilla_aguinaldo_periodo(p_company_id uuid, p_fecha date)
returns table (ini date, fin date) language plpgsql stable security definer set search_path = '' as $$
declare
  v_mes integer := rrhh.fn_planilla_parametro(p_company_id, 'aguinaldo_mes_inicio', p_fecha)::int;
begin
  ini := make_date(extract(year from p_fecha)::int, v_mes, 1);
  if ini > p_fecha then
    ini := (ini - interval '1 year')::date;
  end if;
  fin := (ini + interval '1 year' - interval '1 day')::date;
  return next;
end;
$$;

-- Meses del tramo en que el régimen del contrato lleva la prestación. Un
-- cambio de régimen corta el tramo en su fecha efectiva.
create or replace function rrhh.fn_planilla_meses_regimen(p_contrato_id uuid, p_desde date, p_hasta date,
  p_prestacion text, p_dias_mes numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(rrhh.fn_meses_comerciales(greatest(p_desde, r.vigente_desde),
           case when r.vigente_hasta is not null and r.vigente_hasta < p_hasta then r.vigente_hasta + 1 else p_hasta end,
           p_dias_mes)), 0)
  from rrhh.contrato_regimen r
  where r.contrato_id = p_contrato_id and r.vigente_desde <= p_hasta
    and (r.vigente_hasta is null or r.vigente_hasta >= p_desde)
    and case p_prestacion when 'vacaciones' then r.paga_vacaciones
                          when 'aguinaldo' then r.paga_aguinaldo
                          else r.paga_indemnizacion end
$$;

-- Días de aguinaldo de un contrato en un tramo (sin redondeo de días a enteros).
create or replace function rrhh.fn_planilla_aguinaldo_dias(p_contrato_id uuid, p_desde date, p_hasta date)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  v_company uuid;
  v_dias_mes numeric;
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    return 0;
  end if;
  select company_id into v_company from rrhh.contratos where id = p_contrato_id;
  v_dias_mes := rrhh.fn_planilla_parametro(v_company, 'dias_mes_comercial', p_hasta);
  return round(rrhh.fn_planilla_meses_regimen(p_contrato_id, p_desde, p_hasta, 'aguinaldo', v_dias_mes)
               * rrhh.fn_planilla_parametro(v_company, 'aguinaldo_dias_por_mes', p_hasta), 4);
end;
$$;

-- Saldo de vacaciones a una fecha: saldo inicial aprobado (o 0 desde el inicio
-- del contrato) + días por mes mientras el régimen las lleve, menos lo gozado,
-- pagado y liquidado, más los ajustes. Solo movimientos aprobados. El saldo
-- inicial es el saldo al cierre de su fecha de corte: ya incluye lo ocurrido
-- hasta ese día, así que solo cuentan los movimientos posteriores.
create or replace function rrhh.fn_vacaciones_saldo(p_contrato_id uuid, p_fecha date)
returns table (fecha_corte date, acumulado numeric, gozado numeric, pagado numeric, ajustes numeric,
               liquidado numeric, saldo numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  v_si_fecha date;
  v_si_dias numeric;
  v_desde date;
  v_hasta date;
  v_dias_mes numeric;
begin
  select ct.company_id, ct.fecha_inicio, ct.fecha_fin_real into c from rrhh.contratos ct where ct.id = p_contrato_id;
  gozado := 0; pagado := 0; ajustes := 0; liquidado := 0; acumulado := 0;
  if c.fecha_inicio is null then
    saldo := 0;
    return next;
    return;
  end if;
  v_hasta := least(p_fecha, coalesce(c.fecha_fin_real, p_fecha));
  v_dias_mes := rrhh.fn_planilla_parametro(c.company_id, 'dias_mes_comercial', p_fecha);
  select m.fecha_inicio, m.dias into v_si_fecha, v_si_dias from rrhh.vacaciones_movimientos m
  where m.contrato_id = p_contrato_id and m.tipo = 'saldo_inicial' and m.estado = 'aprobada';
  if v_si_fecha is not null then
    fecha_corte := v_si_fecha;
    v_desde := v_si_fecha + 1;
    acumulado := v_si_dias;
  else
    fecha_corte := c.fecha_inicio;
    v_desde := c.fecha_inicio;
  end if;
  if v_hasta >= v_desde then
    acumulado := acumulado + rrhh.fn_planilla_parametro(c.company_id, 'vacaciones_dias_por_mes', p_fecha)
                 * rrhh.fn_planilla_meses_regimen(p_contrato_id, v_desde, v_hasta, 'vacaciones', v_dias_mes);
  end if;
  select coalesce(sum(m.dias) filter (where m.tipo = 'goce'), 0),
         coalesce(sum(m.dias) filter (where m.tipo = 'pago'), 0),
         coalesce(sum(m.dias) filter (where m.tipo = 'ajuste'), 0),
         coalesce(sum(m.dias) filter (where m.tipo = 'liquidacion'), 0)
    into gozado, pagado, ajustes, liquidado
  from rrhh.vacaciones_movimientos m
  where m.contrato_id = p_contrato_id and m.estado = 'aprobada' and m.tipo <> 'saldo_inicial'
    and m.fecha_inicio <= p_fecha and (v_si_fecha is null or m.fecha_inicio > v_si_fecha);
  acumulado := round(acumulado, 4);
  saldo := round(acumulado - gozado - pagado + ajustes - liquidado, 4);
  return next;
end;
$$;

-- Pasivo laboral vivo de los contratos activos a una fecha: días acumulados ×
-- diario del salario actual (decisión del usuario: cambia el valor, no el
-- tiempo). Indemnización por la tabla del art. 45 sin el mínimo, solo en
-- contratos por tiempo indeterminado.
create or replace function rrhh.fn_planilla_pasivo(p_company_id uuid, p_fecha date)
returns table (contrato_id uuid, empleado_id uuid, numero_contrato bigint, empleado_nombre text,
               salario_mensual numeric, salario_diario numeric, vacaciones_dias numeric, vacaciones_monto numeric,
               aguinaldo_dias numeric, aguinaldo_monto numeric, indemnizacion_dias numeric, indemnizacion_monto numeric,
               total numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  k record;
  r rrhh.contrato_regimen;
  v_dias_mes numeric;
  v_ag_ini date;
  v_meses numeric;
  v_anios numeric;
begin
  v_dias_mes := rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', p_fecha);
  select x.ini into v_ag_ini from rrhh.fn_planilla_aguinaldo_periodo(p_company_id, p_fecha) x;
  for k in
    select c.id, c.empleado_id, c.numero_contrato, c.fecha_inicio, c.fecha_antiguedad, c.fecha_fin_prevista,
           cc.salario_base, e.nombre || ' ' || e.apellido as nombre
    from rrhh.contratos c
    join rrhh.contrato_compensacion cc on cc.contrato_id = c.id
    join rrhh.empleados e on e.id = c.empleado_id
    where c.company_id = p_company_id and c.estado = 'activo' and c.fecha_inicio is not null and c.fecha_inicio <= p_fecha
    order by c.numero_contrato
  loop
    r := null;
    select cr.* into r from rrhh.contrato_regimen cr
    where cr.contrato_id = k.id and cr.vigente_desde <= p_fecha and (cr.vigente_hasta is null or cr.vigente_hasta >= p_fecha);
    contrato_id := k.id;
    empleado_id := k.empleado_id;
    numero_contrato := k.numero_contrato;
    empleado_nombre := k.nombre;
    salario_mensual := k.salario_base;
    salario_diario := round(k.salario_base / v_dias_mes, 4);

    vacaciones_dias := 0;
    if coalesce(r.paga_vacaciones, false) then
      select greatest(0, s.saldo) into vacaciones_dias from rrhh.fn_vacaciones_saldo(k.id, p_fecha) s;
    end if;
    vacaciones_monto := round(vacaciones_dias * salario_diario, 2);

    aguinaldo_dias := 0;
    if not exists (select 1 from rrhh.planilla_empleados pe join rrhh.planillas q on q.id = pe.planilla_id
                   join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id and t.clase = 'aguinaldo'
                   where pe.contrato_id = k.id and q.estado in ('aprobada', 'pagada') and q.periodo_inicio = v_ag_ini) then
      aguinaldo_dias := rrhh.fn_planilla_aguinaldo_dias(k.id, greatest(v_ag_ini, k.fecha_inicio), p_fecha);
    end if;
    aguinaldo_monto := round(aguinaldo_dias * salario_diario, 2);

    indemnizacion_dias := 0;
    if coalesce(r.paga_indemnizacion, false) and k.fecha_fin_prevista is null then
      v_meses := rrhh.fn_meses_comerciales(coalesce(k.fecha_antiguedad, k.fecha_inicio), p_fecha, v_dias_mes);
      v_anios := rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_anios_iniciales', p_fecha);
      indemnizacion_dias := round(least(rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_maximo', p_fecha),
          least(v_meses, v_anios * 12) * rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_anio_inicial', p_fecha) / 12
        + greatest(0, v_meses - v_anios * 12) * rrhh.fn_planilla_parametro(p_company_id, 'indemnizacion_dias_anio_siguiente', p_fecha) / 12), 4);
    end if;
    indemnizacion_monto := round(indemnizacion_dias * salario_diario, 2);
    total := vacaciones_monto + aguinaldo_monto + indemnizacion_monto;
    return next;
  end loop;
end;
$$;

-- Sin EXECUTE para la API mientras se aplican las demás partes.
revoke all on function
  rrhh.fn_asegurar_particion_provisiones(date),
  rrhh.fn_asegurar_particion_vacaciones_movimientos(date),
  rrhh.fn_meses_comerciales(date, date, numeric),
  rrhh.fn_planilla_fin_periodo(date, text),
  rrhh.fn_planilla_aguinaldo_periodo(uuid, date),
  rrhh.fn_planilla_meses_regimen(uuid, date, date, text, numeric),
  rrhh.fn_planilla_aguinaldo_dias(uuid, date, date),
  rrhh.fn_vacaciones_saldo(uuid, date),
  rrhh.fn_planilla_pasivo(uuid, date)
from public, anon, authenticated;
