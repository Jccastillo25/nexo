-- =============================================================================
-- Fix real del 500 en /crm/clientes (bug pendiente desde el inicio de la
-- migracion de este modulo). 20260830000005_crm_schema.sql armo RLS
-- correctamente sobre crm.clientes, pero se olvido el GRANT base de
-- Postgres: RLS filtra FILAS, no reemplaza el permiso de tabla/schema.
-- Sin este GRANT, cualquier SELECT/INSERT/UPDATE/DELETE del rol
-- `authenticated` fallaba con "permission denied for table clientes"
-- ANTES de llegar siquiera a evaluar las policies.
--
-- El schema `core` NO necesita esto: a proposito nunca se expone via API
-- directa, todo pasa por las funciones SECURITY DEFINER de `public`
-- (has_permission, get_visible_apps) que corren con privilegios propios.
-- =============================================================================

grant usage on schema crm to authenticated;
grant select, insert, update, delete on crm.clientes to authenticated;
