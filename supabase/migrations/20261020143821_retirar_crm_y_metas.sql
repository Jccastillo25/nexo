-- Retiro del CRM y de Metas (2026-10-20).
--
-- Pedido del usuario: "borra todo lo de CRM que tenemos actualmente" y
-- "Borra todo el CRM: el código de apps/crm con respaldo en una rama local,
-- la app del Launcher y los esquemas crm y metas con sus permisos en
-- nexo-core". El CRM se reemplaza por la réplica de AG Negocio en la app
-- ERP (docs/plan/18-replica-ag-negocio.md). El código queda respaldado en la
-- rama local `respaldo/crm-2026-10-20`.
--
-- Qué hace:
--   1. Se detiene si alguna tabla de datos de crm o metas tiene filas; solo
--      quedan exentos los catálogos semilla del embudo.
--   2. Borra las RPC public.crm_* y public.metas_*.
--   3. Quita las tablas de crm y metas del mantenimiento de particiones.
--   4. Borra el esquema metas completo.
--   5. Vacía el esquema crm y lo deja creado, sin GRANT. `crm` sigue en
--      "Exposed schemas" de la Data API; si el esquema desapareciera mientras
--      sigue expuesto, PostgREST podría dejar de cargar su caché y tumbar la
--      API de las demás apps. Se borra cuando el usuario lo quite de esa
--      lista.
--   6. Borra la app `crm` de core.apps (sale del Launcher) junto con sus 34
--      permisos, sus 3 plantillas de rol y la habilitación de la empresa.
--
-- Rollback: volver a aplicar las migraciones del CRM y de Metas que están en
-- la rama de respaldo. No se pierde ningún dato: las tablas están vacías.

-- 1. Prechequeo: nada con datos reales.
do $$
declare
  v_tabla regclass;
  v_filas bigint;
begin
  for v_tabla in
    select c.oid::regclass
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('crm', 'metas')
      and c.relkind in ('r', 'p')
      and not c.relispartition
      and (n.nspname, c.relname) not in (
        ('crm', 'embudo_parametros'), ('crm', 'etapas'),
        ('crm', 'origenes'), ('crm', 'motivos_perdida')
      )
  loop
    execute format('select count(*) from %s', v_tabla) into v_filas;
    if v_filas > 0 then
      raise exception 'Retiro abortado: % tiene % filas', v_tabla, v_filas;
    end if;
  end loop;

  if exists (
    select 1 from core.permissions_catalog
    where code like 'crm.%' and module_slug <> 'crm'
  ) then
    raise exception 'Retiro abortado: hay permisos crm.* registrados en otro módulo';
  end if;

  if exists (
    select 1 from core.user_app_roles u
    join core.app_roles r on r.id = u.app_role_id
    where r.module_slug = 'crm'
  ) or exists (
    select 1 from core.user_permissions where permission_code like 'crm.%'
  ) or exists (
    select 1 from core.rol_permisos where permission_code like 'crm.%'
  ) then
    raise exception 'Retiro abortado: hay usuarios o roles de empresa con permisos crm.*';
  end if;
end $$;

-- 2. RPC públicas del CRM y de Metas.
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'crm\_%' or p.proname like 'metas\_%')
  loop
    execute format('drop function %s', v_fn);
  end loop;
end $$;

-- 3. Mantenimiento de particiones futuras.
delete from core.tablas_particionadas
where schema_nombre in ('crm', 'metas');

-- 4. Metas completo (no está expuesto en la Data API).
drop schema metas cascade;

-- 5. CRM vacío, sin acceso, hasta que salga de "Exposed schemas".
drop schema crm cascade;
create schema crm;
revoke all on schema crm from public, anon, authenticated;
comment on schema crm is
  'Vacío desde el 2026-10-20 (CRM retirado, ver docs/plan/18-replica-ag-negocio.md). Se conserva solo porque sigue en Exposed schemas de la Data API; borrarlo cuando se quite de esa lista.';

-- 6. App, permisos y plantillas.
delete from core.app_role_permissions where permission_code like 'crm.%';
delete from core.app_roles where module_slug = 'crm';
delete from core.permissions_catalog where module_slug = 'crm';
delete from core.apps where slug = 'crm';

-- Poscheque.
do $$
begin
  if exists (select 1 from core.apps where slug = 'crm') then
    raise exception 'Poscheque: la app crm sigue registrada';
  end if;
  if exists (select 1 from core.permissions_catalog where code like 'crm.%' or module_slug = 'crm') then
    raise exception 'Poscheque: quedan permisos crm.*';
  end if;
  if exists (select 1 from core.app_roles where module_slug = 'crm') then
    raise exception 'Poscheque: quedan plantillas de rol del crm';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'crm\_%' or p.proname like 'metas\_%')
  ) then
    raise exception 'Poscheque: quedan RPC public.crm_* o public.metas_*';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'metas') then
    raise exception 'Poscheque: el esquema metas sigue existiendo';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'crm'
  ) or exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'crm'
  ) then
    raise exception 'Poscheque: el esquema crm no quedó vacío';
  end if;
  if exists (select 1 from core.tablas_particionadas where schema_nombre in ('crm', 'metas')) then
    raise exception 'Poscheque: quedan tablas de crm o metas en el mantenimiento de particiones';
  end if;
  if has_schema_privilege('authenticated', 'crm', 'usage')
     or has_schema_privilege('anon', 'crm', 'usage') then
    raise exception 'Poscheque: el esquema crm vacío sigue con USAGE para anon o authenticated';
  end if;
end $$;
