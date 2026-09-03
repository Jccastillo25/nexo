-- =============================================================================
-- Nexo — habilita RRHH en el Launcher central (grilla de apps de apps/nexo).
--
-- Causa raiz verificada via MCP de Supabase (Verificacion Remota
-- Obligatoria, CLAUDE.md): core.apps SI tiene la fila 'rrhh' (category
-- 'RRHH', route '/rrhh', active=true) y core.permissions_catalog SI tiene
-- 'rrhh.ver_modulo' (autoseeded por trg_seed_module_permission al crear el
-- modulo). El usuario dueño de la empresa es 'owner' en
-- core.company_memberships, asi que core.has_permission() lo deja pasar
-- por el bypass de owner/admin sin necesitar una fila en
-- core.user_permissions.
--
-- El bloqueo real esta en core.get_visible_apps(), que exige ademas un
-- join contra core.company_apps con enabled=true para esa empresa — y la
-- migracion de seed original (20260830000004_seed_materiales_jcastillo.sql)
-- solo habilito 'nexo' y 'crm' ahi. rrhh (y flotilla) nunca se habilitaron
-- para 'materiales-jcastillo', por eso no aparecian en el Launcher pese a
-- estar activos en core.apps.
--
-- Este es un insert de datos de catalogo (core.company_apps), no una
-- migracion de schema — no aplica la regla de tabla-de-hechos-particionada
-- (esto es una tabla de relacion company<->app habilitada, no un evento).
-- =============================================================================

insert into core.company_apps (company_id, app_id, enabled)
select c.id, a.id, true
from core.companies c
join core.apps a on a.slug = 'rrhh'
where c.slug = 'materiales-jcastillo'
on conflict (company_id, app_id) do update set enabled = true;
