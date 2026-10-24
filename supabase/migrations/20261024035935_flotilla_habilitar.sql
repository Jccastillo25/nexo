-- Habilita Flotilla para Materiales J Castillo (decisión del usuario
-- 2026-10-23: "Si" a "¿Habilito Flotilla para la empresa en nexo-core?").
-- core.apps.flotilla ya estaba activa en el catálogo; solo faltaba la fila de
-- core.company_apps. Sin roles ni usuarios. Mientras no se despliegue
-- apps/flotilla (proyecto de Vercel pendiente, docs/plan/22-flotilla-entregas.md),
-- el mosaico del Launcher de producción lleva a una ruta sin rewrite, igual
-- que pasó con Productos y Presupuesto.
do $$
declare n integer;
begin
  if not exists (select 1 from core.apps where slug = 'flotilla' and active) then
    raise exception 'precheck: flotilla no existe o no está activa en el catálogo';
  end if;
  if not exists (select 1 from core.app_roles where module_slug = 'flotilla') then
    raise exception 'precheck: falta el Paso Cero de Flotilla';
  end if;

  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'flotilla'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;
end;
$$;
