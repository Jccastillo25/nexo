-- =============================================================================
-- Nexo — schema `core`
-- Compañías, membresías/roles, catálogo de módulos, catálogo de permisos,
-- permisos efectivos y la función única que implementa la norma v3.0
-- (DENY BY DEFAULT). Ver docs/DATABASE.md y docs/PERMISSIONS.md.
-- =============================================================================

create schema if not exists core;

-- -----------------------------------------------------------------------------
-- core.companies — tenants de la suite (multi-empresa, heredado de Gestor360/Ruta360)
-- -----------------------------------------------------------------------------
create table core.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table core.companies is
  'Tenant unico compartido por todos los modulos de Nexo. Reemplaza las tablas de empresa que hoy existen por separado en Gestor360 y Ruta360 (se migran aqui en la Fase 5-6).';

-- -----------------------------------------------------------------------------
-- core.company_memberships — rol de cada usuario dentro de cada empresa.
-- Solo owner/admin tienen el bypass DENY BY DEFAULT heredado de Gestor360 v2.0.
-- -----------------------------------------------------------------------------
create table core.company_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

comment on table core.company_memberships is
  'Rol de cada usuario dentro de cada empresa. Solo owner/admin tienen el bypass DENY BY DEFAULT (ver core.has_permission).';

-- -----------------------------------------------------------------------------
-- core.apps — catalogo de modulos instalables (el "menu de apps" del panel)
-- Se sincroniza desde el manifest.json de cada modulo.
-- -----------------------------------------------------------------------------
create table core.apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,              -- 'rrhh', 'flotilla', 'crm', 'nexo'
  name text not null,                     -- 'RRHH', 'Flotilla', 'CRM'
  category text,                          -- 'RRHH', 'Cadena de suministro', 'Ventas'...
  icon text,                              -- nombre de icono Lucide, ej. 'truck'
  color text,                             -- token de color de acento, ej. 'azul'
  route text not null,                    -- ruta bajo Multi-Zones, ej. '/flotilla'
  depends text[] not null default '{}',   -- slugs de modulos de los que depende
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table core.apps is
  'Catalogo de modulos instalables, alimentado por apps/<slug>/manifest.json. El panel (apps/nexo) lee esta tabla para construir la grilla de apps, nunca hardcodea la lista.';

-- -----------------------------------------------------------------------------
-- core.company_apps — que modulos tiene contratados/activos cada empresa
-- (evita que un cliente de Flotilla vea RRHH, que es interno de Grupo CT)
-- -----------------------------------------------------------------------------
create table core.company_apps (
  company_id uuid not null references core.companies(id) on delete cascade,
  app_id uuid not null references core.apps(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, app_id)
);

-- -----------------------------------------------------------------------------
-- core.permissions_catalog — TODO permiso que puede existir en la suite.
-- Un permission_code que no esta aqui se trata como INVALIDO/denegado por
-- core.has_permission(), sin importar lo que diga core.user_permissions.
-- -----------------------------------------------------------------------------
create table core.permissions_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'rrhh.talento.empleados.crear'
  module_slug text not null references core.apps(slug) on update cascade,
  domain text not null,                            -- agrupacion visual dentro del modulo
  label text not null,                             -- 'Crear empleados'
  description text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- core.user_permissions — permisos efectivos por usuario+empresa.
-- DENY BY DEFAULT real: la ausencia de fila (o granted=false) es "denegado".
-- -----------------------------------------------------------------------------
create table core.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  permission_code text not null references core.permissions_catalog(code) on update cascade,
  granted boolean not null default false,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, company_id, permission_code)
);

comment on table core.user_permissions is
  'DENY BY DEFAULT. Los owners/admins tienen acceso total SOLO si no hay fila explicita aqui para ese permission_code.';

-- -----------------------------------------------------------------------------
-- core.audit_log — auditoria unificada de toda la suite
-- -----------------------------------------------------------------------------
create table core.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_id uuid references core.companies(id),
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- core.migration_map — trazabilidad de la migracion de datos desde los
-- proyectos Supabase originales (ofeuzkwjhmfsazqfyutu, etc.)
-- -----------------------------------------------------------------------------
create table core.migration_map (
  id uuid primary key default gen_random_uuid(),
  schema_origen text not null,
  tabla_origen text not null,
  id_original text not null,
  id_nuevo text not null,
  migrado_en timestamptz not null default now()
);

-- =============================================================================
-- Trigger: al registrar un modulo nuevo en core.apps, se crea automaticamente
-- su permiso base de visibilidad en permissions_catalog.
-- =============================================================================
create or replace function core.fn_seed_module_permission()
returns trigger
language plpgsql
security definer
set search_path = core
as $$
begin
  insert into core.permissions_catalog (code, module_slug, domain, label, description)
  values (
    new.slug || '.ver_modulo',
    new.slug,
    'acceso',
    'Ver modulo ' || new.name,
    'Controla si el modulo ' || new.name || ' aparece en el panel para el usuario/empresa. Creado automaticamente por trg_seed_module_permission al registrar el modulo en core.apps.'
  )
  on conflict (code) do nothing;
  return new;
end;
$$;

create trigger trg_seed_module_permission
after insert on core.apps
for each row execute function core.fn_seed_module_permission();

comment on trigger trg_seed_module_permission on core.apps is
  'Al insertar un modulo nuevo, crea automaticamente su permiso de visibilidad "<slug>.ver_modulo" en permissions_catalog.';

-- =============================================================================
-- core.has_permission — fuente unica de verdad de la norma v3.0.
-- DENY BY DEFAULT:
--   1. codigo no existe en permissions_catalog -> false, siempre.
--   2. existe fila explicita en user_permissions -> manda esa fila.
--   3. no hay fila -> true solo si el usuario es owner/admin de la empresa.
-- La usan tanto las policies de RLS (directo) como las apps (via el wrapper
-- public.has_permission, con RPC).
-- =============================================================================
create or replace function core.has_permission(p_user_id uuid, p_company_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = core
as $$
  select case
    when not exists (select 1 from core.permissions_catalog where code = p_code) then false
    when exists (
      select 1 from core.user_permissions
      where user_id = p_user_id and company_id = p_company_id and permission_code = p_code
    ) then coalesce((
      select granted from core.user_permissions
      where user_id = p_user_id and company_id = p_company_id and permission_code = p_code
    ), false)
    else exists (
      select 1 from core.company_memberships
      where user_id = p_user_id and company_id = p_company_id and role in ('owner', 'admin')
    )
  end;
$$;

comment on function core.has_permission is
  'Fuente unica de la norma v3.0 (DENY BY DEFAULT). La usan las policies de RLS directamente y las apps via el wrapper public.has_permission.';

-- Wrapper en `public` (schema expuesto por la API REST por defecto) para que
-- las apps lo llamen con supabase.rpc(...) sin necesitar exponer el schema
-- `core` en la API. Usa auth.uid() adentro: el llamador no puede pasar un
-- user_id distinto al de su propia sesion.
create or replace function public.has_permission(p_company_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = core, public
as $$
  select core.has_permission(auth.uid(), p_company_id, p_code);
$$;

comment on function public.has_permission is
  'Wrapper publico de core.has_permission. Las apps lo llaman via supabase.rpc("has_permission", { p_company_id, p_code }).';

-- =============================================================================
-- RLS — baseline provisional. Habilitado en todas las tablas; las politicas
-- finas por empresa/membresia se completan a medida que cada modulo se
-- conecta de verdad a nexo-core.
-- =============================================================================
alter table core.companies enable row level security;
alter table core.company_memberships enable row level security;
alter table core.apps enable row level security;
alter table core.company_apps enable row level security;
alter table core.permissions_catalog enable row level security;
alter table core.user_permissions enable row level security;
alter table core.audit_log enable row level security;
alter table core.migration_map enable row level security;

-- El catalogo de modulos y de permisos es de solo-lectura para cualquier
-- usuario autenticado (el panel necesita poder leerlo para armar la grilla).
create policy "apps: lectura autenticada" on core.apps
  for select to authenticated using (true);

create policy "permissions_catalog: lectura autenticada" on core.permissions_catalog
  for select to authenticated using (true);

-- Cada quien ve solo su propia membresia (no la de otros usuarios).
create policy "company_memberships: ver la propia" on core.company_memberships
  for select to authenticated using (user_id = auth.uid());

-- El resto de tablas quedan sin policy de acceso para 'authenticated' (por lo
-- tanto denegadas por defecto vía RLS) hasta que se definan las políticas
-- reales de membresía por empresa. service_role sigue teniendo acceso total.
