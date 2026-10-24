-- Paso Cero de Flotilla: Entregas (docs/plan/22-flotilla-entregas.md §19).
--
-- Aprobado por el usuario el 2026-10-23 ("Si").
--
-- Pedido del usuario (2026-10-23): "Lanza sin agentes para que podamos tener
-- flotilla listo e implementar esto que te envié" (especificación de Entregas,
-- plan 22). La app `flotilla` ya existe en core.apps con su `ver_modulo`; esta
-- migración solo agrega el catálogo de permisos y las plantillas.
--
-- No crea tablas, no cambia core.apps.active, no habilita la app para la
-- empresa y no asigna nada a usuarios ni a roles de empresa.
--
-- Resultado esperado: 36 permisos flotilla (ver_modulo + 35) y plantillas
-- vendedor 8, coordinador 24, bodega 12, administracion 10, conductor 4,
-- gerencia 36.

-- 0. Prechequeo: solo existe flotilla.ver_modulo y no hay plantillas ni schema.
do $$
begin
  if not exists (select 1 from core.apps where slug = 'flotilla') then
    raise exception 'Prechequeo: falta la app flotilla en core.apps';
  end if;
  if not exists (select 1 from core.permissions_catalog where code = 'flotilla.ver_modulo') then
    raise exception 'Prechequeo: falta flotilla.ver_modulo';
  end if;
  if exists (select 1 from core.permissions_catalog
             where (module_slug = 'flotilla' or code like 'flotilla.%') and code <> 'flotilla.ver_modulo') then
    raise exception 'Prechequeo: ya hay permisos de flotilla además de ver_modulo';
  end if;
  if exists (select 1 from core.app_roles where module_slug = 'flotilla') then
    raise exception 'Prechequeo: ya hay plantillas de flotilla';
  end if;
  if exists (select 1 from information_schema.schemata where schema_name = 'flotilla') then
    raise exception 'Prechequeo: ya existe el schema flotilla';
  end if;
end $$;

-- 1. Permisos (4 segmentos).
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('flotilla.dashboard.indicadores.ver',          'flotilla', 'dashboard',     'Ver tablero de entregas',       'Tablero de pendientes, programados, en reparto, parciales e incidencias.'),
  ('flotilla.entregas.orden_propia.ver',          'flotilla', 'entregas',      'Ver mis órdenes',               'Ver las órdenes de entrega que uno creó.'),
  ('flotilla.entregas.orden.ver',                 'flotilla', 'entregas',      'Ver todas las órdenes',         'Ver todas las órdenes de entrega de la empresa.'),
  ('flotilla.entregas.orden.crear',               'flotilla', 'entregas',      'Crear órdenes',                 'Crear una orden de entrega desde un documento de venta.'),
  ('flotilla.entregas.orden.editar',              'flotilla', 'entregas',      'Editar órdenes',                'Completar o cambiar datos de la orden; invalida confirmaciones o preparaciones afectadas.'),
  ('flotilla.entregas.orden.cancelar',            'flotilla', 'entregas',      'Cancelar órdenes',              'Cancelar la orden o su saldo autorizado.'),
  ('flotilla.entregas.orden.cerrar',              'flotilla', 'entregas',      'Cerrar órdenes',                'Cierre administrativo con evidencia, conciliación e incidencias resueltas.'),
  ('flotilla.entregas.orden.reabrir',             'flotilla', 'entregas',      'Reabrir órdenes',               'Reabrir una orden cerrada con motivo, sin borrar su historia.'),
  ('flotilla.entregas.pago.validar',              'flotilla', 'entregas',      'Validar pago o crédito',        'Registrar la validación de pago o crédito de la orden.'),
  ('flotilla.entregas.material.validar',          'flotilla', 'entregas',      'Validar material',              'Validar existencia y la cantidad autorizada por línea del documento de origen.'),
  ('flotilla.entregas.cliente.confirmar',         'flotilla', 'entregas',      'Confirmar con el cliente',      'Registrar comunicaciones y la aceptación de condiciones y fecha.'),
  ('flotilla.entregas.cobro.conciliar',           'flotilla', 'entregas',      'Conciliar cobros',              'Conciliar los cobros autorizados de un recorrido.'),
  ('flotilla.entregas.recepcion.corregir',        'flotilla', 'entregas',      'Corregir recepciones',          'Ajuste vinculado a una recepción mal capturada; el registro original no cambia.'),
  ('flotilla.entregas.evidencia.ver',             'flotilla', 'entregas',      'Ver evidencias',                'Ver y descargar evidencias dentro del alcance propio.'),
  ('flotilla.entregas.evidencia.adjuntar',        'flotilla', 'entregas',      'Adjuntar evidencias',           'Adjuntar fotos y comprobantes a órdenes, paradas o incidencias.'),
  ('flotilla.rutas.recorrido.ver',                'flotilla', 'rutas',         'Ver recorridos',                'Ver recorridos y el planificador diario.'),
  ('flotilla.rutas.recorrido.programar',          'flotilla', 'rutas',         'Programar recorridos',          'Crear recorridos, asignar paradas y cantidades y ordenar las paradas.'),
  ('flotilla.rutas.recorrido.despachar',          'flotilla', 'rutas',         'Despachar recorridos',          'Autorizar la salida con todas las validaciones vigentes.'),
  ('flotilla.rutas.parada.reprogramar',           'flotilla', 'rutas',         'Reprogramar paradas',           'Reprogramar una parada o crear un nuevo intento para el saldo.'),
  ('flotilla.rutas.recorrido.cerrar',             'flotilla', 'rutas',         'Cerrar recorridos',             'Finalizar el recorrido y marcarlo conciliado.'),
  ('flotilla.bodega.carga.preparar',              'flotilla', 'bodega',        'Preparar carga',                'Preparar la carga y registrar diferencias.'),
  ('flotilla.bodega.carga.validar',               'flotilla', 'bodega',        'Validar carga',                 'Validar cantidades cargadas, amarre y documentos.'),
  ('flotilla.bodega.retorno.conciliar',           'flotilla', 'bodega',        'Conciliar retornos',            'Recibir retornos y documentar pérdidas o daños.'),
  ('flotilla.conductor.recorrido_propio.operar',  'flotilla', 'conductor',     'Operar mis recorridos',         'Panel de conductor: solo los recorridos asignados a uno.'),
  ('flotilla.incidencias.incidencia.crear',       'flotilla', 'incidencias',   'Reportar incidencias',          'Reportar una incidencia de una orden o parada.'),
  ('flotilla.incidencias.incidencia.gestionar',   'flotilla', 'incidencias',   'Gestionar incidencias',         'Asignar responsable y compromiso y documentar la solución.'),
  ('flotilla.incidencias.incidencia.resolver',    'flotilla', 'incidencias',   'Resolver incidencias',          'Resolver y cerrar incidencias.'),
  ('flotilla.flota.vehiculo.ver',                 'flotilla', 'flota',         'Ver vehículos',                 'Ver vehículos y capacidades.'),
  ('flotilla.flota.vehiculo.gestionar',           'flotilla', 'flota',         'Gestionar vehículos',           'Alta, edición, capacidades y estado de vehículos.'),
  ('flotilla.conductores.perfil.ver',             'flotilla', 'conductores',   'Ver conductores',               'Ver los empleados habilitados como conductores.'),
  ('flotilla.conductores.perfil.habilitar',       'flotilla', 'conductores',   'Habilitar conductores',         'Habilitar o deshabilitar a un empleado con contrato activo como conductor.'),
  ('flotilla.configuracion.reglas.gestionar',     'flotilla', 'configuracion', 'Gestionar configuración',       'Zonas, bodegas, calendario, condiciones de envío, motivos y plantillas de mensajes.'),
  ('flotilla.configuracion.excepcion.aprobar',    'flotilla', 'configuracion', 'Aprobar excepciones',           'Aprobar excepciones comerciales como envío gratis en revisión o flete.'),
  ('flotilla.reportes.entregas.ver',              'flotilla', 'reportes',      'Ver reportes',                  'Reportes de entregas, pendientes, incidencias y costos capturados.'),
  ('flotilla.reportes.entregas.exportar',         'flotilla', 'reportes',      'Exportar reportes',             'Exportar CSV con el mismo alcance que la pantalla.');

-- 2. Plantillas.
insert into core.app_roles (module_slug, role_key, label, description) values
  ('flotilla', 'vendedor',       'Vendedor',       'Crea y sigue sus propias órdenes de entrega.'),
  ('flotilla', 'coordinador',    'Coordinador',    'Programa, despacha, reprograma, resuelve incidencias y cierra.'),
  ('flotilla', 'bodega',         'Bodega',         'Valida material, prepara y valida carga y concilia retornos.'),
  ('flotilla', 'administracion', 'Administración', 'Valida pago o crédito y concilia cobros.'),
  ('flotilla', 'conductor',      'Conductor',      'Opera solo sus recorridos asignados desde el teléfono.'),
  ('flotilla', 'gerencia',       'Gerencia',       'Toda la app, incluidas reglas y excepciones.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'flotilla'
where r.module_slug = 'flotilla'
  and (
    r.role_key = 'gerencia'
    or (r.role_key = 'vendedor' and p.code in (
      'flotilla.ver_modulo',
      'flotilla.dashboard.indicadores.ver',
      'flotilla.entregas.orden_propia.ver',
      'flotilla.entregas.orden.crear',
      'flotilla.entregas.orden.editar',
      'flotilla.entregas.cliente.confirmar',
      'flotilla.entregas.evidencia.ver',
      'flotilla.incidencias.incidencia.crear'))
    or (r.role_key = 'coordinador' and p.code in (
      'flotilla.ver_modulo',
      'flotilla.dashboard.indicadores.ver',
      'flotilla.entregas.orden.ver',
      'flotilla.entregas.orden.crear',
      'flotilla.entregas.orden.editar',
      'flotilla.entregas.orden.cancelar',
      'flotilla.entregas.orden.cerrar',
      'flotilla.entregas.orden.reabrir',
      'flotilla.entregas.cliente.confirmar',
      'flotilla.entregas.recepcion.corregir',
      'flotilla.entregas.evidencia.ver',
      'flotilla.entregas.evidencia.adjuntar',
      'flotilla.rutas.recorrido.ver',
      'flotilla.rutas.recorrido.programar',
      'flotilla.rutas.recorrido.despachar',
      'flotilla.rutas.parada.reprogramar',
      'flotilla.rutas.recorrido.cerrar',
      'flotilla.incidencias.incidencia.crear',
      'flotilla.incidencias.incidencia.gestionar',
      'flotilla.incidencias.incidencia.resolver',
      'flotilla.flota.vehiculo.ver',
      'flotilla.conductores.perfil.ver',
      'flotilla.reportes.entregas.ver',
      'flotilla.reportes.entregas.exportar'))
    or (r.role_key = 'bodega' and p.code in (
      'flotilla.ver_modulo',
      'flotilla.dashboard.indicadores.ver',
      'flotilla.entregas.orden.ver',
      'flotilla.entregas.material.validar',
      'flotilla.entregas.evidencia.ver',
      'flotilla.entregas.evidencia.adjuntar',
      'flotilla.rutas.recorrido.ver',
      'flotilla.bodega.carga.preparar',
      'flotilla.bodega.carga.validar',
      'flotilla.bodega.retorno.conciliar',
      'flotilla.incidencias.incidencia.crear',
      'flotilla.flota.vehiculo.ver'))
    or (r.role_key = 'administracion' and p.code in (
      'flotilla.ver_modulo',
      'flotilla.dashboard.indicadores.ver',
      'flotilla.entregas.orden.ver',
      'flotilla.entregas.pago.validar',
      'flotilla.entregas.cobro.conciliar',
      'flotilla.entregas.evidencia.ver',
      'flotilla.rutas.recorrido.ver',
      'flotilla.incidencias.incidencia.crear',
      'flotilla.reportes.entregas.ver',
      'flotilla.reportes.entregas.exportar'))
    or (r.role_key = 'conductor' and p.code in (
      'flotilla.ver_modulo',
      'flotilla.conductor.recorrido_propio.operar',
      'flotilla.entregas.evidencia.adjuntar',
      'flotilla.incidencias.incidencia.crear'))
  );

-- 3. Poscheque.
do $$
declare
  v_permisos int;
  v_conteo record;
  v_esperado jsonb := '{"vendedor": 8, "coordinador": 24, "bodega": 12, "administracion": 10, "conductor": 4, "gerencia": 36}';
begin
  select count(*) into v_permisos from core.permissions_catalog where module_slug = 'flotilla';
  if v_permisos <> 36 then
    raise exception 'Poscheque: % permisos flotilla (se esperaban 36)', v_permisos;
  end if;

  for v_conteo in
    select r.role_key, count(rp.permission_code) as n
    from core.app_roles r
    left join core.app_role_permissions rp on rp.app_role_id = r.id
    where r.module_slug = 'flotilla'
    group by r.role_key
  loop
    if (v_esperado ->> v_conteo.role_key)::int is distinct from v_conteo.n then
      raise exception 'Poscheque: la plantilla % tiene % permisos (se esperaban %)',
        v_conteo.role_key, v_conteo.n, v_esperado ->> v_conteo.role_key;
    end if;
  end loop;

  if exists (select 1 from core.permissions_catalog
             where module_slug = 'flotilla' and code <> 'flotilla.ver_modulo'
               and array_length(string_to_array(code, '.'), 1) <> 4) then
    raise exception 'Poscheque: hay códigos que no tienen 4 segmentos';
  end if;

  -- Separación de funciones.
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'flotilla' and r.role_key = 'conductor'
               and rp.permission_code in ('flotilla.entregas.orden.ver', 'flotilla.entregas.orden_propia.ver',
                                          'flotilla.rutas.recorrido.ver', 'flotilla.reportes.entregas.ver')) then
    raise exception 'Poscheque: el conductor solo ve sus recorridos';
  end if;
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'flotilla' and r.role_key in ('vendedor', 'coordinador', 'bodega')
               and rp.permission_code in ('flotilla.entregas.pago.validar', 'flotilla.entregas.cobro.conciliar')) then
    raise exception 'Poscheque: pago y cobros son de Administración o Gerencia';
  end if;
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'flotilla' and r.role_key in ('vendedor', 'administracion', 'conductor')
               and rp.permission_code in ('flotilla.rutas.recorrido.despachar', 'flotilla.bodega.carga.validar',
                                          'flotilla.entregas.recepcion.corregir')) then
    raise exception 'Poscheque: vendedor, administración y conductor no despachan, no validan carga ni corrigen recepciones';
  end if;
  if exists (select 1 from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
             where r.module_slug = 'flotilla' and r.role_key <> 'gerencia'
               and rp.permission_code in ('flotilla.configuracion.reglas.gestionar', 'flotilla.configuracion.excepcion.aprobar',
                                          'flotilla.flota.vehiculo.gestionar', 'flotilla.conductores.perfil.habilitar')) then
    raise exception 'Poscheque: configuración, excepciones, vehículos y habilitación son solo de Gerencia';
  end if;
  if exists (select 1 from information_schema.schemata where schema_name = 'flotilla') then
    raise exception 'Poscheque: el Paso Cero no debe crear el schema';
  end if;
end $$;
