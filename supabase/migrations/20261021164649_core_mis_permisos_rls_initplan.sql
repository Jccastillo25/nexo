-- =============================================================================
-- core — permisos del usuario en una sola llamada + RLS sin re-evaluación por fila
-- (revisión integral 2026-10-20; docs/status-log/2026-10-20-revision-integral.md).
--
-- 1. public.mis_permisos(empresa, códigos[]) → text[]
--    Medido en remoto: public.has_permission tuvo 6 489 llamadas contra 265 de
--    mi_perfil (~20 por carga de página: Productos pedía 17 permisos sueltos en
--    el layout y otra vez en la página). Esta RPC devuelve, de una lista de
--    códigos, los que el usuario de la sesión tiene, con la misma lógica de
--    core.has_permission (DENY BY DEFAULT). Sin códigos nuevos: no aplica Paso
--    Cero. La usa getPermisos() de @nexo/permissions, y sirve igual para Nexo
--    Mobile (lógica en el backend, no en una Server Action).
--    Generaliza presupuesto_mis_permisos, que queda como está.
-- 2. Advisor auth_rls_initplan: dos políticas de core evaluaban auth.uid() por
--    fila. Se envuelve en (select auth.uid()), que Postgres evalúa una vez.
-- =============================================================================

create or replace function public.mis_permisos(p_company_id uuid, p_codigos text[])
returns text[] language plpgsql stable security definer set search_path = '' as $$
begin
  if p_company_id is null or p_codigos is null or cardinality(p_codigos) = 0 then
    return '{}'::text[];
  end if;
  if cardinality(p_codigos) > 300 then
    raise exception 'Demasiados códigos de permiso en una sola consulta.' using errcode = '22023';
  end if;
  return coalesce((
    select array_agg(x.c order by x.c)
    from (select distinct unnest(p_codigos) as c) x
    where x.c is not null and core.has_permission(auth.uid(), p_company_id, x.c)
  ), '{}'::text[]);
end;
$$;

revoke all on function public.mis_permisos(uuid, text[]) from public, anon;
grant execute on function public.mis_permisos(uuid, text[]) to authenticated;

alter policy "company_memberships: ver la propia" on core.company_memberships
  using (user_id = (select auth.uid()));
alter policy "user_app_roles: ver el propio" on core.user_app_roles
  using (user_id = (select auth.uid()));

-- Poscheque ------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.mis_permisos(uuid,text[])', 'execute') then
    raise exception 'Poscheque: anon no debe ejecutar mis_permisos';
  end if;
  if not has_function_privilege('authenticated', 'public.mis_permisos(uuid,text[])', 'execute') then
    raise exception 'Poscheque: authenticated debe ejecutar mis_permisos';
  end if;
  if exists (select 1 from pg_policies
             where schemaname = 'core'
               and policyname in ('company_memberships: ver la propia', 'user_app_roles: ver el propio')
               and qual not ilike '%select auth.uid()%') then
    raise exception 'Poscheque: las políticas siguen evaluando auth.uid() por fila';
  end if;
end $$;

-- PostgREST recarga el esquema para exponer mis_permisos al instante.
notify pgrst, 'reload schema';
