-- Paso Cero del módulo Atención (turnos de sala de espera) + permisos de
-- sucursales. Aprobado por el usuario el 2026-10-14. Solo catálogo y
-- plantillas: sin tablas. La app queda inactiva y sin empresa habilitada.
-- Diseño: docs/plan/13-atencion-turnos.md.
do $$
begin
  if exists (select 1 from core.apps where slug = 'atencion')
     or exists (select 1 from core.permissions_catalog where module_slug = 'atencion' or code like 'nexo.administracion.sucursales.%')
     or exists (select 1 from core.app_roles where module_slug = 'atencion') then
    raise exception 'precheck: Atención o sucursales ya registradas';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('atencion', 'Atención', 'Servicios', 'ticket', 'teal', '/atencion', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'atencion.ver_modulo') then
    raise exception 'el trigger no creó atencion.ver_modulo';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('atencion.recepcion.sesion.iniciar',         'atencion', 'recepcion',     'Iniciar atención en recepción',  'Abrir la recepción de la sucursal para registrar clientes.'),
  ('atencion.recepcion.turno.crear',            'atencion', 'recepcion',     'Entregar turnos',                'Registrar nombre, teléfono y factura y asignar el número.'),
  ('atencion.recepcion.turno.cancelar',         'atencion', 'recepcion',     'Anular turnos',                  'Anular un turno en espera.'),
  ('atencion.puesto.sesion.iniciar',            'atencion', 'puesto',        'Iniciar atención en un puesto',  'Tomar automáticamente el primer puesto libre de la sucursal.'),
  ('atencion.puesto.turno.llamar',              'atencion', 'puesto',        'Llamar turnos',                  'Llamar al siguiente turno o repetir el llamado.'),
  ('atencion.puesto.turno.llamar_fuera_orden',  'atencion', 'puesto',        'Llamar fuera de orden',          'Llamar un turno específico sin respetar el orden.'),
  ('atencion.puesto.turno.finalizar',           'atencion', 'puesto',        'Finalizar turnos',               'Marcar el turno como atendido.'),
  ('atencion.puesto.turno.marcar_ausente',      'atencion', 'puesto',        'Marcar ausentes',                'Marcar que el cliente no se presentó.'),
  ('atencion.cola.turno.ver',                   'atencion', 'cola',          'Ver la fila',                    'Ver los turnos en espera de la sucursal.'),
  ('atencion.cliente.datos.ver',                'atencion', 'cliente',       'Ver datos del cliente',          'Ver teléfono y número de factura del turno.'),
  ('atencion.configuracion.puesto.gestionar',   'atencion', 'configuracion', 'Gestionar puestos',              'Crear, renombrar y desactivar puestos de atención.'),
  ('atencion.configuracion.sesion.liberar',     'atencion', 'configuracion', 'Liberar puestos',                'Cerrar la atención de otro usuario y liberar su puesto.'),
  ('atencion.configuracion.pantalla.gestionar', 'atencion', 'configuracion', 'Gestionar pantallas',            'Configurar pantallas públicas y entretenimiento.'),
  ('atencion.reportes.turno.ver',               'atencion', 'reportes',      'Ver reportes',                   'Tiempos de espera y atención, ausencias y llamados fuera de orden.'),
  ('nexo.administracion.sucursales.ver',        'nexo',     'administracion','Ver sucursales',                 'Ver las sucursales de la empresa.'),
  ('nexo.administracion.sucursales.gestionar',  'nexo',     'administracion','Gestionar sucursales',           'Crear, editar y desactivar sucursales.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('atencion', 'recepcion',  'Recepción',          'Registra clientes y entrega turnos.'),
  ('atencion', 'agente',     'Agente de atención', 'Atiende en un puesto: llama, finaliza y marca ausentes.'),
  ('atencion', 'supervisor', 'Supervisor',         'Todo el módulo, incluida la configuración y los reportes.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'atencion'
where r.module_slug = 'atencion'
  and (
    r.role_key = 'supervisor'
    or (r.role_key = 'recepcion' and p.code in (
      'atencion.ver_modulo', 'atencion.recepcion.sesion.iniciar', 'atencion.recepcion.turno.crear',
      'atencion.recepcion.turno.cancelar', 'atencion.cola.turno.ver', 'atencion.cliente.datos.ver'))
    or (r.role_key = 'agente' and p.code in (
      'atencion.ver_modulo', 'atencion.puesto.sesion.iniciar', 'atencion.puesto.turno.llamar',
      'atencion.puesto.turno.llamar_fuera_orden', 'atencion.puesto.turno.finalizar',
      'atencion.puesto.turno.marcar_ausente', 'atencion.cola.turno.ver', 'atencion.cliente.datos.ver'))
  );
