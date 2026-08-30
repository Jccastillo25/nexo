-- Permisos del modulo CRM, dominio "clientes".
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('crm.clientes.ver',      'crm', 'clientes', 'Ver clientes',      'Listar y ver el detalle de clientes en el CRM.'),
  ('crm.clientes.crear',    'crm', 'clientes', 'Crear clientes',    'Dar de alta un cliente nuevo en el CRM.'),
  ('crm.clientes.editar',   'crm', 'clientes', 'Editar clientes',   'Modificar los datos de un cliente existente.'),
  ('crm.clientes.eliminar', 'crm', 'clientes', 'Eliminar clientes', 'Eliminar un cliente del CRM.');
