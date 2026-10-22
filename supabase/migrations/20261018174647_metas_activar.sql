-- Activa Metas de ventas para Materiales J Castillo (decisión del usuario
-- 2026-10-18: "actívala", para probarla en local contra nexo-core aunque la
-- tarjeta aparezca en el Launcher de producción antes del deploy). Solo
-- core.apps.active y core.company_apps; sin roles ni usuarios.
do $$
declare n integer;
begin
  if not exists (select 1 from core.apps where slug = 'metas' and not active) then
    raise exception 'precheck: metas no existe o ya está activa';
  end if;
  if to_regnamespace('metas') is null then
    raise exception 'precheck: falta el esquema de Metas';
  end if;

  update core.apps set active = true, updated_at = now() where slug = 'metas';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe existir exactamente una app Metas'; end if;

  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'metas'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;
end;
$$;
