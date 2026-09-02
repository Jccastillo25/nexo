-- =============================================================================
-- Nexo — fix WARN del advisor de seguridad tras aplicar 20260902000008:
-- public.crear_empleado quedaba ejecutable por `anon` pese al
-- "revoke ... from public" incluido en esa migracion.
--
-- Causa real (corrige un diagnostico equivocado de la sesion anterior,
-- documentado en 20260902000007): este proyecto Supabase tiene un
-- ALTER DEFAULT PRIVILEGES en el schema public que otorga EXECUTE
-- DIRECTO a anon/authenticated/service_role sobre toda funcion nueva que
-- crea el rol postgres (verificado via pg_default_acl, defaclobjtype='f').
-- No es un grant heredado del pseudo-rol PUBLIC — es un grant explicito
-- por rol. Por eso "revoke ... from public" es un no-op para este caso:
-- nunca toco la fuente real del permiso.
--
-- La migracion 20260902000006 (set_pin_empleado) hizo lo correcto desde
-- el principio: "revoke execute ... from anon" explicito, directo al rol
-- que en realidad tenia el grant. La 20260902000007 solo agrego un
-- "revoke ... from public" redundante que no hizo nada (el fix real ya
-- estaba en 006) — y esta migracion, 20260902000009, copia el patron
-- correcto de 006 para crear_empleado.
--
-- Verificado en pg_catalog/information_schema.role_routine_grants antes de
-- escribir este archivo: anon SI tenia EXECUTE en crear_empleado, no lo
-- tenia en set_pin_empleado. Riesgo real: bajo (crear_empleado exige
-- core.has_permission(auth.uid(), ...) adentro, y auth.uid() es null para
-- anon -> deniega igual) pero el codigo debe reflejar lo que documenta.
-- =============================================================================

revoke execute on function public.crear_empleado(
  uuid, text, text, text, text, text, text, text, text, text, date, text, numeric
) from anon;
