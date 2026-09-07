-- =============================================================================
-- F1.0.1 -- Cierre de acceso operativo PIN heredado (D-06, docs/IMPLEMENTATION_STATUS.md).
--
-- public.validar_acceso_operativo(p_nombre_usuario text, p_pin text) sigue
-- expuesta a anon/authenticated desde 20260902000008_rrhh_nicaragua_and_contracts,
-- para un login movil de choferes que nunca se construyo (verificado en F1.0,
-- 2026-09-07: cero consumidores en apps/ ni packages/, via busqueda estatica
-- de "validar_acceso_operativo" en todo el monorepo). docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md
-- y docs/DRIVER_ACCESS_AND_KIOSK.md (seccion 10) rechazan el diseno de PIN de
-- doble proposito como arquitectura final: el PIN es exclusivamente de
-- asistencia/kiosko, nunca credencial de una sesion Web/Mobile.
--
-- Esta migracion NO reescribe 20260902000008 (migracion aplicada, no se
-- edita): solo revoca el EXECUTE que esa migracion otorgo sobre el wrapper
-- publico. rrhh.fn_validar_acceso_operativo (la funcion interna) ya no tenia
-- EXECUTE para anon/authenticated desde 20260905000004
-- (revoke_rrhh_internal_public_execute) -- solo el wrapper publico quedaba
-- expuesto; verificado con has_function_privilege antes de escribir esta
-- migracion.
--
-- No se elimina ninguna funcion todavia: ambas quedan marcadas
-- explicitamente como deprecadas via `comment on function`, pendientes de
-- una migracion de limpieza posterior y separada que decida el destino de
-- rrhh.seguridad_accesos y de las columnas nombre_usuario/user_id/
-- pin_bloqueado/intentos_fallidos de rrhh.empleados, en conjunto con F1.1-F1.3.
--
-- Verificado despues de aplicar (has_function_privilege):
--   anon.execute          -> false
--   authenticated.execute -> false
--   service_role.execute  -> true  (sin cambios, esperado)
--   postgres.execute      -> true  (sin cambios, esperado)
-- El advisor de seguridad "Public Can Execute SECURITY DEFINER Function"
-- para esta funcion ya no aparece en get_advisors(security) tras aplicar.
-- =============================================================================

revoke execute on function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text) from anon, authenticated;

comment on function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text) is
  'DEPRECADA (2026-09-07, F1.0.1): EXECUTE revocado de anon/authenticated. El diseno de PIN de doble proposito (login operativo con el mismo PIN del kiosko) queda rechazado como arquitectura final por docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md y docs/DRIVER_ACCESS_AND_KIOSK.md (seccion 10). Sin consumidores en el codigo (verificado F1.0, 2026-09-07). No eliminar sin una migracion de limpieza aparte que tambien evalue rrhh.fn_validar_acceso_operativo, rrhh.seguridad_accesos y rrhh.empleados.nombre_usuario/user_id/pin_bloqueado/intentos_fallidos.';

comment on function rrhh.fn_validar_acceso_operativo(p_nombre_usuario text, p_pin text) is
  'DEPRECADA (2026-09-07, F1.0.1): PIN de doble proposito rechazado como arquitectura final -- ver docs/DRIVER_ACCESS_AND_KIOSK.md seccion 10. Sin consumidores en el codigo (verificado F1.0). Su wrapper publico (public.validar_acceso_operativo) ya no tiene EXECUTE para anon/authenticated desde esta misma migracion; el EXECUTE interno (este schema) ya estaba restringido a postgres/service_role desde 20260905000004. No eliminar todavia: pendiente de una migracion de limpieza posterior que decida el destino de rrhh.seguridad_accesos y de las columnas nombre_usuario/user_id/pin_bloqueado/intentos_fallidos de rrhh.empleados, en conjunto con F1.1-F1.3.';
