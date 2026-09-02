-- =============================================================================
-- Nexo — fix: search_path mutable en las 2 funciones de particionamiento
-- (WARN del advisor de seguridad de Supabase — riesgo real de search_path
-- hijacking en Postgres). set search_path fijo, mismo patron que
-- core.has_permission y el resto de funciones de core.
-- =============================================================================

create or replace function core.fn_asegurar_particion_audit_log(p_mes date)
returns void
language plpgsql
set search_path = core, pg_temp
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
    execute format('alter table core.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function core.fn_asegurar_particiones_futuras(p_meses_adelante int default 3)
returns void
language plpgsql
set search_path = core, pg_temp
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

comment on function core.fn_asegurar_particion_audit_log is
  'Crea la particion mensual de core.audit_log para el mes de p_mes si no existe, con RLS habilitado desde su creacion. search_path fijo (fix 2026-09-02).';
comment on function core.fn_asegurar_particiones_futuras is
  'Punto de entrada unico para pg_cron: asegura p_meses_adelante particiones futuras de toda tabla registrada en core.tablas_particionadas. search_path fijo (fix 2026-09-02).';
