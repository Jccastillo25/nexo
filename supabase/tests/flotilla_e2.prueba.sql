-- Pruebas de E2 de Flotilla (esquema de Entregas, plan 22 §21). Solo PGlite:
-- entorno flotilla_entorno.sql + migración 20261024140400. Todo dentro de una
-- transacción que se revierte. Empresas y personas con prefijo PRUEBA.
-- Escenarios del plan 22 §15 que cubre el modelo: 5 (carga 100, acepta 80,
-- retorna 20), 6 (intento fallido y nuevo intento), 18 (factura de 100 en dos
-- destinos), 19 (corrección de 100 a 80) y la integridad por empresa.
-- No prueba RLS efectiva, roles reales de Supabase ni concurrencia entre
-- sesiones: eso queda para el ensayo en nexo-core.
begin;

create temp table t_ids (k text primary key, v uuid) on commit drop;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from t_ids where k = p_k $$;
create function pg_temp.como(p_usuario text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(pg_temp.id(p_usuario)::text, ''), true)
$$;
create function pg_temp.limpio(p text) returns text language sql as $$
  select btrim(regexp_replace(coalesce(p, ''), '[^[:alpha:][:digit:] .,:]', ' ', 'g'))
$$;
create function pg_temp.debe_fallar(p_sql text, p_esperado text, p_caso text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_esperado || '%' then
      raise exception 'FALLO E2: % dio otro error: %', p_caso, pg_temp.limpio(sqlerrm);
    end if;
    return;
  end;
  raise exception 'FALLO E2: % no fue rechazado', p_caso;
end;
$$;
create function pg_temp.igual(p_real numeric, p_esperado numeric, p_caso text) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLO E2: % da % y se esperaba %', p_caso, coalesce(p_real::text, 'nulo'), p_esperado;
  end if;
end;
$$;
create function pg_temp.saldo(p_linea text, p_campo text) returns numeric language plpgsql as $$
declare v numeric;
begin
  execute format('select %I from flotilla.v_saldos_linea where orden_linea_id = $1', p_campo) into v using pg_temp.id(p_linea);
  return v;
end;
$$;

-- Datos base -------------------------------------------------------------------
insert into t_ids values
  ('empresa', '00000000-0000-4000-8000-00000000000a'), ('otra', '00000000-0000-4000-8000-00000000000b'),
  ('vendedor', gen_random_uuid()), ('coordinador', gen_random_uuid()), ('sin_permiso', gen_random_uuid()),
  ('empleado', gen_random_uuid()), ('empleado_otra', gen_random_uuid()), ('producto', gen_random_uuid()),
  ('producto_otra', gen_random_uuid()), ('origen', gen_random_uuid()), ('ol1', gen_random_uuid()),
  ('origen_otra', gen_random_uuid()), ('ol_otra', gen_random_uuid()),
  ('orden_a', gen_random_uuid()), ('orden_b', gen_random_uuid()), ('la', gen_random_uuid()), ('lb', gen_random_uuid()),
  ('vehiculo', gen_random_uuid()), ('conductor', gen_random_uuid()), ('rec1', gen_random_uuid()), ('rec2', gen_random_uuid()),
  ('p1', gen_random_uuid()), ('p2', gen_random_uuid()), ('pl1', gen_random_uuid()), ('pl2', gen_random_uuid()), ('op', gen_random_uuid());

insert into core.companies values (pg_temp.id('empresa'), 'PRUEBA Empresa', 'prueba-e'), (pg_temp.id('otra'), 'PRUEBA Otra', 'prueba-o');
insert into auth.users select pg_temp.id(k) from unnest(array['vendedor', 'coordinador', 'sin_permiso']) k;
insert into core.prueba_permisos values
  (pg_temp.id('coordinador'), pg_temp.id('empresa'), 'flotilla.rutas.recorrido.programar'),
  (pg_temp.id('vendedor'), pg_temp.id('empresa'), 'flotilla.entregas.orden.crear');
insert into rrhh.empleados values (pg_temp.id('empleado'), pg_temp.id('empresa'), 'PRUEBA', 'Conductor'),
                                  (pg_temp.id('empleado_otra'), pg_temp.id('otra'), 'PRUEBA', 'Ajeno');
insert into productos.productos values (pg_temp.id('producto'), pg_temp.id('empresa'), 'PRUEBA Varilla'),
                                       (pg_temp.id('producto_otra'), pg_temp.id('otra'), 'PRUEBA Ajeno');

-- Factura de 100 unidades autorizadas (escenario 18).
insert into flotilla.origenes (id, company_id, tipo, numero, creado_por)
values (pg_temp.id('origen'), pg_temp.id('empresa'), 'factura', 'PRUEBA-100', pg_temp.id('vendedor')),
       (pg_temp.id('origen_otra'), pg_temp.id('otra'), 'factura', 'PRUEBA-200', pg_temp.id('vendedor'));
insert into flotilla.origen_lineas (id, company_id, origen_id, linea_ref, producto_id, descripcion, unidad, cantidad_documento, cantidad_autorizada)
values (pg_temp.id('ol1'), pg_temp.id('empresa'), pg_temp.id('origen'), '1', pg_temp.id('producto'), 'PRUEBA Varilla 3/8', 'UND', 100, 100),
       (pg_temp.id('ol_otra'), pg_temp.id('otra'), pg_temp.id('origen_otra'), '1', pg_temp.id('producto_otra'), 'PRUEBA Ajeno', 'UND', 50, 50);

-- 1. Clave de origen única ------------------------------------------------------
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.origenes (company_id, tipo, numero, creado_por) values (%L, 'factura', ' prueba-100 ', %L)$q$,
  pg_temp.id('empresa'), pg_temp.id('vendedor')), 'origenes_clave_uq', 'documento de origen duplicado');

-- 2. Integridad por empresa -------------------------------------------------------
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.origen_lineas (company_id, origen_id, linea_ref, producto_id, descripcion, unidad, cantidad_documento)
     values (%L, %L, '9', %L, 'x', 'UND', 1)$q$, pg_temp.id('empresa'), pg_temp.id('origen'), pg_temp.id('producto_otra')),
  'foreign key', 'producto de otra empresa');
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.conductores (company_id, empleado_id) values (%L, %L)$q$, pg_temp.id('empresa'), pg_temp.id('empleado_otra')),
  'foreign key', 'conductor con empleado de otra empresa');

insert into flotilla.ordenes (id, company_id, origen_id, vendedor_id, destinatario_nombre)
values (pg_temp.id('orden_a'), pg_temp.id('empresa'), pg_temp.id('origen'), pg_temp.id('vendedor'), 'PRUEBA Destino A'),
       (pg_temp.id('orden_b'), pg_temp.id('empresa'), pg_temp.id('origen'), pg_temp.id('vendedor'), 'PRUEBA Destino B');
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.orden_lineas (company_id, orden_id, origen_linea_id, descripcion, unidad, cantidad_solicitada)
     values (%L, %L, %L, 'x', 'UND', 1)$q$, pg_temp.id('empresa'), pg_temp.id('orden_a'), pg_temp.id('ol_otra')),
  'foreign key', 'línea de origen de otra empresa');

-- 3. Escenario 18: dos destinos no superan lo autorizado ------------------------
insert into flotilla.orden_lineas (id, company_id, orden_id, origen_linea_id, producto_id, descripcion, unidad, cantidad_solicitada)
values (pg_temp.id('la'), pg_temp.id('empresa'), pg_temp.id('orden_a'), pg_temp.id('ol1'), pg_temp.id('producto'), 'PRUEBA Varilla 3/8', 'UND', 60);
select pg_temp.igual((select comprometida from flotilla.origen_lineas where id = pg_temp.id('ol1')), 60, 'comprometida tras la orden A');
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.orden_lineas (company_id, orden_id, origen_linea_id, descripcion, unidad, cantidad_solicitada)
     values (%L, %L, %L, 'x', 'UND', 100)$q$, pg_temp.id('empresa'), pg_temp.id('orden_b'), pg_temp.id('ol1')),
  'origen_lineas_no_sobrecomprometer', 'segunda orden de 100 sobre 100 autorizadas');
insert into flotilla.orden_lineas (id, company_id, orden_id, origen_linea_id, producto_id, descripcion, unidad, cantidad_solicitada)
values (pg_temp.id('lb'), pg_temp.id('empresa'), pg_temp.id('orden_b'), pg_temp.id('ol1'), pg_temp.id('producto'), 'PRUEBA Varilla 3/8', 'UND', 40);
select pg_temp.igual((select comprometida from flotilla.origen_lineas where id = pg_temp.id('ol1')), 100, 'comprometida con dos destinos');
select pg_temp.debe_fallar(format(
  $q$update flotilla.origen_lineas set cantidad_autorizada = 90 where id = %L$q$, pg_temp.id('ol1')),
  'origen_lineas_no_sobrecomprometer', 'bajar lo autorizado por debajo de lo comprometido');
select pg_temp.debe_fallar(format(
  $q$update flotilla.orden_lineas set cantidad_solicitada = 100 where id = %L$q$, pg_temp.id('la')),
  'origen_lineas_no_sobrecomprometer', 'subir la orden A a 100 con B en 40');
-- Cancelar el saldo de B libera lo comprometido.
update flotilla.orden_lineas set cantidad_cancelada = 40 where id = pg_temp.id('lb');
select pg_temp.igual((select comprometida from flotilla.origen_lineas where id = pg_temp.id('ol1')), 60, 'comprometida tras cancelar B');
update flotilla.orden_lineas set cantidad_solicitada = 100 where id = pg_temp.id('la');
select pg_temp.igual((select comprometida from flotilla.origen_lineas where id = pg_temp.id('ol1')), 100, 'A sube a 100 con B cancelada');

-- 4. Recursos: vehículo y conductor ---------------------------------------------
insert into flotilla.vehiculos (id, company_id, placa, capacidad_kg) values (pg_temp.id('vehiculo'), pg_temp.id('empresa'), 'PRUEBA-1', 3000);
insert into flotilla.conductores (id, company_id, empleado_id) values (pg_temp.id('conductor'), pg_temp.id('empresa'), pg_temp.id('empleado'));
insert into flotilla.recorridos (id, company_id, fecha, vehiculo_id, conductor_id, creado_por)
values (pg_temp.id('rec1'), pg_temp.id('empresa'), current_date, pg_temp.id('vehiculo'), pg_temp.id('conductor'), pg_temp.id('coordinador')),
       (pg_temp.id('rec2'), pg_temp.id('empresa'), current_date, pg_temp.id('vehiculo'), pg_temp.id('conductor'), pg_temp.id('coordinador'));
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.recorridos (company_id, fecha, estado, creado_por) values (%L, current_date, 'en_preparacion', %L)$q$,
  pg_temp.id('empresa'), pg_temp.id('coordinador')), 'check', 'recorrido en preparación sin vehículo ni conductor');

-- 5. Reservas: una línea en un solo recorrido activo y sin doble despacho -------
insert into flotilla.paradas (id, company_id, recorrido_id, orden_id, secuencia)
values (pg_temp.id('p1'), pg_temp.id('empresa'), pg_temp.id('rec1'), pg_temp.id('orden_a'), 1),
       (pg_temp.id('p2'), pg_temp.id('empresa'), pg_temp.id('rec2'), pg_temp.id('orden_a'), 1);
insert into flotilla.parada_lineas (id, company_id, parada_id, orden_linea_id, cantidad_asignada)
values (pg_temp.id('pl1'), pg_temp.id('empresa'), pg_temp.id('p1'), pg_temp.id('la'), 100);
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignado'), 100, 'asignado tras reservar 100');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 0, 'asignable tras reservar 100');
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.parada_lineas (company_id, parada_id, orden_linea_id, cantidad_asignada) values (%L, %L, %L, 1)$q$,
  pg_temp.id('empresa'), pg_temp.id('p2'), pg_temp.id('la')), 'parada_lineas_una_activa_uq', 'la misma línea en dos recorridos activos');
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set cantidad_asignada = 101 where id = %L$q$, pg_temp.id('pl1')),
  'orden_lineas_sin_doble_despacho', 'reservar más que el saldo');

-- 6. Escenario 5: carga 100, acepta 80, rechaza 20, retorna 20 ------------------
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set estado = 'cargada', cantidad_cargada = 101 where id = %L$q$, pg_temp.id('pl1')),
  'check', 'cargar más que lo reservado');
update flotilla.parada_lineas set estado = 'cargada', cantidad_cargada = 100 where id = pg_temp.id('pl1');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignado'), 0, 'asignado tras cargar');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_en_transito'), 100, 'en tránsito tras cargar');
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set estado = 'con_resultado', cantidad_aceptada = 80, cantidad_rechazada = 10 where id = %L$q$,
  pg_temp.id('pl1')), 'check', 'resultado que no cuadra con lo cargado');
update flotilla.parada_lineas set estado = 'con_resultado', cantidad_aceptada = 80, cantidad_rechazada = 20 where id = pg_temp.id('pl1');
select pg_temp.igual(pg_temp.saldo('la', 'cantidad_aceptada'), 80, 'aceptado 80');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_en_transito'), 20, 'rechazo sigue en tránsito hasta conciliar');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 0, 'no se libera antes de conciliar');
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set estado = 'conciliada' where id = %L$q$, pg_temp.id('pl1')),
  'check', 'conciliar sin registrar el retorno');
update flotilla.parada_lineas set estado = 'conciliada', cantidad_retornada = 20 where id = pg_temp.id('pl1');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_exigible'), 20, 'quedan 20 pendientes');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 20, '20 asignables tras conciliar');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_en_transito'), 0, 'nada en tránsito tras conciliar');
-- El siguiente intento no puede cargar 100: solo el saldo.
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.parada_lineas (company_id, parada_id, orden_linea_id, cantidad_asignada) values (%L, %L, %L, 100)$q$,
  pg_temp.id('empresa'), pg_temp.id('p2'), pg_temp.id('la')), 'orden_lineas_sin_doble_despacho', 'segundo intento por 100');
insert into flotilla.parada_lineas (id, company_id, parada_id, orden_linea_id, cantidad_asignada)
values (pg_temp.id('pl2'), pg_temp.id('empresa'), pg_temp.id('p2'), pg_temp.id('la'), 20);
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 0, 'segundo intento reserva el saldo de 20');
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set estado = 'liberada', cantidad_cargada = null, cantidad_aceptada = 0, cantidad_rechazada = 0,
     cantidad_retornada = 0 where id = %L$q$, pg_temp.id('pl1')),
  'no cambia de estado', 'liberar una asignación conciliada');

-- 7. Escenario 6: intento fallido conserva el saldo hasta conciliar el retorno --
update flotilla.parada_lineas set estado = 'cargada', cantidad_cargada = 20 where id = pg_temp.id('pl2');
update flotilla.parada_lineas set estado = 'con_resultado', cantidad_no_entregada = 20 where id = pg_temp.id('pl2');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_en_transito'), 20, 'fallido: material en tránsito');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 0, 'fallido: no asignable hasta conciliar');
update flotilla.parada_lineas set estado = 'conciliada', cantidad_retornada = 20 where id = pg_temp.id('pl2');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_asignable'), 20, 'fallido conciliado: 20 asignables');
select pg_temp.igual((select count(*) from flotilla.paradas where orden_id = pg_temp.id('orden_a')), 2, 'los intentos se conservan');

-- 8. Escenario 19: corrección de 80 a 70 aceptadas, con el resto documentado ----
select pg_temp.debe_fallar(format(
  $q$update flotilla.parada_lineas set cantidad_aceptada = 70 where id = %L$q$, pg_temp.id('pl1')),
  'check', 'corregir sin documentar el destino de la diferencia');
update flotilla.parada_lineas set cantidad_aceptada = 70, cantidad_rechazada = 30, cantidad_perdida = 10 where id = pg_temp.id('pl1');
select pg_temp.igual(pg_temp.saldo('la', 'cantidad_aceptada'), 70, 'aceptado tras corregir');
select pg_temp.igual(pg_temp.saldo('la', 'saldo_exigible'), 30, 'exigible tras corregir');

-- 9. Transiciones de estado ------------------------------------------------------
select pg_temp.debe_fallar(format(
  $q$update flotilla.ordenes set estado = 'entregada' where id = %L$q$, pg_temp.id('orden_b')),
  'Transición no permitida', 'orden de borrador a entregada');
update flotilla.ordenes set estado = 'pendiente_validacion' where id = pg_temp.id('orden_b');
select pg_temp.igual((select version from flotilla.ordenes where id = pg_temp.id('orden_b')), 2, 'la versión sube al cambiar');
select pg_temp.debe_fallar(format(
  $q$update flotilla.recorridos set estado = 'en_curso' where id = %L$q$, pg_temp.id('rec1')),
  'Transición no permitida', 'recorrido de borrador a en curso');

-- 10. Un vehículo no sale en dos recorridos a la vez ---------------------------
update flotilla.recorridos set estado = 'planificado' where id in (pg_temp.id('rec1'), pg_temp.id('rec2'));
update flotilla.recorridos set estado = 'en_preparacion' where id in (pg_temp.id('rec1'), pg_temp.id('rec2'));
update flotilla.recorridos set estado = 'listo_salida' where id = pg_temp.id('rec1');
select pg_temp.debe_fallar(format(
  $q$update flotilla.recorridos set estado = 'listo_salida' where id = %L$q$, pg_temp.id('rec2')),
  'recorridos_vehiculo_activo_uq', 'mismo vehículo en dos recorridos listos para salir');

-- 11. Bitácora y libro inmutables ------------------------------------------------
select flotilla.fn_evento(pg_temp.id('empresa'), pg_temp.id('coordinador'), 'prueba', 'orden', pg_temp.id('orden_a'), pg_temp.id('orden_a'));
select flotilla.fn_movimiento(pg_temp.id('empresa'), pg_temp.id('la'), pg_temp.id('pl1'), 'aceptado', 80, pg_temp.id('coordinador'));
select pg_temp.debe_fallar('update flotilla.eventos set accion = ''otra''', 'inmutable', 'editar la bitácora');
select pg_temp.debe_fallar('delete from flotilla.movimientos', 'inmutable', 'borrar el libro');
select pg_temp.debe_fallar(format(
  $q$insert into flotilla.movimientos (company_id, orden_linea_id, tipo, cantidad) values (%L, %L, 'aceptado', -1)$q$,
  pg_temp.id('empresa'), pg_temp.id('la')), 'check', 'movimiento negativo que no es ajuste');

-- 12. Idempotencia --------------------------------------------------------------
select pg_temp.igual((select count(*) from flotilla.fn_operacion_reclamar(pg_temp.id('empresa'), pg_temp.id('op'), 'prueba',
  pg_temp.id('coordinador'), '{"a":1}'::jsonb) r where r is null), 1, 'clave nueva devuelve nulo');
select pg_temp.debe_fallar(format(
  $q$select flotilla.fn_operacion_reclamar(%L, %L, 'prueba', %L, '{"a":1}'::jsonb)$q$,
  pg_temp.id('empresa'), pg_temp.id('op'), pg_temp.id('coordinador')), 'nexo:operacion_en_curso', 'reintento antes del cierre');
select flotilla.fn_operacion_cerrar(pg_temp.id('empresa'), pg_temp.id('op'), '{"ok":true}'::jsonb);
select pg_temp.igual((select count(*) from flotilla.fn_operacion_reclamar(pg_temp.id('empresa'), pg_temp.id('op'), 'prueba',
  pg_temp.id('coordinador'), '{"a":1}'::jsonb) r where r = '{"ok":true}'::jsonb), 1, 'reintento devuelve el mismo resultado');
select pg_temp.debe_fallar(format(
  $q$select flotilla.fn_operacion_reclamar(%L, %L, 'prueba', %L, '{"a":2}'::jsonb)$q$,
  pg_temp.id('empresa'), pg_temp.id('op'), pg_temp.id('coordinador')), 'nexo:operacion_distinta', 'misma clave con otro payload');
select pg_temp.debe_fallar(format(
  $q$select flotilla.fn_operacion_reclamar(%L, %L, 'prueba', %L, '{"a":1}'::jsonb)$q$,
  pg_temp.id('empresa'), pg_temp.id('op'), pg_temp.id('vendedor')), 'nexo:operacion_distinta', 'misma clave de otro actor');
-- La misma clave en otra empresa es otra operación.
select pg_temp.igual((select count(*) from flotilla.fn_operacion_reclamar(pg_temp.id('otra'), pg_temp.id('op'), 'prueba',
  pg_temp.id('coordinador'), '{"a":1}'::jsonb) r where r is null), 1, 'misma clave en otra empresa');

-- 13. Permisos -------------------------------------------------------------------
select pg_temp.como('sin_permiso');
select pg_temp.debe_fallar(format(
  $q$select flotilla.fn_exigir_alguno(%L, array['flotilla.rutas.recorrido.programar'])$q$, pg_temp.id('empresa')),
  'No tienes permiso', 'usuario sin permiso');
select pg_temp.como('coordinador');
select pg_temp.igual((select count(*) from (select flotilla.fn_exigir_alguno(pg_temp.id('empresa'),
  array['flotilla.rutas.recorrido.programar']) = pg_temp.id('coordinador') as ok) x where ok), 1, 'coordinador con permiso');
select pg_temp.debe_fallar(format(
  $q$select flotilla.fn_exigir_alguno(%L, array['flotilla.rutas.recorrido.programar'])$q$, pg_temp.id('otra')),
  'No tienes permiso', 'permiso de otra empresa');

-- 14. Particiones y cierre del schema ------------------------------------------
select pg_temp.igual((select count(*) from core.tablas_particionadas where schema_nombre = 'flotilla'), 3, 'tablas particionadas registradas');
select pg_temp.igual((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'flotilla' and c.relkind in ('r', 'p') and not c.relrowsecurity), 0, 'tablas sin RLS');

rollback;
