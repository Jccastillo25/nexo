-- Activa la app Presupuesto para Materiales J Castillo (decisión del usuario
-- 2026-10-20: "Sí, activa Presupuesto para la empresa para probarla en
-- local"). Solo core.apps.active y core.company_apps; sin roles ni usuarios.
-- Mientras no se despliegue apps/presupuesto (proyecto de Vercel nexo-crm,
-- docs/plan/19-presupuesto.md §2), el mosaico del Launcher de producción
-- lleva a una ruta sin rewrite, igual que pasó con Productos.
do $$
declare n integer;
begin
  if not exists (select 1 from core.apps where slug = 'presupuesto' and not active) then
    raise exception 'precheck: presupuesto no existe o ya está activa';
  end if;
  if to_regnamespace('presupuesto') is null then
    raise exception 'precheck: falta el esquema de Presupuesto';
  end if;

  update core.apps set active = true, updated_at = now() where slug = 'presupuesto';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe existir exactamente una app Presupuesto'; end if;

  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'presupuesto'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;
end;
$$;
