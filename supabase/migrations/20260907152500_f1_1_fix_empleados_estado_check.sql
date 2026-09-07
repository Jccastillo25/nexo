-- =============================================================================
-- F1.1 (correccion) -- rrhh.empleados_estado_check no incluia el nuevo
-- default 'sin_contrato' fijado en 20260907152301_f1_1_separar_expediente_general_laboral
-- (detectado por una prueba de insercion/borrado antes de dar F1.1 por
-- terminada, sin llegar a dejar ninguna fila real invalida en produccion).
-- Amplia el CHECK en vez de editar la migracion que lo creo
-- (20260902000006_rrhh_schema_and_tables).
-- =============================================================================

alter table rrhh.empleados drop constraint empleados_estado_check;
alter table rrhh.empleados add constraint empleados_estado_check
  check (estado = any (array['sin_contrato', 'activo', 'inactivo', 'baja']));

comment on column rrhh.empleados.estado is
  'DEPRECADO (F1.1, 2026-09-07): el estado laboral pertenece al contrato (rrhh.contratos.estado, F1.2), no al Expediente General. Default ''sin_contrato'' para altas sin contrato todavia (valor agregado al CHECK en esta migracion) -- ''activo'' sigue siendo el valor que rrhh.fn_registrar_marca_kiosko exige junto con pin_hash (compatibilidad con el kiosko hasta F1.3, que rehace esa validacion contra el contrato/credencial). Se elimina en una migracion de limpieza posterior.';
