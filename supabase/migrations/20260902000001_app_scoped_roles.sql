-- =============================================================================
-- Nexo — roles por app (capa 2 del RBAC de 3 capas)
-- Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §3.2.
--
-- Extiende la norma v3.0 (docs/PERMISSIONS.md) sin romperla: agrega una
-- capa intermedia entre el rol de suite (core.company_memberships, ya
-- existente) y el permiso fino por accion (core.user_permissions, ya
-- existente) para casos como "admin de RRHH pero solo lectura en
-- Contabilidad" sin tener que otorgar permisos uno por uno.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- core.app_roles — roles pre-empaquetados que un modulo puede declarar
-- (ej. 'admin', 'editor', 'viewer' de RRHH). Cada modulo define los suyos.
-- -----------------------------------------------------------------------------
create table core.app_roles (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null references core.apps(slug) on update cascade,
  role_key text not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (module_slug, role_key)
);

comment on table core.app_roles is
  'Roles pre-empaquetados por modulo (ej. rrhh.admin, contabilidad.viewer). Capa 2 del RBAC de 3 capas, ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §3.';

-- -----------------------------------------------------------------------------
-- core.app_role_permissions — que permisos trae empaquetados cada rol de app.
-- -----------------------------------------------------------------------------
create table core.app_role_permissions (
  app_role_id uuid not null references core.app_roles(id) on delete cascade,
  permission_code text not null references core.permissions_catalog(code) on update cascade,
  primary key (app_role_id, permission_code)
);

-- -----------------------------------------------------------------------------
-- core.user_app_roles — asignacion real: que rol de que app tiene cada
-- usuario, en que empresa. Un usuario puede tener roles distintos en
-- modulos distintos (el caso de uso del enunciado).
-- -----------------------------------------------------------------------------
create table core.user_app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  app_role_id uuid not null references core.app_roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, company_id, app_role_id)
);

comment on table core.user_app_roles is
  'Asignacion de roles por app. DENY BY DEFAULT sigue vigente: no tener fila aqui no otorga nada por si solo, es un atajo que agrega permisos, nunca los quita (ver core.has_permission()).';

-- =============================================================================
-- core.has_permission — version extendida con la capa 2 (rol de app).
-- Orden de evaluacion, DENY-BY-DEFAULT sin cambios de fondo:
--   1. codigo invalido -> false, siempre.
--   2. fila explicita en user_permissions -> manda esa fila (capa 3, gana).
--   3. el rol de app del usuario en esta empresa trae el permiso -> true (NUEVO, capa 2).
--   4. owner/admin de suite -> true (capa 1, ultimo fallback, sin cambios).
-- Retrocompatible: ningun modulo existente cambia una linea, siguen
-- llamando a public.has_permission(companyId, code) igual que hoy.
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
    when exists (
      select 1
      from core.user_app_roles uar
      join core.app_role_permissions arp on arp.app_role_id = uar.app_role_id
      where uar.user_id = p_user_id and uar.company_id = p_company_id
        and arp.permission_code = p_code
    ) then true
    else exists (
      select 1 from core.company_memberships
      where user_id = p_user_id and company_id = p_company_id and role in ('owner', 'admin')
    )
  end;
$$;

comment on function core.has_permission is
  'Fuente unica de la norma v3.0, ahora con 3 capas (suite / app / permiso fino). Ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §3.2.';

-- =============================================================================
-- RLS — mismo criterio que el resto de core: catalogos de lectura publica
-- para authenticated, asignaciones reales solo visibles para su propio dueno
-- hasta que se defina una policy de administracion (analoga a
-- company_memberships, ver docs/DATABASE.md).
-- =============================================================================
alter table core.app_roles enable row level security;
alter table core.app_role_permissions enable row level security;
alter table core.user_app_roles enable row level security;

create policy "app_roles: lectura autenticada" on core.app_roles
  for select to authenticated using (true);

create policy "app_role_permissions: lectura autenticada" on core.app_role_permissions
  for select to authenticated using (true);

create policy "user_app_roles: ver el propio" on core.user_app_roles
  for select to authenticated using (user_id = auth.uid());

-- Sin policy de insert/update/delete para authenticated en ninguna de las
-- 3 tablas: asignar roles de app queda reservado a service_role (paneles
-- de administracion futuros) hasta que se defina la policy real de
-- administracion por owner/admin de empresa.
