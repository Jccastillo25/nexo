-- Revisión de seguridad 2026-10-17, hallazgo H4
-- (docs/status-log/2026-10-17-revision-seguridad.md).
--
-- 20260830000012 revocó EXECUTE a anon sobre la firma de 7 argumentos de
-- public.update_platform_settings. Al agregarse p_favicon_url
-- (20260907223910) la función se recreó con 8 argumentos; esa migración
-- revocó PUBLIC pero no anon, que la volvió a recibir por los default
-- privileges (advisor anon_security_definer_function_executable). proacl
-- remoto verificado el 2026-10-17: postgres, anon, authenticated y
-- service_role, sin PUBLIC. El revoke incluye public por si acaso (no-op). La función ya rechaza
-- a anon adentro (auth.uid() nulo → "No autorizado"); esto cierra la puerta
-- también a nivel de privilegios. get_platform_settings sigue con anon a
-- propósito (la lee el login sin sesión) y no se toca.
--
-- Por qué volvió: los default privileges de Supabase dan EXECUTE a anon (y
-- Postgres a PUBLIC) en cada función creada. Si update_platform_settings se
-- vuelve a crear con otra firma, repetir este revoke en la misma migración.
--
-- Rollback (estado exacto anterior): grant execute on function public.update_platform_settings(text, text, text, text, text, jsonb, text, text) to anon;

do $$
begin
  if to_regprocedure('public.update_platform_settings(text, text, text, text, text, jsonb, text, text)') is null then
    raise exception 'precheck: no existe update_platform_settings con 8 argumentos';
  end if;
end $$;

revoke execute on function public.update_platform_settings(text, text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.update_platform_settings(text, text, text, text, text, jsonb, text, text) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.update_platform_settings(text, text, text, text, text, jsonb, text, text)', 'EXECUTE') then
    raise exception 'postcheck: anon todavía puede ejecutar update_platform_settings';
  end if;
  if not has_function_privilege('authenticated', 'public.update_platform_settings(text, text, text, text, text, jsonb, text, text)', 'EXECUTE') then
    raise exception 'postcheck: authenticated perdió EXECUTE sobre update_platform_settings';
  end if;
end $$;
