-- Activa el módulo Agencia digital (dashboard de marketing) para Materiales J
-- Castillo. Decisión del usuario 2026-10-17 ("activa agencia digital"), para
-- verlo en local contra nexo-core. Efecto conocido: la tarjeta aparece también
-- en el Launcher de producción; /agencia solo abre en producción cuando el
-- proyecto nexocore tenga AGENCIA_APP_URL de Production y se redepliegue
-- (ver docs/status-log/2026-10-14-agencia-independiente.md). Solo
-- core.apps.active y core.company_apps; sin roles ni usuarios nuevos.
--
-- Rollback: update core.apps set active = false where slug = 'agencia';
--           update core.company_apps set enabled = false
--             where app_id = (select id from core.apps where slug = 'agencia');
do $$
declare n integer;
begin
  if not exists (select 1 from core.apps where slug = 'agencia' and not active) then
    raise exception 'precheck: agencia no existe o ya está activa';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'agencia') < 2 then
    raise exception 'precheck: faltan los permisos del Paso Cero de Agencia';
  end if;

  update core.apps set active = true, updated_at = now() where slug = 'agencia';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe existir exactamente una app Agencia'; end if;

  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'agencia'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;
end;
$$;
