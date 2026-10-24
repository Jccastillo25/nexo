-- Paso Cero (2026-10-23): matriz de permisos del panel de plataforma (super
-- admin) de apps/nexo. Solo catalogo: no crea tablas ni asigna permisos a
-- nadie. Estos codigos se evaluaran con core.has_platform_permission (fuera de
-- toda empresa), no con has_permission. Diseno en docs/plan/21-plataforma-empresas.md.
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('nexo.plataforma.empresas.ver',              'nexo', 'plataforma', 'Ver empresas',                    'Ver la lista de empresas con su cupo, usuarios activos y apps.'),
  ('nexo.plataforma.empresas.crear',            'nexo', 'plataforma', 'Crear empresas',                  'Dar de alta una empresa y su primer administrador.'),
  ('nexo.plataforma.empresas.editar',           'nexo', 'plataforma', 'Editar empresas',                 'Editar nombre, RUC y cupo de usuarios de una empresa.'),
  ('nexo.plataforma.empresas.desactivar',       'nexo', 'plataforma', 'Desactivar empresas',             'Bloquear o reactivar el acceso de una empresa completa.'),
  ('nexo.plataforma.empresas.entrar',           'nexo', 'plataforma', 'Entrar a empresas',               'Entrar a cualquier empresa con los permisos de su dueño. Queda auditado.'),
  ('nexo.plataforma.modulos.asignar',           'nexo', 'plataforma', 'Asignar módulos',                 'Activar o quitar aplicaciones a una empresa.'),
  ('nexo.plataforma.administradores.gestionar', 'nexo', 'plataforma', 'Gestionar super administradores', 'Dar o quitar el acceso de super administrador.'),
  ('nexo.plataforma.auditoria.ver',             'nexo', 'plataforma', 'Ver auditoría de plataforma',     'Historial de cambios de empresas, módulos y super administradores.'),
  ('nexo.plataforma.marca.editar',              'nexo', 'plataforma', 'Editar marca de la plataforma',   'Editar logo, imagen de fondo y textos del login de toda la suite.');
