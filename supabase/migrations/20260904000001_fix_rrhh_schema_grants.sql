-- =============================================================================
-- Fix real del 500 en /rrhh/dashboard ("No se pudo cargar el dashboard: " con
-- mensaje vacio -- 42501 "permission denied for schema rrhh" de PostgREST).
--
-- Mismo bug que 20260830000010_fix_crm_schema_grants.sql corrigio para crm:
-- 20260902000006_rrhh_schema_and_tables.sql armo RLS correctamente sobre las
-- 12 tablas de rrhh (incluidas las particiones mensuales), pero nunca hizo el
-- GRANT base de Postgres. RLS filtra FILAS, no reemplaza el permiso de
-- tabla/schema -- sin este GRANT, cualquier SELECT/INSERT/UPDATE/DELETE del
-- rol `authenticated` falla con "permission denied" ANTES de llegar siquiera
-- a evaluar las policies.
--
-- Verificado antes de escribir esto (Verificacion Remota Obligatoria):
--   - has_schema_privilege('authenticated', 'rrhh', 'USAGE') = false
--   - curl al REST endpoint con Accept-Profile: rrhh -> 42501 permission
--     denied (no 404 "schema not found" -- descarta que falte exponer el
--     schema en Data API, es puramente el GRANT de Postgres)
--   - crm.authenticated ya tiene USAGE (por el fix de 20260830000010); rrhh
--     nunca lo tuvo porque no se replico ese fix al crear el schema rrhh
--
-- anon NO recibe grant a proposito, mismo patron que crm: el kiosko (unico
-- acceso no autenticado a datos de rrhh) pasa por RPCs SECURITY DEFINER en
-- public (fn_validar_acceso_operativo, fn_registrar_marca_kiosko), nunca por
-- acceso directo a tablas.
-- =============================================================================

grant usage on schema rrhh to authenticated;

grant select, insert, update, delete on all tables in schema rrhh to authenticated;
