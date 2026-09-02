-- =============================================================================
-- Nexo — 2 fixes menores detectados por el advisor de seguridad de
-- Supabase tras aplicar 20260902000006:
--
-- 1. rrhh.default_company_id sin search_path fijo (WARN) — mismo patron
--    ya corregido antes en core.fn_asegurar_particion_audit_log
--    (20260902000004).
-- 2. "revoke execute ... from anon" en set_pin_empleado no alcanzaba:
--    Postgres otorga EXECUTE a PUBLIC por defecto al crear una funcion, y
--    revocar solo de un rol especifico no quita lo heredado de PUBLIC.
--    Hay que revocar de PUBLIC y otorgar explicito solo a authenticated.
--    Nota: esto era higiene, no una vulnerabilidad real — core.has_permission
--    ya denegaba a anon (auth.uid() nulo -> false), pero el codigo debe
--    hacer lo que el comentario dice.
-- =============================================================================

create or replace function rrhh.default_company_id()
returns uuid
language sql
stable
set search_path = core, pg_temp
as $$
  select id from core.companies where slug = 'materiales-jcastillo';
$$;

revoke execute on function public.set_pin_empleado(uuid, uuid, text) from public;
grant execute on function public.set_pin_empleado(uuid, uuid, text) to authenticated;
