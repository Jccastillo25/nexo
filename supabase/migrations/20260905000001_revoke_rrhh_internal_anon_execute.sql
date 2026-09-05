-- =============================================================================
-- Nexo — auditoria de seguridad de RRHH antes de pruebas funcionales del MVP
-- (pedido explicito del usuario, 2026-09-05). Corrige el hallazgo #1 de
-- docs/RRHH_MVP.md "Riesgos de seguridad": funciones INTERNAS del schema
-- rrhh ejecutables por `anon` pese a que sus wrappers en `public` ya
-- revocan ese acceso.
--
-- Evidencia consultada antes de escribir esta migracion (Verificacion
-- Remota Obligatoria, 2026-09-05):
--   - get_advisors(type=security): WARN "anon_security_definer_function_executable"
--     para rrhh.fn_crear_empleado, rrhh.fn_set_pin_empleado y
--     rrhh.fn_registrar_marca_kiosko (esta ultima SI es intencional, no se
--     toca aqui) y rrhh.fn_validar_acceso_operativo (intencional, no se
--     toca). Tambien WARN para public.get_visible_apps ejecutable por
--     anon, pese a que 20260830000008_get_visible_apps.sql ya hace
--     "revoke execute ... from public".
--   - has_function_privilege('anon', <oid>, 'EXECUTE') = true para
--     rrhh.fn_crear_empleado y rrhh.fn_set_pin_empleado, confirmado por
--     SQL directo contra pg_proc/pg_namespace.
--   - Causa raiz (mismo patron ya diagnosticado en
--     20260902000009_fix_crear_empleado_anon_grant.sql para
--     public.crear_empleado): este proyecto tiene un ALTER DEFAULT
--     PRIVILEGES que otorga EXECUTE directo a anon/authenticated sobre
--     toda funcion nueva creada por el rol postgres. "revoke ... from
--     public" (la pseudo-fila PUBLIC) es un no-op contra ese grant
--     directo — hace falta "revoke ... from anon" explicito, al rol
--     real que tiene el permiso.
--
-- Clasificacion (no se asume, se distingue explicito):
--   - CONFIRMADO como riesgo: rrhh.fn_crear_empleado, rrhh.fn_set_pin_empleado
--     y public.get_visible_apps ejecutables por anon sin que el diseño lo
--     pida. Ambas funciones rrhh.* ya tienen un chequeo interno
--     (core.has_permission(auth.uid(), ...)) que hace que la llamada como
--     anon falle igual (auth.uid() es null) — por eso el riesgo era bajo
--     en la practica, pero dependia de una sola capa de defensa en vez de
--     dos. get_visible_apps no expone datos sensibles por si sola (solo
--     cruza core.apps/core.company_apps), pero no hay ninguna razon de
--     diseño para que anon la ejecute (el panel siempre la llama
--     autenticado) — se revoca por consistencia con el "solo
--     authenticated" que la migracion original ya queria.
--   - DECISION DELIBERADA, no se toca aqui: rrhh.fn_registrar_marca_kiosko
--     y rrhh.fn_validar_acceso_operativo siguen anon-ejecutables a
--     proposito (el kiosko fisico y el login operativo no tienen sesion
--     de Supabase Auth) — ver la migracion siguiente
--     (20260905000002) para el endurecimiento propio del kiosko.
-- =============================================================================

revoke execute on function rrhh.fn_crear_empleado(
  uuid, text, text, text, text, text, text, text, text, text, date, text, numeric
) from anon;

revoke execute on function rrhh.fn_set_pin_empleado(uuid, uuid, text) from anon;

-- Redundante con el "revoke ... from public" que ya existe en
-- 20260830000008, pero explicito contra el rol real (mismo criterio que
-- arriba) — sin efecto sobre el uso real del panel, que siempre llama
-- esta funcion autenticado.
revoke execute on function public.get_visible_apps(uuid) from anon;
