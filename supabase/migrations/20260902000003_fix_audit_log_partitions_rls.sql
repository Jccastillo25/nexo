-- =============================================================================
-- Nexo — fix: las particiones de core.audit_log no heredan RLS del padre
-- automaticamente (comportamiento real de Postgres: RLS protege las
-- queries que pasan POR el padre, pero cada particion sigue siendo una
-- tabla fisica con su propio flag). Detectado por el advisor de seguridad
-- de Supabase (nivel CRITICAL) inmediatamente despues de aplicar
-- 20260902000002_partition_core_audit_log — corregido en el mismo dia.
-- =============================================================================

-- 1. Habilitar RLS en las particiones ya creadas.
alter table core.audit_log_2026_09 enable row level security;
alter table core.audit_log_2026_10 enable row level security;
alter table core.audit_log_2026_11 enable row level security;

-- 2. Corregir la funcion que crea particiones futuras, para que esto no
--    se repita cada mes cuando pg_cron (o una llamada manual) cree la
--    particion siguiente.
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
    -- Fix: cada particion nueva nace con RLS habilitado (hereda el
    -- "sin policy = denegado para authenticated/anon" del padre, solo
    -- service_role accede) — sin esto, la particion queda expuesta.
    execute format('alter table core.%I enable row level security', particion);
  end if;
end;
$$;

comment on function core.fn_asegurar_particion_audit_log is
  'Crea la particion mensual de core.audit_log para el mes de p_mes si no existe, con RLS habilitado desde su creacion (fix 2026-09-02, ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2.1).';
