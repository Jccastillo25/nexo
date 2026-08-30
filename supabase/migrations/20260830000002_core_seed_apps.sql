-- =============================================================================
-- Semilla de core.apps con los 4 modulos ya importados (ver docs/MODULES.md).
-- Cada INSERT dispara trg_seed_module_permission y crea su permiso base
-- "<slug>.ver_modulo" en core.permissions_catalog automaticamente.
-- =============================================================================

insert into core.apps (slug, name, category, icon, color, route, depends) values
  ('nexo',     'Nexo',     null,                    null,      'gris',    '/',         '{}'),
  ('rrhh',     'RRHH',     'RRHH',                  'users-round', 'ambar', '/rrhh',     '{}'),
  ('flotilla', 'Flotilla', 'Cadena de suministro',  'truck',       'azul',  '/flotilla', '{}'),
  ('crm',      'CRM',      'Ventas',                'handshake',   'rosa',  '/crm',      '{}');
