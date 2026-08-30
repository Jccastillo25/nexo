-- get_visible_apps listaba tambien el modulo "nexo" (el panel se listaba a
-- si mismo, un tile circular que apunta a "/"). nexo es la zona raiz/el
-- launcher, no un destino — se excluye explicitamente.
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
    and a.slug <> 'nexo'
    and core.has_permission(auth.uid(), p_company_id, a.slug || '.ver_modulo')
  order by a.name;
$$;
