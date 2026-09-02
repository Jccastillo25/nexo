-- =============================================================================
-- Nexo — convierte core.audit_log a particionada por rango mensual
-- Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2.1.
--
-- Seguro de aplicar: core.audit_log esta vacia hoy (ver docs/DATABASE.md,
-- "vacias"), asi que no hace falta backfill ni ventana de mantenimiento —
-- es un drop+recreate limpio. Si en el futuro esto se vuelve a necesitar
-- sobre una tabla CON datos, el patron correcto es crear la tabla
-- particionada con otro nombre, copiar en lotes, y renombrar — no repetir
-- este drop.
-- =============================================================================

drop table if exists core.audit_log;

create table core.audit_log (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_id uuid references core.companies(id),
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

comment on table core.audit_log is
  'Auditoria unificada de toda la suite. Particionada por mes desde 2026-09-02 (ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2.1) — nace particionada porque es la tabla de hechos por definicion: un renglon por evento, para siempre.';

-- -----------------------------------------------------------------------------
-- core.fn_asegurar_particion_audit_log — crea la particion de un mes dado
-- si no existe, con sus indices locales. Idempotente.
-- -----------------------------------------------------------------------------
create or replace function core.fn_asegurar_particion_audit_log(p_mes date)
returns void
language plpgsql
as $$
declare
  particion text := 'audit_log_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname = particion
  ) then
    execute format(
      'create table core.%I partition of core.audit_log for values from (%L) to (%L)',
      particion, inicio, fin
    );
    execute format('create index on core.%I (company_id, created_at)', particion);
    execute format('create index on core.%I (user_id)', particion);
  end if;
end;
$$;

comment on function core.fn_asegurar_particion_audit_log is
  'Crea la particion mensual de core.audit_log para el mes de p_mes si no existe. Llamar con el mes actual + N meses de antelacion (ver core.fn_asegurar_particiones_futuras).';

-- -----------------------------------------------------------------------------
-- core.fn_asegurar_particiones_futuras — barre todas las tablas
-- particionadas registradas en core.tablas_particionadas y asegura N meses
-- de antelacion. Un solo punto de entrada para pg_cron, sin importar
-- cuantas tablas particionadas tenga la suite en el futuro.
-- -----------------------------------------------------------------------------
create table if not exists core.tablas_particionadas (
  schema_nombre text not null,
  tabla_nombre text not null,
  fn_asegurar_particion text not null,  -- nombre calificado de la funcion, ej 'core.fn_asegurar_particion_audit_log'
  primary key (schema_nombre, tabla_nombre)
);

comment on table core.tablas_particionadas is
  'Registro de tablas particionadas de la suite, para que core.fn_asegurar_particiones_futuras() sepa a que funciones llamar. Un modulo nuevo con una tabla particionada se agrega aqui en su propia migracion.';

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion)
values ('core', 'audit_log', 'core.fn_asegurar_particion_audit_log')
on conflict do nothing;

create or replace function core.fn_asegurar_particiones_futuras(p_meses_adelante int default 3)
returns void
language plpgsql
as $$
declare
  r record;
  i int;
begin
  for r in select * from core.tablas_particionadas loop
    for i in 0..p_meses_adelante loop
      execute format('select %s(%L)', r.fn_asegurar_particion, (date_trunc('month', now()) + (i || ' months')::interval)::date);
    end loop;
  end loop;
end;
$$;

comment on function core.fn_asegurar_particiones_futuras is
  'Punto de entrada unico para pg_cron: asegura p_meses_adelante particiones futuras de toda tabla registrada en core.tablas_particionadas.';

-- Particiones iniciales: mes actual + 2 meses adelante.
select core.fn_asegurar_particiones_futuras(2);

-- -----------------------------------------------------------------------------
-- pg_cron — mantenimiento mensual automatico. Requiere la extension
-- pg_cron habilitada en el proyecto (Database → Extensions en el
-- dashboard de Supabase, o create extension si el plan lo permite desde
-- SQL). Si la extension no esta disponible en el plan actual, correr
-- core.fn_asegurar_particiones_futuras(3) a mano cada mes hasta migrar de
-- plan — no bloquea el resto de esta migracion.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'nexo_asegurar_particiones',
      '0 3 1 * *',
      $job$ select core.fn_asegurar_particiones_futuras(3) $job$
    );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS — sin cambios de intencion respecto a la tabla anterior: audit_log
-- queda sin policy para 'authenticated' (denegado por defecto), solo
-- service_role escribe/lee directo. Las policies se heredan a las
-- particiones automaticamente al estar definidas sobre la tabla padre.
-- -----------------------------------------------------------------------------
alter table core.audit_log enable row level security;
alter table core.tablas_particionadas enable row level security;
