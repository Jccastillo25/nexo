-- =============================================================================
-- public.get_visible_apps — lo que el panel (apps/nexo) llama para armar la
-- grilla de modulos. Devuelve solo los modulos que la empresa tiene
-- contratados (core.company_apps.enabled) Y que el usuario tiene permiso
-- de ver (core.has_permission(..., '<slug>.ver_modulo')). Igual que
-- has_permission, usa auth.uid() adentro — no se puede pedir la grilla de
-- otro usuario.
-- =============================================================================
create or replace function public.get_visible_apps(p_company_id uuid)
returns table (
  slug text,
  name text,
  category text,
  icon text,
  color text,
  route text
)
language sql
stable
security definer
set search_path = core, public
as $$
  select a.slug, a.name, a.category, a.icon, a.color, a.route
  from core.apps a
  join core.company_apps ca
    on ca.app_id = a.id
   and ca.company_id = p_company_id
   and ca.enabled
  where a.active
    and core.has_permission(auth.uid(), p_company_id, a.slug || '.ver_modulo')
  order by a.name;
$$;

comment on function public.get_visible_apps is
  'Grilla de modulos del panel: cruza core.company_apps (contratado) y core.has_permission (autorizado). El panel nunca hardcodea la lista de apps.';

revoke execute on function public.get_visible_apps(uuid) from public;
grant execute on function public.get_visible_apps(uuid) to authenticated;
