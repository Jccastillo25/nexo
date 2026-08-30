-- Corrige 2 warnings de get_advisors detectados tras crm_schema:
--
-- 1. crm.default_company_id no tenia search_path fijo (mutable) — riesgo de
--    "search path injection" en funciones SECURITY DEFINER/STABLE.
-- 2. public.has_permission era ejecutable por el rol `anon` (sin sesion).
--    No tiene sentido: sin sesion, auth.uid() es null y el chequeo no sirve
--    para nada legitimo. Se revoca de anon, se deja solo para authenticated
--    (eso SI es intencional: es la razon de ser de la funcion).

create or replace function crm.default_company_id()
returns uuid
language sql
stable
set search_path = core
as $$
  select id from core.companies where slug = 'materiales-jcastillo';
$$;

revoke execute on function public.has_permission(uuid, text) from anon;
grant execute on function public.has_permission(uuid, text) to authenticated;
