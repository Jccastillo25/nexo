-- =============================================================================
-- Flotilla: Entregas — E2: esquema, integridad, auditoría e idempotencia
--
-- Diseño: docs/plan/22-flotilla-entregas.md §11 y §21. Requiere el Paso Cero
-- 20261024034727_flotilla_entregas_paso_cero (36 permisos flotilla).
--
-- Resumen:
--   1. Schema `flotilla` cerrado: sin acceso directo de anon/authenticated; todo
--      pasa por RPC public.flotilla_* (E3 en adelante). RLS activo en todas las
--      tablas y sin policies: fallo cerrado aunque alguien dé un GRANT por error.
--   2. Catálogos (no particionados): zonas, bodegas, vehiculos, conductores,
--      motivos, reglas_envio (versionadas), plantillas_mensaje.
--   3. Control de origen: origenes + origen_lineas. `comprometida` se mantiene
--      por trigger desde orden_lineas y un CHECK impide superar lo autorizado.
--   4. Estado de trabajo (no particionado, con FK entrantes y updates):
--      ordenes, orden_lineas, validaciones, recorridos, paradas, parada_lineas,
--      incidencias, evidencias. Contadores de orden_lineas mantenidos por
--      trigger desde parada_lineas, con CHECK de saldo no negativo: dos
--      reservas concurrentes del mismo saldo se serializan en el lock de la
--      fila y la segunda falla el CHECK.
--   5. Hechos particionados por mes (append-only): eventos (bitácora),
--      movimientos (libro de cantidades) y comunicaciones.
--   6. Registro global de operaciones (company_id, operation_id), fuera del
--      histórico particionado: misma clave + mismo payload devuelve el mismo
--      resultado; mismo id con otro payload se rechaza.
--   7. Toda relación entre datos de negocio valida la misma empresa con FK
--      compuestas (id, company_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('flotilla') is not null then
    raise exception 'precheck: el schema flotilla ya existe';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'flotilla') <> 36 then
    raise exception 'precheck: falta el Paso Cero de Flotilla (36 permisos)';
  end if;
  if to_regclass('rrhh.empleados') is null or to_regclass('productos.productos') is null then
    raise exception 'precheck: faltan rrhh.empleados o productos.productos';
  end if;
end;
$$;

create schema flotilla;
revoke all on schema flotilla from public, anon, authenticated;
comment on schema flotilla is
  'Flotilla/Entregas (plan 22). Cerrado: se usa solo por RPC public.flotilla_* con security definer.';

-- Versión optimista: toda tabla mutable sube `version` en cada update.
create or replace function flotilla.fn_subir_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Catálogos
-- -----------------------------------------------------------------------------
create table flotilla.zonas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  descripcion text check (descripcion is null or length(descripcion) <= 500),
  activo boolean not null default true,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id)
);
create unique index zonas_nombre_uq on flotilla.zonas (company_id, lower(btrim(nombre)));

create table flotilla.bodegas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  direccion text check (direccion is null or length(direccion) <= 300),
  activo boolean not null default true,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id)
);
create unique index bodegas_nombre_uq on flotilla.bodegas (company_id, lower(btrim(nombre)));

create table flotilla.vehiculos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  placa text not null check (length(btrim(placa)) between 1 and 20),
  descripcion text check (descripcion is null or length(descripcion) <= 120),
  -- Capacidad segura verificada. Null = sin verificar: el despacho se bloquea.
  capacidad_kg numeric(12,2) check (capacidad_kg is null or capacidad_kg > 0),
  largo_max_m numeric(6,2) check (largo_max_m is null or largo_max_m > 0),
  estado text not null default 'activo' check (estado in ('activo', 'en_taller', 'inactivo')),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id)
);
create unique index vehiculos_placa_uq on flotilla.vehiculos (company_id, upper(btrim(placa)));

-- Extensión operativa de un empleado (DRIVER_ACCESS_AND_KIOSK.md §11): no
-- duplica nombre, documento, contrato ni contraseña.
create table flotilla.conductores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  empleado_id uuid not null,
  licencia_numero text check (licencia_numero is null or length(licencia_numero) <= 40),
  licencia_categoria text check (licencia_categoria is null or length(licencia_categoria) <= 20),
  licencia_vence date,
  estado text not null default 'habilitado' check (estado in ('habilitado', 'deshabilitado')),
  habilitado_por uuid references auth.users(id),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, empleado_id),
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id)
);
create index conductores_empleado_idx on flotilla.conductores (empleado_id);
create index conductores_habilitado_por_idx on flotilla.conductores (habilitado_por);

create table flotilla.motivos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  tipo text not null check (tipo in ('rechazo', 'no_entrega', 'reprogramacion', 'cancelacion', 'incidencia', 'perdida', 'cambio_destino')),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  activo boolean not null default true,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id)
);
create unique index motivos_nombre_uq on flotilla.motivos (company_id, tipo, lower(btrim(nombre)));

-- Reglas de envío versionadas (§8): cada orden guarda la versión aplicada.
-- `es_prueba` marca parámetros de prueba mientras Gerencia no apruebe los
-- reales (§16).
create table flotilla.reglas_envio (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  zona_id uuid,
  version integer not null check (version > 0),
  vigente_desde timestamptz not null default now(),
  parametros jsonb not null default '{}'::jsonb check (jsonb_typeof(parametros) = 'object'),
  es_prueba boolean not null default true,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  unique (id, company_id),
  foreign key (zona_id, company_id) references flotilla.zonas (id, company_id)
);
create unique index reglas_envio_version_uq on flotilla.reglas_envio (company_id, coalesce(zona_id, '00000000-0000-0000-0000-000000000000'::uuid), version);
create index reglas_envio_zona_idx on flotilla.reglas_envio (zona_id);
create index reglas_envio_creado_por_idx on flotilla.reglas_envio (creado_por);

create table flotilla.plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  clave text not null check (clave in ('condiciones', 'propuesta_fecha', 'aviso_llegada', 'atraso', 'incidencia', 'seguimiento')),
  texto text not null check (length(texto) between 1 and 2000),
  activo boolean not null default true,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, clave)
);

-- -----------------------------------------------------------------------------
-- 2. Control de origen (§3)
-- -----------------------------------------------------------------------------
create table flotilla.origenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  sistema text not null default 'AG Negocio' check (length(btrim(sistema)) between 1 and 40),
  tipo text not null check (tipo in ('factura', 'pedido', 'proforma', 'otro')),
  serie text not null default '' check (length(serie) <= 20),
  numero text not null check (length(btrim(numero)) between 1 and 40),
  fecha_documento date,
  cliente_nombre text check (cliente_nombre is null or length(cliente_nombre) <= 200),
  adjunto_path text check (adjunto_path is null or length(adjunto_path) <= 500),
  estado text not null default 'pendiente_verificar' check (estado in ('pendiente_verificar', 'verificado', 'anulado')),
  verificado_por uuid references auth.users(id),
  verificado_en timestamptz,
  creado_por uuid not null references auth.users(id),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  check ((estado = 'verificado') = (verificado_por is not null and verificado_en is not null) or estado = 'anulado')
);
create unique index origenes_clave_uq on flotilla.origenes (company_id, lower(sistema), tipo, upper(btrim(serie)), upper(btrim(numero)));
create index origenes_creado_por_idx on flotilla.origenes (creado_por);
create index origenes_verificado_por_idx on flotilla.origenes (verificado_por);

-- Una fila por línea del documento de origen. `cantidad_autorizada` es la
-- cantidad que Bodega/Administración autorizan para entregar por Nexo; null
-- = sin verificar (bloquea programar). `comprometida` = suma neta de las
-- órdenes (incluidas entregadas), mantenida por trigger.
create table flotilla.origen_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  origen_id uuid not null,
  linea_ref text not null check (length(btrim(linea_ref)) between 1 and 40),
  producto_id uuid,
  codigo_externo text check (codigo_externo is null or length(codigo_externo) <= 60),
  descripcion text not null check (length(btrim(descripcion)) between 1 and 300),
  unidad text not null check (length(btrim(unidad)) between 1 and 20),
  cantidad_documento numeric(14,3) not null check (cantidad_documento > 0),
  cantidad_autorizada numeric(14,3) check (cantidad_autorizada is null or cantidad_autorizada >= 0),
  entregada_externa numeric(14,3) not null default 0 check (entregada_externa >= 0),
  comprometida numeric(14,3) not null default 0 check (comprometida >= 0),
  autorizada_por uuid references auth.users(id),
  autorizada_en timestamptz,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (origen_id, linea_ref),
  foreign key (origen_id, company_id) references flotilla.origenes (id, company_id) on delete cascade,
  foreign key (producto_id, company_id) references productos.productos (id, company_id),
  check (producto_id is not null or codigo_externo is not null),
  check (cantidad_autorizada is null or cantidad_autorizada + entregada_externa <= cantidad_documento),
  -- Lo comprometido entre todas las órdenes nunca supera lo autorizado. Sin
  -- autorización todavía, el tope es lo que queda del documento.
  constraint origen_lineas_no_sobrecomprometer check (
    comprometida <= coalesce(cantidad_autorizada, cantidad_documento - entregada_externa)
  )
);
create index origen_lineas_company_idx on flotilla.origen_lineas (company_id);
create index origen_lineas_producto_idx on flotilla.origen_lineas (producto_id);
create index origen_lineas_autorizada_por_idx on flotilla.origen_lineas (autorizada_por);

-- -----------------------------------------------------------------------------
-- 3. Órdenes (§5.2, §7)
-- -----------------------------------------------------------------------------
create table flotilla.ordenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  folio bigint generated always as identity,
  origen_id uuid not null,
  vendedor_id uuid not null references auth.users(id),
  -- Destinatario y dirección: copia histórica (no es un maestro de clientes).
  destinatario_nombre text not null check (length(btrim(destinatario_nombre)) between 1 and 200),
  destinatario_telefono text check (destinatario_telefono is null or length(destinatario_telefono) <= 30),
  receptor_autorizado text check (receptor_autorizado is null or length(receptor_autorizado) <= 200),
  direccion text check (direccion is null or length(direccion) <= 500),
  referencia text check (referencia is null or length(referencia) <= 500),
  latitud numeric(9,6) check (latitud is null or latitud between -90 and 90),
  longitud numeric(9,6) check (longitud is null or longitud between -180 and 180),
  enlace_ubicacion text check (enlace_ubicacion is null or length(enlace_ubicacion) <= 500),
  zona_id uuid,
  bodega_id uuid,
  motivo_destino text check (motivo_destino is null or length(motivo_destino) <= 300),
  acceso_restricciones text check (acceso_restricciones is null or length(acceso_restricciones) <= 1000),
  condicion_envio text not null default 'requiere_revision' check (condicion_envio in ('elegible', 'no_elegible', 'requiere_revision')),
  regla_envio_id uuid,
  flete_monto numeric(14,2) check (flete_monto is null or flete_monto >= 0),
  flete_moneda text check (flete_moneda is null or flete_moneda in ('NIO', 'USD')),
  flete_autorizado_por uuid references auth.users(id),
  flete_aceptado_cliente boolean not null default false,
  estado text not null default 'borrador' check (estado in (
    'borrador', 'pendiente_validacion', 'lista', 'programada', 'en_reparto', 'entregada', 'cerrada', 'cancelada')),
  -- Tiempos (§8): persistidos en UTC; la operación se interpreta en America/Managua.
  entrega_no_antes_de timestamptz,
  confirmar_antes_de timestamptz,
  ventana_inicio timestamptz,
  ventana_fin timestamptz,
  lista_en timestamptz,
  cerrada_en timestamptz,
  cerrada_por uuid references auth.users(id),
  cierre_motivo text check (cierre_motivo is null or length(cierre_motivo) <= 300),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, folio),
  foreign key (origen_id, company_id) references flotilla.origenes (id, company_id),
  foreign key (zona_id, company_id) references flotilla.zonas (id, company_id),
  foreign key (bodega_id, company_id) references flotilla.bodegas (id, company_id),
  foreign key (regla_envio_id, company_id) references flotilla.reglas_envio (id, company_id),
  check ((flete_monto is null) = (flete_moneda is null)),
  check (ventana_inicio is null or ventana_fin is null or ventana_fin > ventana_inicio)
);
create index ordenes_company_estado_idx on flotilla.ordenes (company_id, estado, creado_en);
create index ordenes_origen_idx on flotilla.ordenes (origen_id);
create index ordenes_vendedor_idx on flotilla.ordenes (vendedor_id, creado_en);
create index ordenes_zona_idx on flotilla.ordenes (zona_id);
create index ordenes_bodega_idx on flotilla.ordenes (bodega_id);
create index ordenes_regla_idx on flotilla.ordenes (regla_envio_id);
create index ordenes_flete_aut_idx on flotilla.ordenes (flete_autorizado_por);
create index ordenes_cerrada_por_idx on flotilla.ordenes (cerrada_por);

-- Contadores por línea (§7 "Reglas cuantitativas"):
--   exigible  = solicitada - aceptada - cancelada            (>= 0)
--   asignable = exigible - asignada - en_transito            (>= 0)
-- asignada/en_transito/aceptada/retornada/perdida los mantiene el trigger de
-- parada_lineas; nadie los escribe a mano.
create table flotilla.orden_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  orden_id uuid not null,
  origen_linea_id uuid not null,
  producto_id uuid,
  codigo_externo text check (codigo_externo is null or length(codigo_externo) <= 60),
  pendiente_vincular boolean not null default false,
  descripcion text not null check (length(btrim(descripcion)) between 1 and 300),
  unidad text not null check (length(btrim(unidad)) between 1 and 20),
  -- Null = sin validar: el planificador lo muestra así y el despacho se bloquea.
  peso_unitario_kg numeric(12,3) check (peso_unitario_kg is null or peso_unitario_kg >= 0),
  largo_m numeric(6,2) check (largo_m is null or largo_m > 0),
  cantidad_solicitada numeric(14,3) not null check (cantidad_solicitada > 0),
  cantidad_cancelada numeric(14,3) not null default 0 check (cantidad_cancelada >= 0),
  cantidad_aceptada numeric(14,3) not null default 0 check (cantidad_aceptada >= 0),
  cantidad_asignada numeric(14,3) not null default 0 check (cantidad_asignada >= 0),
  cantidad_en_transito numeric(14,3) not null default 0 check (cantidad_en_transito >= 0),
  cantidad_retornada numeric(14,3) not null default 0 check (cantidad_retornada >= 0),
  cantidad_perdida numeric(14,3) not null default 0 check (cantidad_perdida >= 0),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (orden_id, origen_linea_id),
  foreign key (orden_id, company_id) references flotilla.ordenes (id, company_id) on delete cascade,
  foreign key (origen_linea_id, company_id) references flotilla.origen_lineas (id, company_id),
  foreign key (producto_id, company_id) references productos.productos (id, company_id),
  constraint orden_lineas_exigible_no_negativo check (cantidad_aceptada + cantidad_cancelada <= cantidad_solicitada),
  constraint orden_lineas_sin_doble_despacho check (
    cantidad_aceptada + cantidad_cancelada + cantidad_asignada + cantidad_en_transito <= cantidad_solicitada)
);
create index orden_lineas_company_idx on flotilla.orden_lineas (company_id);
create index orden_lineas_origen_linea_idx on flotilla.orden_lineas (origen_linea_id);
create index orden_lineas_producto_idx on flotilla.orden_lineas (producto_id);

-- Validación vigente por orden y tipo (§6 paso 3). Queda atada a la versión de
-- la orden validada: si la orden cambia, la validación deja de ser vigente.
create table flotilla.validaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  orden_id uuid not null,
  tipo text not null check (tipo in ('pago', 'material')),
  resultado text not null check (resultado in ('aprobada', 'rechazada')),
  orden_version integer not null,
  nota text check (nota is null or length(nota) <= 1000),
  evidencia_id uuid,
  validado_por uuid not null references auth.users(id),
  validado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (orden_id, tipo),
  foreign key (orden_id, company_id) references flotilla.ordenes (id, company_id) on delete cascade
);
create index validaciones_company_idx on flotilla.validaciones (company_id);
create index validaciones_validado_por_idx on flotilla.validaciones (validado_por);

-- -----------------------------------------------------------------------------
-- 4. Recorridos, paradas y asignaciones (§5.3–5.6, §7)
-- -----------------------------------------------------------------------------
create table flotilla.recorridos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  fecha date not null,
  bodega_id uuid,
  vehiculo_id uuid,
  conductor_id uuid,
  estado text not null default 'borrador' check (estado in (
    'borrador', 'planificado', 'en_preparacion', 'listo_salida', 'en_curso', 'finalizado', 'conciliado', 'cancelado', 'abortado')),
  inspeccion_ok boolean,
  inspeccion_notas text check (inspeccion_notas is null or length(inspeccion_notas) <= 1000),
  inspeccion_por uuid references auth.users(id),
  inspeccion_en timestamptz,
  despachado_por uuid references auth.users(id),
  despachado_en timestamptz,
  finalizado_en timestamptz,
  conciliado_por uuid references auth.users(id),
  conciliado_en timestamptz,
  -- Resumen de costos capturados (§13); sin contabilidad.
  costo_combustible numeric(14,2) check (costo_combustible is null or costo_combustible >= 0),
  costo_otros numeric(14,2) check (costo_otros is null or costo_otros >= 0),
  costo_moneda text check (costo_moneda is null or costo_moneda in ('NIO', 'USD')),
  notas text check (notas is null or length(notas) <= 1000),
  creado_por uuid not null references auth.users(id),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  foreign key (bodega_id, company_id) references flotilla.bodegas (id, company_id),
  foreign key (vehiculo_id, company_id) references flotilla.vehiculos (id, company_id),
  foreign key (conductor_id, company_id) references flotilla.conductores (id, company_id),
  check (estado in ('borrador', 'planificado', 'cancelado') or (vehiculo_id is not null and conductor_id is not null))
);
create index recorridos_company_fecha_idx on flotilla.recorridos (company_id, fecha, estado);
create index recorridos_bodega_idx on flotilla.recorridos (bodega_id);
create index recorridos_vehiculo_idx on flotilla.recorridos (vehiculo_id, fecha);
create index recorridos_conductor_idx on flotilla.recorridos (conductor_id, fecha);
create index recorridos_creado_por_idx on flotilla.recorridos (creado_por);
create index recorridos_inspeccion_por_idx on flotilla.recorridos (inspeccion_por);
create index recorridos_despachado_por_idx on flotilla.recorridos (despachado_por);
create index recorridos_conciliado_por_idx on flotilla.recorridos (conciliado_por);
-- Un vehículo y un conductor no pueden estar en dos recorridos que ya salieron o están por salir.
create unique index recorridos_vehiculo_activo_uq on flotilla.recorridos (vehiculo_id) where estado in ('listo_salida', 'en_curso');
create unique index recorridos_conductor_activo_uq on flotilla.recorridos (conductor_id) where estado in ('listo_salida', 'en_curso');

-- Cada parada es un intento de entrega de una orden. Un reintento crea otra
-- parada (intento_num + 1) vinculada a la anterior; nunca otra orden.
create table flotilla.paradas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  recorrido_id uuid not null,
  orden_id uuid not null,
  secuencia integer not null check (secuencia > 0),
  intento_num integer not null default 1 check (intento_num > 0),
  intento_anterior_id uuid,
  estado text not null default 'pendiente_confirmacion' check (estado in (
    'pendiente_confirmacion', 'confirmada', 'en_camino', 'en_destino', 'descargando', 'completa', 'parcial', 'fallida', 'cancelada')),
  confirmacion text not null default 'pendiente' check (confirmacion in ('pendiente', 'aceptada', 'rechazada')),
  evidencia_estado text not null default 'pendiente' check (evidencia_estado in ('pendiente', 'adjunta', 'validada')),
  ventana_inicio timestamptz,
  ventana_fin timestamptz,
  -- Promesa original: no se sobrescribe al reprogramar (§8).
  ventana_original_inicio timestamptz,
  ventana_original_fin timestamptz,
  receptor_nombre text check (receptor_nombre is null or length(receptor_nombre) <= 200),
  llegada_en timestamptz,
  resultado_en timestamptz,
  motivo_id uuid,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  foreign key (recorrido_id, company_id) references flotilla.recorridos (id, company_id) on delete cascade,
  foreign key (orden_id, company_id) references flotilla.ordenes (id, company_id),
  foreign key (intento_anterior_id, company_id) references flotilla.paradas (id, company_id),
  foreign key (motivo_id, company_id) references flotilla.motivos (id, company_id),
  check (ventana_inicio is null or ventana_fin is null or ventana_fin > ventana_inicio)
);
create unique index paradas_secuencia_uq on flotilla.paradas (recorrido_id, secuencia) where estado <> 'cancelada';
create index paradas_orden_idx on flotilla.paradas (orden_id, intento_num);
create index paradas_company_idx on flotilla.paradas (company_id, estado);
create index paradas_intento_anterior_idx on flotilla.paradas (intento_anterior_id);
create index paradas_motivo_idx on flotilla.paradas (motivo_id);

-- Asignación de una línea de orden a una parada, con su ciclo físico:
--   reservada → cargada → con_resultado → conciliada   (o liberada)
-- Invariantes por fila (§7):
--   cargada <= asignada; en un intento: aceptada + rechazada + no_entregada = cargada;
--   al conciliar: cargada = aceptada + retornada + perdida.
create table flotilla.parada_lineas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parada_id uuid not null,
  orden_linea_id uuid not null,
  estado text not null default 'reservada' check (estado in ('reservada', 'cargada', 'con_resultado', 'conciliada', 'liberada')),
  cantidad_asignada numeric(14,3) not null check (cantidad_asignada > 0),
  cantidad_cargada numeric(14,3) check (cantidad_cargada is null or cantidad_cargada >= 0),
  cantidad_aceptada numeric(14,3) not null default 0 check (cantidad_aceptada >= 0),
  cantidad_rechazada numeric(14,3) not null default 0 check (cantidad_rechazada >= 0),
  cantidad_no_entregada numeric(14,3) not null default 0 check (cantidad_no_entregada >= 0),
  cantidad_retornada numeric(14,3) not null default 0 check (cantidad_retornada >= 0),
  cantidad_perdida numeric(14,3) not null default 0 check (cantidad_perdida >= 0),
  diferencia_motivo text check (diferencia_motivo is null or length(diferencia_motivo) <= 500),
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (parada_id, orden_linea_id),
  foreign key (parada_id, company_id) references flotilla.paradas (id, company_id) on delete cascade,
  foreign key (orden_linea_id, company_id) references flotilla.orden_lineas (id, company_id),
  check (cantidad_cargada is null or cantidad_cargada <= cantidad_asignada),
  check (estado in ('reservada', 'liberada') or cantidad_cargada is not null),
  check (estado not in ('reservada', 'liberada')
         or (cantidad_aceptada = 0 and cantidad_rechazada = 0 and cantidad_no_entregada = 0
             and cantidad_retornada = 0 and cantidad_perdida = 0)),
  check (estado not in ('con_resultado', 'conciliada')
         or cantidad_aceptada + cantidad_rechazada + cantidad_no_entregada = cantidad_cargada),
  check (estado <> 'cargada' or (cantidad_aceptada = 0 and cantidad_rechazada = 0 and cantidad_no_entregada = 0)),
  check (cantidad_cargada is null or cantidad_aceptada + cantidad_retornada + cantidad_perdida <= cantidad_cargada),
  check (estado <> 'conciliada' or cantidad_aceptada + cantidad_retornada + cantidad_perdida = cantidad_cargada)
);
create index parada_lineas_company_idx on flotilla.parada_lineas (company_id, estado);
create index parada_lineas_orden_linea_idx on flotilla.parada_lineas (orden_linea_id);
-- MVP (§7): una misma línea no está en dos recorridos activos a la vez.
create unique index parada_lineas_una_activa_uq on flotilla.parada_lineas (orden_linea_id)
  where estado in ('reservada', 'cargada', 'con_resultado');

-- -----------------------------------------------------------------------------
-- 5. Incidencias y evidencias (§5.6–5.7)
-- -----------------------------------------------------------------------------
create table flotilla.incidencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  orden_id uuid not null,
  parada_id uuid,
  motivo_id uuid,
  tipo text not null check (tipo in ('cliente_ausente', 'rechazo', 'dano', 'faltante', 'direccion', 'acceso', 'atraso', 'reclamo', 'otro')),
  gravedad text not null default 'media' check (gravedad in ('baja', 'media', 'alta')),
  descripcion text not null check (length(btrim(descripcion)) between 1 and 2000),
  responsable_id uuid references auth.users(id),
  compromiso_en timestamptz,
  estado text not null default 'abierta' check (estado in ('abierta', 'en_gestion', 'resuelta', 'cerrada')),
  solucion text check (solucion is null or length(solucion) <= 2000),
  creada_por uuid not null references auth.users(id),
  resuelta_por uuid references auth.users(id),
  resuelta_en timestamptz,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  foreign key (orden_id, company_id) references flotilla.ordenes (id, company_id),
  foreign key (parada_id, company_id) references flotilla.paradas (id, company_id),
  foreign key (motivo_id, company_id) references flotilla.motivos (id, company_id),
  check (estado not in ('resuelta', 'cerrada') or (solucion is not null and resuelta_por is not null))
);
create index incidencias_orden_idx on flotilla.incidencias (orden_id);
create index incidencias_parada_idx on flotilla.incidencias (parada_id);
create index incidencias_company_estado_idx on flotilla.incidencias (company_id, estado, compromiso_en);
create index incidencias_motivo_idx on flotilla.incidencias (motivo_id);
create index incidencias_responsable_idx on flotilla.incidencias (responsable_id);
create index incidencias_creada_por_idx on flotilla.incidencias (creada_por);
create index incidencias_resuelta_por_idx on flotilla.incidencias (resuelta_por);

-- Metadatos de archivos privados (bucket privado de E6). `pendiente` hasta que
-- el servidor verifica el objeto: un evento sincronizado con la foto fallida
-- no declara evidencia completa (§10).
create table flotilla.evidencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  orden_id uuid not null,
  parada_id uuid,
  incidencia_id uuid,
  tipo text not null check (tipo in ('documento_origen', 'comprobante_firmado', 'whatsapp', 'foto_material', 'foto_carga', 'otro')),
  storage_path text not null check (length(storage_path) between 1 and 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'adjunta', 'validada', 'rechazada')),
  operation_id uuid,
  subido_por uuid not null references auth.users(id),
  validado_por uuid references auth.users(id),
  validado_en timestamptz,
  version integer not null default 1,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, storage_path),
  foreign key (orden_id, company_id) references flotilla.ordenes (id, company_id),
  foreign key (parada_id, company_id) references flotilla.paradas (id, company_id),
  foreign key (incidencia_id, company_id) references flotilla.incidencias (id, company_id)
);
create index evidencias_orden_idx on flotilla.evidencias (orden_id);
create index evidencias_parada_idx on flotilla.evidencias (parada_id);
create index evidencias_incidencia_idx on flotilla.evidencias (incidencia_id);
create index evidencias_subido_por_idx on flotilla.evidencias (subido_por);
create index evidencias_validado_por_idx on flotilla.evidencias (validado_por);

alter table flotilla.validaciones
  add foreign key (evidencia_id, company_id) references flotilla.evidencias (id, company_id);
create index validaciones_evidencia_idx on flotilla.validaciones (evidencia_id);

-- -----------------------------------------------------------------------------
-- 6. Registro global de operaciones (idempotencia, §10 y §12)
-- -----------------------------------------------------------------------------
create table flotilla.operaciones (
  company_id uuid not null references core.companies(id) on delete cascade,
  operation_id uuid not null,
  comando text not null check (length(comando) between 1 and 80),
  actor_id uuid not null references auth.users(id),
  payload_hash text not null,
  resultado jsonb,
  fecha_dispositivo timestamptz,
  creado_en timestamptz not null default now(),
  primary key (company_id, operation_id)
);
create index operaciones_actor_idx on flotilla.operaciones (actor_id, creado_en);
comment on table flotilla.operaciones is
  'Clave idempotente por empresa, fuera del histórico particionado (§11). Se registra en la misma transacción que el efecto: si la transacción falla, la clave tampoco queda.';

-- -----------------------------------------------------------------------------
-- 7. Hechos particionados por mes
-- -----------------------------------------------------------------------------
create table flotilla.eventos (
  id uuid not null default gen_random_uuid(),
  registrado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  actor_id uuid references auth.users(id),
  accion text not null check (length(accion) between 1 and 80),
  objeto_tipo text not null check (objeto_tipo in (
    'origen', 'orden', 'orden_linea', 'recorrido', 'parada', 'parada_linea', 'incidencia', 'evidencia', 'conductor', 'vehiculo', 'configuracion')),
  objeto_id uuid not null,
  orden_id uuid,
  datos jsonb not null default '{}'::jsonb,
  motivo text check (motivo is null or length(motivo) <= 1000),
  operation_id uuid,
  fecha_dispositivo timestamptz,
  -- Captura por coordinación de un hecho que hizo otra persona (§10).
  capturado_por_otro boolean not null default false,
  primary key (id, registrado_en)
) partition by range (registrado_en);
comment on table flotilla.eventos is
  'Bitácora inmutable de Flotilla (línea de tiempo de la orden y auditoría). La fecha del dispositivo es declarada; registrado_en es la del servidor.';

-- Libro de cantidades: cada cambio físico o administrativo de una línea.
-- Las correcciones se registran como `ajuste` vinculado al movimiento original.
create table flotilla.movimientos (
  id uuid not null default gen_random_uuid(),
  registrado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  orden_linea_id uuid not null,
  parada_linea_id uuid,
  tipo text not null check (tipo in (
    'reservado', 'liberado', 'cargado', 'aceptado', 'rechazado', 'no_entregado', 'retornado', 'perdida', 'cancelado', 'ajuste')),
  cantidad numeric(14,3) not null,
  motivo_id uuid,
  nota text check (nota is null or length(nota) <= 1000),
  ajusta_movimiento_id uuid,
  ajusta_registrado_en timestamptz,
  actor_id uuid references auth.users(id),
  operation_id uuid,
  fecha_dispositivo timestamptz,
  primary key (id, registrado_en),
  check (tipo = 'ajuste' or cantidad >= 0),
  check ((ajusta_movimiento_id is null) = (ajusta_registrado_en is null)),
  check (tipo <> 'ajuste' or ajusta_movimiento_id is not null)
) partition by range (registrado_en);
comment on table flotilla.movimientos is
  'Libro inmutable de cantidades por línea (§7). Los contadores de orden_lineas/parada_lineas son la foto vigente; este libro es la historia.';

create table flotilla.comunicaciones (
  id uuid not null default gen_random_uuid(),
  registrado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  orden_id uuid not null,
  parada_id uuid,
  canal text not null check (canal in ('whatsapp', 'llamada', 'presencial', 'otro')),
  plantilla_clave text,
  mensaje text check (mensaje is null or length(mensaje) <= 2000),
  -- Abrir WhatsApp no es enviar; enviado no es aceptado (§9).
  enviado_declarado boolean not null default false,
  respuesta text check (respuesta is null or respuesta in ('sin_respuesta', 'aceptada', 'rechazada', 'otra')),
  respuesta_detalle text check (respuesta_detalle is null or length(respuesta_detalle) <= 1000),
  evidencia_id uuid,
  actor_id uuid not null references auth.users(id),
  operation_id uuid,
  primary key (id, registrado_en)
) partition by range (registrado_en);

create or replace function flotilla.fn_asegurar_particion_eventos(p_mes date)
returns void language plpgsql set search_path = flotilla, pg_temp as $$
declare
  particion text := 'eventos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('flotilla.' || particion) is null then
    execute format('create table flotilla.%I partition of flotilla.eventos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (company_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (orden_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (objeto_tipo, objeto_id)', particion);
    execute format('create index on flotilla.%I (actor_id)', particion);
    execute format('alter table flotilla.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function flotilla.fn_asegurar_particion_movimientos(p_mes date)
returns void language plpgsql set search_path = flotilla, pg_temp as $$
declare
  particion text := 'movimientos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('flotilla.' || particion) is null then
    execute format('create table flotilla.%I partition of flotilla.movimientos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (company_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (orden_linea_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (parada_linea_id)', particion);
    execute format('create index on flotilla.%I (motivo_id)', particion);
    execute format('create index on flotilla.%I (actor_id)', particion);
    execute format('alter table flotilla.%I enable row level security', particion);
  end if;
end;
$$;

create or replace function flotilla.fn_asegurar_particion_comunicaciones(p_mes date)
returns void language plpgsql set search_path = flotilla, pg_temp as $$
declare
  particion text := 'comunicaciones_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('flotilla.' || particion) is null then
    execute format('create table flotilla.%I partition of flotilla.comunicaciones for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (company_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (orden_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (parada_id)', particion);
    execute format('create index on flotilla.%I (actor_id)', particion);
    execute format('alter table flotilla.%I enable row level security', particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('flotilla', 'eventos', 'flotilla.fn_asegurar_particion_eventos'),
  ('flotilla', 'movimientos', 'flotilla.fn_asegurar_particion_movimientos'),
  ('flotilla', 'comunicaciones', 'flotilla.fn_asegurar_particion_comunicaciones');
select core.fn_asegurar_particiones_futuras(3);

-- -----------------------------------------------------------------------------
-- 8. Invariantes mantenidas por trigger
-- -----------------------------------------------------------------------------
-- 8.1 Lo comprometido de cada línea de origen = suma de (solicitada -
--     cancelada) de sus líneas de orden. El UPDATE toma el lock de la fila de
--     origen: dos órdenes concurrentes sobre la misma línea se serializan y el
--     CHECK origen_lineas_no_sobrecomprometer rechaza la que se pase.
create or replace function flotilla.fn_tg_orden_lineas_comprometer()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_old numeric := 0;
  v_new numeric := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := old.cantidad_solicitada - old.cantidad_cancelada;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := new.cantidad_solicitada - new.cantidad_cancelada;
  end if;
  if tg_op = 'UPDATE' and old.origen_linea_id <> new.origen_linea_id then
    raise exception 'La línea de origen de una línea de orden no se cambia.';
  end if;
  if v_new <> v_old then
    update flotilla.origen_lineas
       set comprometida = comprometida + (v_new - v_old)
     where id = case when tg_op = 'DELETE' then old.origen_linea_id else new.origen_linea_id end;
  end if;
  return null;
end;
$$;
create trigger trg_orden_lineas_comprometer
  after insert or update of cantidad_solicitada, cantidad_cancelada, origen_linea_id or delete
  on flotilla.orden_lineas for each row execute function flotilla.fn_tg_orden_lineas_comprometer();

-- 8.2 Contadores de orden_lineas desde parada_lineas. Aporte de una fila:
--   asignada    = cantidad_asignada si está reservada
--   en_transito = cargada - aceptada - retornada - perdida si está cargada o con resultado
--   aceptada / retornada / perdida = las suyas (en cualquier estado salvo liberada)
-- El UPDATE de orden_lineas toma su lock; los CHECK impiden despachar dos veces
-- el mismo saldo o dejar un saldo negativo.
create or replace function flotilla.fn_aporte_parada_linea(p flotilla.parada_lineas,
  out asignada numeric, out en_transito numeric, out aceptada numeric, out retornada numeric, out perdida numeric)
language sql immutable set search_path = '' as $$
  select
    case when p.estado = 'reservada' then p.cantidad_asignada else 0 end,
    case when p.estado in ('cargada', 'con_resultado')
         then coalesce(p.cantidad_cargada, 0) - p.cantidad_aceptada - p.cantidad_retornada - p.cantidad_perdida else 0 end,
    case when p.estado = 'liberada' then 0 else p.cantidad_aceptada end,
    case when p.estado = 'liberada' then 0 else p.cantidad_retornada end,
    case when p.estado = 'liberada' then 0 else p.cantidad_perdida end;
$$;

create or replace function flotilla.fn_tg_parada_lineas_contadores()
returns trigger language plpgsql set search_path = '' as $$
declare
  o record;
  n record;
begin
  if tg_op = 'UPDATE' and old.orden_linea_id <> new.orden_linea_id then
    raise exception 'La línea de orden de una asignación no se cambia.';
  end if;
  if tg_op = 'UPDATE' and old.estado in ('conciliada', 'liberada') and new.estado <> old.estado then
    raise exception 'Una asignación conciliada o liberada no cambia de estado.';
  end if;
  select 0::numeric as asignada, 0::numeric as en_transito, 0::numeric as aceptada, 0::numeric as retornada, 0::numeric as perdida into o;
  select 0::numeric as asignada, 0::numeric as en_transito, 0::numeric as aceptada, 0::numeric as retornada, 0::numeric as perdida into n;
  if tg_op in ('UPDATE', 'DELETE') then
    select * into o from flotilla.fn_aporte_parada_linea(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into n from flotilla.fn_aporte_parada_linea(new);
  end if;
  update flotilla.orden_lineas
     set cantidad_asignada    = cantidad_asignada    + (n.asignada    - o.asignada),
         cantidad_en_transito = cantidad_en_transito + (n.en_transito - o.en_transito),
         cantidad_aceptada    = cantidad_aceptada    + (n.aceptada    - o.aceptada),
         cantidad_retornada   = cantidad_retornada   + (n.retornada   - o.retornada),
         cantidad_perdida     = cantidad_perdida     + (n.perdida     - o.perdida)
   where id = case when tg_op = 'DELETE' then old.orden_linea_id else new.orden_linea_id end;
  return null;
end;
$$;
create trigger trg_parada_lineas_contadores
  after insert or update or delete on flotilla.parada_lineas
  for each row execute function flotilla.fn_tg_parada_lineas_contadores();

-- 8.3 Transiciones de estado permitidas (§7). Las RPC deciden cuándo; esto
--     impide saltos imposibles aunque una RPC tenga un error.
create or replace function flotilla.fn_tg_transicion()
returns trigger language plpgsql set search_path = '' as $$
declare
  permitidas text[];
begin
  if new.estado = old.estado then
    return new;
  end if;
  permitidas := case tg_table_name
    when 'ordenes' then case old.estado
      when 'borrador' then array['pendiente_validacion', 'cancelada']
      when 'pendiente_validacion' then array['borrador', 'lista', 'cancelada']
      when 'lista' then array['pendiente_validacion', 'programada', 'cancelada']
      when 'programada' then array['lista', 'pendiente_validacion', 'en_reparto', 'cancelada']
      when 'en_reparto' then array['programada', 'lista', 'entregada']
      when 'entregada' then array['cerrada', 'lista']
      when 'cerrada' then array['entregada']
      when 'cancelada' then array[]::text[]
    end
    when 'recorridos' then case old.estado
      when 'borrador' then array['planificado', 'cancelado']
      when 'planificado' then array['borrador', 'en_preparacion', 'cancelado']
      when 'en_preparacion' then array['planificado', 'listo_salida', 'cancelado']
      when 'listo_salida' then array['en_preparacion', 'en_curso', 'cancelado']
      when 'en_curso' then array['finalizado', 'abortado']
      when 'finalizado' then array['conciliado']
      when 'abortado' then array['conciliado']
      else array[]::text[]
    end
    when 'paradas' then case old.estado
      when 'pendiente_confirmacion' then array['confirmada', 'cancelada']
      when 'confirmada' then array['pendiente_confirmacion', 'en_camino', 'cancelada']
      when 'en_camino' then array['en_destino', 'fallida']
      when 'en_destino' then array['descargando', 'fallida']
      when 'descargando' then array['completa', 'parcial', 'fallida']
      else array[]::text[]
    end
    when 'incidencias' then case old.estado
      when 'abierta' then array['en_gestion', 'resuelta']
      when 'en_gestion' then array['abierta', 'resuelta']
      when 'resuelta' then array['en_gestion', 'cerrada']
      when 'cerrada' then array['en_gestion']
    end
  end;
  if not (new.estado = any (coalesce(permitidas, array[]::text[]))) then
    raise exception using errcode = 'P0001',
      message = format('Transición no permitida en %s: %s → %s.', tg_table_name, old.estado, new.estado);
  end if;
  return new;
end;
$$;
create trigger trg_ordenes_transicion before update of estado on flotilla.ordenes
  for each row execute function flotilla.fn_tg_transicion();
create trigger trg_recorridos_transicion before update of estado on flotilla.recorridos
  for each row execute function flotilla.fn_tg_transicion();
create trigger trg_paradas_transicion before update of estado on flotilla.paradas
  for each row execute function flotilla.fn_tg_transicion();
create trigger trg_incidencias_transicion before update of estado on flotilla.incidencias
  for each row execute function flotilla.fn_tg_transicion();

-- 8.4 Hechos inmutables: la bitácora y el libro no se editan ni se borran.
create or replace function flotilla.fn_tg_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = format('%s es inmutable.', tg_table_name);
end;
$$;
create trigger trg_eventos_inmutable before update or delete on flotilla.eventos
  for each row execute function flotilla.fn_tg_inmutable();
create trigger trg_movimientos_inmutable before update or delete on flotilla.movimientos
  for each row execute function flotilla.fn_tg_inmutable();
create trigger trg_comunicaciones_inmutable before update or delete on flotilla.comunicaciones
  for each row execute function flotilla.fn_tg_inmutable();

-- 8.5 Versión optimista.
do $$
declare t text;
begin
  foreach t in array array['zonas', 'bodegas', 'vehiculos', 'conductores', 'motivos', 'plantillas_mensaje',
                           'origenes', 'origen_lineas', 'ordenes', 'orden_lineas', 'recorridos', 'paradas',
                           'parada_lineas', 'incidencias', 'evidencias'] loop
    execute format('create trigger trg_%s_version before update on flotilla.%I for each row execute function flotilla.fn_subir_version()', t, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Helpers internos para las RPC (E3 en adelante)
-- -----------------------------------------------------------------------------
-- Exige al menos uno de los permisos; devuelve el usuario.
create or replace function flotilla.fn_exigir_alguno(p_company_id uuid, p_codes text[])
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c text;
begin
  if v_uid is not null and p_company_id is not null then
    foreach c in array p_codes loop
      if core.has_permission(v_uid, p_company_id, c) then return v_uid; end if;
    end loop;
  end if;
  raise exception using errcode = '42501',
    message = 'No tienes permiso para esta acción.';
end;
$$;

-- Idempotencia (§12). Llamar al inicio de cada mutación, en su transacción:
--   * clave nueva -> la reserva y devuelve null (ejecutar el comando);
--   * misma clave y mismo payload ya resuelta -> devuelve el resultado guardado;
--   * misma clave con otro payload o de otro actor -> error, sin efectos.
-- Una petición concurrente con la misma clave espera en la PK hasta que la
-- primera confirme y luego recibe su resultado.
create or replace function flotilla.fn_operacion_reclamar(
  p_company_id uuid, p_operation_id uuid, p_comando text, p_actor uuid, p_payload jsonb, p_fecha_dispositivo timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_payload, 'null'::jsonb)::text, 'sha256'), 'hex');
  v_row flotilla.operaciones;
begin
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'Falta el identificador de la operación.';
  end if;
  insert into flotilla.operaciones (company_id, operation_id, comando, actor_id, payload_hash, fecha_dispositivo)
  values (p_company_id, p_operation_id, p_comando, p_actor, v_hash, p_fecha_dispositivo)
  on conflict (company_id, operation_id) do nothing;
  if found then
    return null;
  end if;
  select * into v_row from flotilla.operaciones
   where company_id = p_company_id and operation_id = p_operation_id;
  if v_row.comando <> p_comando or v_row.actor_id <> p_actor or v_row.payload_hash <> v_hash then
    raise exception using errcode = 'P0001', message = 'nexo:operacion_distinta',
      detail = 'La misma operación ya se registró con otros datos.';
  end if;
  if v_row.resultado is null then
    raise exception using errcode = 'P0001', message = 'nexo:operacion_en_curso';
  end if;
  return v_row.resultado;
end;
$$;

create or replace function flotilla.fn_operacion_cerrar(p_company_id uuid, p_operation_id uuid, p_resultado jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update flotilla.operaciones set resultado = coalesce(p_resultado, '{}'::jsonb)
   where company_id = p_company_id and operation_id = p_operation_id and resultado is null;
  if not found then
    raise exception 'La operación no estaba reservada o ya se cerró.';
  end if;
  return coalesce(p_resultado, '{}'::jsonb);
end;
$$;

-- Bitácora.
create or replace function flotilla.fn_evento(
  p_company_id uuid, p_actor uuid, p_accion text, p_objeto_tipo text, p_objeto_id uuid,
  p_orden_id uuid default null, p_datos jsonb default '{}'::jsonb, p_motivo text default null,
  p_operation_id uuid default null, p_fecha_dispositivo timestamptz default null, p_capturado_por_otro boolean default false)
returns void language sql security definer set search_path = '' as $$
  insert into flotilla.eventos (company_id, actor_id, accion, objeto_tipo, objeto_id, orden_id, datos, motivo,
                                operation_id, fecha_dispositivo, capturado_por_otro)
  values (p_company_id, p_actor, p_accion, p_objeto_tipo, p_objeto_id, p_orden_id, coalesce(p_datos, '{}'::jsonb),
          p_motivo, p_operation_id, p_fecha_dispositivo, coalesce(p_capturado_por_otro, false));
$$;

-- Libro de cantidades.
create or replace function flotilla.fn_movimiento(
  p_company_id uuid, p_orden_linea_id uuid, p_parada_linea_id uuid, p_tipo text, p_cantidad numeric,
  p_actor uuid, p_operation_id uuid default null, p_motivo_id uuid default null, p_nota text default null,
  p_fecha_dispositivo timestamptz default null)
returns void language sql security definer set search_path = '' as $$
  insert into flotilla.movimientos (company_id, orden_linea_id, parada_linea_id, tipo, cantidad, motivo_id, nota,
                                    actor_id, operation_id, fecha_dispositivo)
  values (p_company_id, p_orden_linea_id, p_parada_linea_id, p_tipo, p_cantidad, p_motivo_id, p_nota,
          p_actor, p_operation_id, p_fecha_dispositivo);
$$;

-- Saldos por línea (§7): exigible, asignado, en tránsito y asignable, cada uno aparte.
create or replace view flotilla.v_saldos_linea with (security_invoker = true) as
select l.id as orden_linea_id, l.company_id, l.orden_id,
       l.cantidad_solicitada,
       l.cantidad_aceptada,
       l.cantidad_cancelada,
       l.cantidad_solicitada - l.cantidad_aceptada - l.cantidad_cancelada as saldo_exigible,
       l.cantidad_asignada as saldo_asignado,
       l.cantidad_en_transito as saldo_en_transito,
       l.cantidad_solicitada - l.cantidad_aceptada - l.cantidad_cancelada - l.cantidad_asignada - l.cantidad_en_transito as saldo_asignable,
       l.peso_unitario_kg is not null as peso_validado
  from flotilla.orden_lineas l;

-- -----------------------------------------------------------------------------
-- 10. Cierre de acceso: RLS sin policies, sin grants directos
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'flotilla' and c.relkind in ('r', 'p') loop
    execute format('alter table flotilla.%I enable row level security', t);
  end loop;
end;
$$;
revoke all on all tables in schema flotilla from public, anon, authenticated;
revoke all on all functions in schema flotilla from public, anon, authenticated;
alter default privileges in schema flotilla revoke all on tables from public, anon, authenticated;
alter default privileges in schema flotilla revoke all on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. Poscheque
-- -----------------------------------------------------------------------------
do $$
declare
  v_tablas int;
  v_sin_rls int;
begin
  select count(*) into v_tablas from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'flotilla' and c.relkind in ('r', 'p') and not c.relispartition;
  if v_tablas <> 21 then
    raise exception 'poscheque: % tablas en flotilla (se esperaban 21)', v_tablas;
  end if;
  select count(*) into v_sin_rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'flotilla' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v_sin_rls > 0 then
    raise exception 'poscheque: % tablas de flotilla sin RLS', v_sin_rls;
  end if;
  if (select count(*) from core.tablas_particionadas where schema_nombre = 'flotilla') <> 3 then
    raise exception 'poscheque: faltan las tablas particionadas registradas';
  end if;
  if to_regclass('flotilla.eventos_' || to_char(now(), 'YYYY_MM')) is null then
    raise exception 'poscheque: falta la partición del mes actual de eventos';
  end if;
  if has_schema_privilege('authenticated', 'flotilla', 'USAGE') or has_schema_privilege('anon', 'flotilla', 'USAGE') then
    raise exception 'poscheque: el schema flotilla no debe estar expuesto';
  end if;
end;
$$;
