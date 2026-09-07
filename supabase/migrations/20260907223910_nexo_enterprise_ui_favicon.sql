-- =============================================================================
-- Nexo Enterprise UI (rediseño visual, 2026-09-07) — Configuración > Marca.
-- Migracion aditiva: agrega favicon_url a core.platform_settings (fuente
-- recomendada 512x512, ver docs/DESIGN_SYSTEM.md). No se construye un
-- pipeline de generacion de variantes (16/32/48/180/192/512) — se sirve el
-- mismo archivo para todos los tamaños via <link rel="icon">, el navegador
-- lo escala; las variantes quedan documentadas como nota, no como feature.
-- Ajuste aprobado explicitamente por el usuario (ver conversacion de
-- aprobacion del Bloque 1).
--
-- get_platform_settings usa RETURNS TABLE (OUT params implicitos) — agregar
-- una columna cambia el tipo fila compuesto, Postgres exige DROP FUNCTION
-- antes del create (no alcanza con create or replace, ver error real al
-- intentarlo sin el drop). update_platform_settings cambia de 7 a 8
-- argumentos: tambien se dropea la version vieja para no dejar dos
-- overloads coexistiendo.
-- =============================================================================
alter table core.platform_settings
  add column if not exists favicon_url text;

comment on column core.platform_settings.favicon_url is
  'Favicon de toda la plataforma. Fuente recomendada 512x512 (PNG/ICO) -- se sirve tal cual para todos los tamaños de <link rel="icon">, sin generar variantes 16/32/48/180/192 por separado.';

drop function if exists public.get_platform_settings();
drop function if exists public.update_platform_settings(text, text, text, text, text, jsonb, text);

create function public.get_platform_settings()
returns table (
  logo_url text,
  login_background_url text,
  favicon_url text,
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
  select logo_url, login_background_url, favicon_url, eyebrow_text, heading_text, tagline, bullets, copyright_text
  from core.platform_settings
  where id = 1;
$$;

comment on function public.get_platform_settings is
  'Lectura publica de la config de marca (login + copyright + favicon). Sin datos sensibles — se llama sin sesion desde la pantalla de login.';

revoke execute on function public.get_platform_settings() from public;
grant execute on function public.get_platform_settings() to anon, authenticated;

create function public.update_platform_settings(
  p_logo_url text default null,
  p_login_background_url text default null,
  p_eyebrow_text text default null,
  p_heading_text text default null,
  p_tagline text default null,
  p_bullets jsonb default null,
  p_copyright_text text default null,
  p_favicon_url text default null
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
    favicon_url = case
      when p_favicon_url is null then favicon_url
      when p_favicon_url = '' then null
      else p_favicon_url
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
