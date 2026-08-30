-- =============================================================================
-- core.platform_settings — configuracion de marca de Nexo (singleton, 1 fila).
-- Pedido explicito del usuario: el login (logo, imagen de fondo, textos,
-- bullets) y el copyright de toda la plataforma tienen que ser editables sin
-- tocar codigo. Mismo patron que `platform_settings` de Ruta360 (ver
-- apps/flotilla/docs/DATABASE.md) — singleton forzado con CHECK (id = 1).
-- =============================================================================
create table core.platform_settings (
  id smallint primary key default 1,
  logo_url text,
  login_background_url text,
  eyebrow_text text not null default 'Grupo CT',
  heading_text text not null default 'Nexo',
  tagline text not null default 'El panel unificado de Materiales J Castillo / Grupo CT.',
  bullets jsonb not null default '[
    {"icon": "shield", "title": "Permisos por módulo", "description": "Cada cuenta ve únicamente lo que tiene habilitado."},
    {"icon": "key", "title": "Un solo inicio de sesión", "description": "Entrá a todos los módulos sin volver a loguearte."},
    {"icon": "layers", "title": "Todo en un solo panel", "description": "CRM, RRHH y Flotilla, unificados en un mismo lugar."}
  ]'::jsonb,
  copyright_text text not null default '© Grupo CT',
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);

comment on table core.platform_settings is
  'Configuracion de marca de Nexo (singleton, id=1 forzado). Logo/fondo/textos del login + copyright de toda la plataforma. Editable desde apps/nexo/src/app/ajustes.';

insert into core.platform_settings (id) values (1);

alter table core.platform_settings enable row level security;
-- Sin policies a proposito: igual que company_apps/user_permissions/audit_log,
-- RLS activo sin policy deniega para todo el mundo excepto service_role. La
-- lectura pasa por public.get_platform_settings() (SECURITY DEFINER) y la
-- escritura por public.update_platform_settings() (idem, valida el permiso
-- adentro) — ver mas abajo.

-- -----------------------------------------------------------------------------
-- public.get_platform_settings — lectura publica (el login no tiene sesion
-- todavia, asi que esto se llama con la key anonima). No expone nada sensible.
-- -----------------------------------------------------------------------------
create or replace function public.get_platform_settings()
returns table (
  logo_url text,
  login_background_url text,
  eyebrow_text text,
  heading_text text,
  tagline text,
  bullets jsonb,
  copyright_text text
)
language sql
stable
security definer
set search_path = core, public
as $$
  select logo_url, login_background_url, eyebrow_text, heading_text, tagline, bullets, copyright_text
  from core.platform_settings
  where id = 1;
$$;

comment on function public.get_platform_settings is
  'Lectura publica de la config de marca (login + copyright). Sin datos sensibles — se llama sin sesion desde la pantalla de login.';

revoke execute on function public.get_platform_settings() from public;
grant execute on function public.get_platform_settings() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- public.update_platform_settings — unico camino de escritura. Valida el
-- permiso 'nexo.configuracion.editar' adentro (norma v3.0) resolviendo la
-- empresa del caller desde core.company_memberships — nunca confia en un
-- company_id que mande el cliente.
--
-- Convencion de parametros text nullable: NULL = no tocar ese campo, '' =
-- limpiarlo (solo aplica a logo_url/login_background_url, que son opcionales).
-- Los campos NOT NULL (eyebrow/heading/tagline/copyright) siempre llegan con
-- un valor real del form, por eso ahi alcanza con coalesce simple.
-- -----------------------------------------------------------------------------
create or replace function public.update_platform_settings(
  p_logo_url text default null,
  p_login_background_url text default null,
  p_eyebrow_text text default null,
  p_heading_text text default null,
  p_tagline text default null,
  p_bullets jsonb default null,
  p_copyright_text text default null
)
returns void
language plpgsql
security definer
set search_path = core, public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from core.company_memberships
  where user_id = auth.uid()
  limit 1;

  if v_company_id is null
     or not core.has_permission(auth.uid(), v_company_id, 'nexo.configuracion.editar')
  then
    raise exception 'No autorizado para editar la configuración de la plataforma';
  end if;

  update core.platform_settings
  set
    logo_url = case
      when p_logo_url is null then logo_url
      when p_logo_url = '' then null
      else p_logo_url
    end,
    login_background_url = case
      when p_login_background_url is null then login_background_url
      when p_login_background_url = '' then null
      else p_login_background_url
    end,
    eyebrow_text = coalesce(p_eyebrow_text, eyebrow_text),
    heading_text = coalesce(p_heading_text, heading_text),
    tagline = coalesce(p_tagline, tagline),
    bullets = coalesce(p_bullets, bullets),
    copyright_text = coalesce(p_copyright_text, copyright_text),
    updated_at = now()
  where id = 1;
end;
$$;

comment on function public.update_platform_settings is
  'Unico camino de escritura de core.platform_settings. Valida nexo.configuracion.editar adentro (norma v3.0) — nunca confia en el rol declarado por el cliente.';

revoke execute on function public.update_platform_settings from public;
grant execute on function public.update_platform_settings to authenticated;

-- -----------------------------------------------------------------------------
-- Permiso de la norma v3.0 para poder editar esta configuracion.
-- -----------------------------------------------------------------------------
insert into core.permissions_catalog (code, module_slug, domain, label, description)
values (
  'nexo.configuracion.editar',
  'nexo',
  'configuracion',
  'Editar configuración de marca',
  'Editar logo, imagen de fondo, textos del login y copyright de toda la plataforma.'
);

-- -----------------------------------------------------------------------------
-- Bucket de Storage para el logo y la imagen de fondo del login. Publico
-- (se referencia directo desde <img src>, sin URL firmada) — mismo patron
-- que el bucket `platform-assets` de Ruta360.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('platform-assets', 'platform-assets', true)
on conflict (id) do nothing;

create policy "platform_assets_public_read"
on storage.objects for select
using (bucket_id = 'platform-assets');

-- Sin policy de escritura para authenticated/anon a proposito: la subida pasa
-- siempre por el Server Action de apps/nexo/src/app/ajustes, que usa el
-- cliente service_role (bypassa esta RLS) recien despues de validar el
-- permiso via requirePermission() — mismo patron que /api/supadmin/* en
-- Ruta360.
