-- Flotilla E2: índices que cubren las FK compuestas (advisor unindexed_foreign_keys).
--
-- Después de aplicar 20261024140400_flotilla_e2_esquema, el advisor de
-- rendimiento marcó 34 FK de flotilla sin índice que las cubra: las FK
-- compuestas (x_id, company_id) solo tenían un índice en x_id, y las tablas
-- particionadas tenían sus índices por partición pero no en la tabla padre.
-- El repo tiene 0 FK sin índice desde el 2026-10-21; esto lo mantiene.
--
-- 1. Índice (x_id, company_id) por cada FK compuesta; se retira el índice
--    simple en x_id que queda redundante.
-- 2. Índices en la tabla padre de eventos/movimientos/comunicaciones para
--    company_id y actor_id. Postgres adjunta los índices equivalentes que ya
--    tenían las particiones; las funciones de partición dejan de crearlos para
--    no duplicarlos en particiones nuevas.
-- Sin cambios de datos ni de reglas.

-- 1. FK compuestas ---------------------------------------------------------------
create index conductores_empleado_company_idx on flotilla.conductores (empleado_id, company_id);
drop index flotilla.conductores_empleado_idx;

create index reglas_envio_zona_company_idx on flotilla.reglas_envio (zona_id, company_id);
drop index flotilla.reglas_envio_zona_idx;

create index origen_lineas_origen_company_idx on flotilla.origen_lineas (origen_id, company_id);
create index origen_lineas_producto_company_idx on flotilla.origen_lineas (producto_id, company_id);
drop index flotilla.origen_lineas_producto_idx;

create index ordenes_origen_company_idx on flotilla.ordenes (origen_id, company_id);
create index ordenes_zona_company_idx on flotilla.ordenes (zona_id, company_id);
create index ordenes_bodega_company_idx on flotilla.ordenes (bodega_id, company_id);
create index ordenes_regla_company_idx on flotilla.ordenes (regla_envio_id, company_id);
drop index flotilla.ordenes_origen_idx;
drop index flotilla.ordenes_zona_idx;
drop index flotilla.ordenes_bodega_idx;
drop index flotilla.ordenes_regla_idx;

create index orden_lineas_orden_company_idx on flotilla.orden_lineas (orden_id, company_id);
create index orden_lineas_origen_linea_company_idx on flotilla.orden_lineas (origen_linea_id, company_id);
create index orden_lineas_producto_company_idx on flotilla.orden_lineas (producto_id, company_id);
drop index flotilla.orden_lineas_origen_linea_idx;
drop index flotilla.orden_lineas_producto_idx;

create index validaciones_orden_company_idx on flotilla.validaciones (orden_id, company_id);
create index validaciones_evidencia_company_idx on flotilla.validaciones (evidencia_id, company_id);
drop index flotilla.validaciones_evidencia_idx;

create index recorridos_bodega_company_idx on flotilla.recorridos (bodega_id, company_id);
create index recorridos_vehiculo_company_idx on flotilla.recorridos (vehiculo_id, company_id);
create index recorridos_conductor_company_idx on flotilla.recorridos (conductor_id, company_id);
drop index flotilla.recorridos_bodega_idx;
drop index flotilla.recorridos_vehiculo_idx;
drop index flotilla.recorridos_conductor_idx;

create index paradas_recorrido_company_idx on flotilla.paradas (recorrido_id, company_id);
create index paradas_orden_company_idx on flotilla.paradas (orden_id, company_id);
create index paradas_intento_anterior_company_idx on flotilla.paradas (intento_anterior_id, company_id);
create index paradas_motivo_company_idx on flotilla.paradas (motivo_id, company_id);
drop index flotilla.paradas_orden_idx;
drop index flotilla.paradas_intento_anterior_idx;
drop index flotilla.paradas_motivo_idx;

create index parada_lineas_parada_company_idx on flotilla.parada_lineas (parada_id, company_id);
create index parada_lineas_orden_linea_company_idx on flotilla.parada_lineas (orden_linea_id, company_id);
drop index flotilla.parada_lineas_orden_linea_idx;

create index incidencias_orden_company_idx on flotilla.incidencias (orden_id, company_id);
create index incidencias_parada_company_idx on flotilla.incidencias (parada_id, company_id);
create index incidencias_motivo_company_idx on flotilla.incidencias (motivo_id, company_id);
drop index flotilla.incidencias_orden_idx;
drop index flotilla.incidencias_parada_idx;
drop index flotilla.incidencias_motivo_idx;

create index evidencias_orden_company_idx on flotilla.evidencias (orden_id, company_id);
create index evidencias_parada_company_idx on flotilla.evidencias (parada_id, company_id);
create index evidencias_incidencia_company_idx on flotilla.evidencias (incidencia_id, company_id);
drop index flotilla.evidencias_orden_idx;
drop index flotilla.evidencias_parada_idx;
drop index flotilla.evidencias_incidencia_idx;

-- 2. Tablas particionadas: índices en la tabla padre ----------------------------
create index eventos_company_registrado_idx on flotilla.eventos (company_id, registrado_en);
create index eventos_actor_idx on flotilla.eventos (actor_id);
create index movimientos_company_registrado_idx on flotilla.movimientos (company_id, registrado_en);
create index movimientos_actor_idx on flotilla.movimientos (actor_id);
create index comunicaciones_company_registrado_idx on flotilla.comunicaciones (company_id, registrado_en);
create index comunicaciones_actor_idx on flotilla.comunicaciones (actor_id);

create or replace function flotilla.fn_asegurar_particion_eventos(p_mes date)
returns void language plpgsql set search_path = flotilla, pg_temp as $$
declare
  particion text := 'eventos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('flotilla.' || particion) is null then
    -- (company_id, registrado_en) y actor_id vienen de la tabla padre.
    execute format('create table flotilla.%I partition of flotilla.eventos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (orden_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (objeto_tipo, objeto_id)', particion);
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
    -- (company_id, registrado_en) y actor_id vienen de la tabla padre.
    execute format('create table flotilla.%I partition of flotilla.movimientos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (orden_linea_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (parada_linea_id)', particion);
    execute format('create index on flotilla.%I (motivo_id)', particion);
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
    -- (company_id, registrado_en) y actor_id vienen de la tabla padre.
    execute format('create table flotilla.%I partition of flotilla.comunicaciones for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on flotilla.%I (orden_id, registrado_en)', particion);
    execute format('create index on flotilla.%I (parada_id)', particion);
    execute format('alter table flotilla.%I enable row level security', particion);
  end if;
end;
$$;
revoke all on all functions in schema flotilla from public, anon, authenticated;

-- 3. Poscheque: ninguna FK de flotilla sin un índice que empiece por sus columnas.
do $$
declare
  v_sin_indice int;
begin
  select count(*) into v_sin_indice
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'f' and n.nspname = 'flotilla' and not t.relispartition
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey
    );
  if v_sin_indice > 0 then
    raise exception 'poscheque: % FK de flotilla sin índice que las cubra', v_sin_indice;
  end if;
end;
$$;
