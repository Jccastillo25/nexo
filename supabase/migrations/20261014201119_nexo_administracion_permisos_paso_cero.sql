-- Paso Cero (2026-10-14): matriz de permisos de la administracion de
-- usuarios y roles de apps/nexo. Solo catalogo: no crea tablas ni asigna
-- permisos a nadie. Diseno completo en docs/plan/12-administracion-usuarios-roles.md.
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('nexo.administracion.usuarios.ver',        'nexo', 'administracion', 'Ver usuarios',        'Ver la lista y la ficha de usuarios de la empresa.'),
  ('nexo.administracion.usuarios.crear',      'nexo', 'administracion', 'Crear usuarios',      'Dar de alta usuarios con contraseña y rol.'),
  ('nexo.administracion.usuarios.editar',     'nexo', 'administracion', 'Editar usuarios',     'Editar datos, rol, vínculo con RRHH y restablecer contraseña.'),
  ('nexo.administracion.usuarios.desactivar', 'nexo', 'administracion', 'Desactivar usuarios', 'Bloquear o reactivar el acceso de un usuario.'),
  ('nexo.administracion.roles.ver',           'nexo', 'administracion', 'Ver roles',           'Ver roles y sus permisos.'),
  ('nexo.administracion.roles.crear',         'nexo', 'administracion', 'Crear roles',         'Crear roles con apps y permisos.'),
  ('nexo.administracion.roles.editar',        'nexo', 'administracion', 'Editar roles',        'Cambiar las apps y permisos de un rol.'),
  ('nexo.administracion.roles.eliminar',      'nexo', 'administracion', 'Eliminar roles',      'Eliminar un rol sin usuarios asignados.'),
  ('nexo.administracion.auditoria.ver',       'nexo', 'administracion', 'Ver auditoría',       'Historial de cambios de usuarios y roles.');
