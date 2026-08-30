-- =============================================================================
-- Nexo — schema `core`
-- Compañías, catálogo de módulos, catálogo de permisos y permisos efectivos.
-- Ver docs/DATABASE.md y docs/PERMISSIONS.md para el diseño completo.
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
-- core.apps — catalogo de modulos instalables (el "menu de apps" del panel)
-- Se sincroniza desde el manifest.json de cada modulo (ver docs/planning/
-- PROPUESTA_MARCA_MODULOS.md seccion 5).
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
-- Esta es la pieza central de la norma: un permission_code que no esta aqui
-- se trata como inexistente/denegado por el helper de packages/permissions,
-- sin importar lo que diga core.user_permissions. Ver docs/PERMISSIONS.md.
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
-- No hay columnas por-dominio hardcodeadas como en la v2.0 de Gestor360: el
-- dominio vive en permissions_catalog.domain, esta tabla solo guarda el grant.
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
  'DENY BY DEFAULT. Los owners/admins tienen acceso total SOLO si no hay fila explicita aqui para ese permission_code (norma heredada de Gestor360 v2.0, ver docs/PERMISSIONS.md).';

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
-- su permiso base de visibilidad en permissions_catalog. Esto es literal: la
-- norma pedida por el usuario "se dispara siempre al crear... modulos" a
-- nivel de base de datos, no solo como documentacion.
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
  'Al insertar un modulo nuevo, crea automaticamente su permiso de visibilidad "<slug>.ver_modulo" en permissions_catalog. Ver docs/PERMISSIONS.md seccion "Que se dispara solo".';

-- =============================================================================
-- RLS — baseline provisional. Habilitado en todas las tablas; las politicas
-- finas por empresa/membresia se completan en la Fase 3+ cuando cada modulo
-- se conecte de verdad a nexo-core (por ahora nada consume esta base todavia).
-- =============================================================================
alter table core.companies enable row level security;
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

-- El resto de tablas quedan sin policy de acceso para 'authenticated' (por lo
-- tanto denegadas por defecto vía RLS) hasta que se definan las políticas
-- reales de membresía por empresa en la Fase 3+. service_role sigue teniendo
-- acceso total (RLS no aplica a service_role).
