-- =============================================================================
-- F1.1 -- Separar Expediente General de Expediente Laboral
-- (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md secciones 5.1/5.2/10 F1.1;
-- aprobado explicitamente por el usuario, 2026-09-07).
--
-- Regla objetivo: "Crear empleado != contratar empleado". rrhh.empleados
-- pasa a ser exclusivamente el Expediente General (identidad/datos
-- personales) -- puesto, departamento, fechas laborales, estado laboral,
-- compensacion y PIN dejan de asignarse en el alta. El modelo contractual
-- (rrhh.contratos, credenciales de asistencia) se construye en F1.2/F1.3.
--
-- No se edita ninguna migracion aplicada (20260902000006/20260902000008):
-- esta es una migracion NUEVA que altera columnas existentes (0 filas
-- reales verificado en F1.0, sin backfill necesario) y reemplaza
-- rrhh.fn_crear_empleado/public.crear_empleado por una version con firma
-- reducida.
--
-- Columnas laborales/credenciales de rrhh.empleados quedan nullable y
-- marcadas DEPRECADAS -- siguen existiendo (no se eliminan columnas
-- todavia) hasta que F1.2 tenga rrhh.contratos poblable y una
-- migracion de limpieza aparte decida su destino final.
--
-- Nota: la correccion del CHECK de `estado` (necesaria para el nuevo
-- default 'sin_contrato') quedo en una migracion separada,
-- 20260907152500_f1_1_fix_empleados_estado_check, detectada por una
-- prueba de insercion antes de dar F1.1 por terminada.
-- =============================================================================

alter table rrhh.empleados alter column fecha_ingreso drop not null;
alter table rrhh.empleados alter column nombre_usuario drop not null;
alter table rrhh.empleados alter column estado set default 'sin_contrato';

comment on column rrhh.empleados.puesto is
  'DEPRECADO (F1.1, 2026-09-07): pertenece al contrato (rrhh.contratos, F1.2), no al Expediente General. rrhh.fn_crear_empleado ya no lo acepta. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.departamento is
  'DEPRECADO (F1.1, 2026-09-07): pertenece al contrato (rrhh.contratos, F1.2), no al Expediente General. rrhh.fn_crear_empleado ya no lo acepta. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.fecha_ingreso is
  'DEPRECADO (F1.1, 2026-09-07): pertenece al contrato (rrhh.contratos.fecha_inicio, F1.2), no al Expediente General. Nullable desde esta migracion; rrhh.fn_crear_empleado ya no lo fija. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.fecha_baja is
  'DEPRECADO (F1.1, 2026-09-07): pertenece al contrato (rrhh.contratos.fecha_fin_real, F1.2), no al Expediente General. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.estado is
  'DEPRECADO (F1.1, 2026-09-07): el estado laboral pertenece al contrato (rrhh.contratos.estado, F1.2), no al Expediente General. Nuevo default ''sin_contrato'' para altas sin contrato todavia -- ''activo'' sigue siendo el valor que rrhh.fn_registrar_marca_kiosko exige junto con pin_hash (compatibilidad con el kiosko hasta F1.3, que rehace esa validacion contra el contrato/credencial). Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.pin_hash is
  'DEPRECADO (F1.1, 2026-09-07): el PIN pasa a ser una credencial contractual (rrhh.contrato_credenciales, F1.3), no un dato del Expediente General. rrhh.fn_crear_empleado ya no lo genera. rrhh.fn_registrar_marca_kiosko sigue leyendolo hasta que F1.3 lo reemplace por la validacion contractual. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.nombre_usuario is
  'DEPRECADO (F1.1, 2026-09-07): concepto del diseno de "PIN de doble proposito" (rrhh.fn_validar_acceso_operativo), rechazado como arquitectura final -- ver docs/DRIVER_ACCESS_AND_KIOSK.md seccion 10. Nullable desde esta migracion; rrhh.fn_crear_empleado ya no lo genera. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.pin_bloqueado is
  'DEPRECADO (F1.1, 2026-09-07): bloqueo asociado al PIN de doble proposito/kiosko sobre el Expediente General. Pasa a ser un atributo de la credencial contractual en F1.3. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.intentos_fallidos is
  'DEPRECADO (F1.1, 2026-09-07): contador asociado al PIN de doble proposito/kiosko sobre el Expediente General. Pasa a ser un atributo de la credencial contractual en F1.3. Se elimina en una migracion de limpieza posterior.';
comment on column rrhh.empleados.user_id is
  'DEPRECADO (F1.1, 2026-09-07): la identidad digital (auth.users) es una capacidad transversal de core.identidad (diseno objetivo, ver IMPLEMENTATION_STATUS.md 0.10), no un campo del Expediente General de RRHH. Se elimina en una migracion de limpieza posterior cuando exista el diseno real de core.identidad.';

-- rrhh.fn_crear_empleado / public.crear_empleado: firma reducida,
-- solo Expediente General. Se elimina la firma anterior (13 parametros)
-- porque Postgres identifica funciones por firma -- dejarla viva junto
-- a la nueva reintroduciria el camino de alta con PIN/laboral que esta
-- migracion existe para cerrar.
drop function if exists public.crear_empleado(uuid, text, text, text, text, text, text, text, text, text, date, text, numeric);
drop function if exists rrhh.fn_crear_empleado(uuid, text, text, text, text, text, text, text, text, text, date, text, numeric);

create function rrhh.fn_crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns table (empleado_id uuid, codigo_empleado bigint)
language plpgsql
security definer
set search_path = rrhh, core, extensions, pg_temp
as $$
declare
  v_empleado_id uuid;
  v_codigo_empleado bigint;
begin
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.expedientes.empleados.crear') then
    raise exception 'Permiso denegado: rrhh.expedientes.empleados.crear';
  end if;

  insert into rrhh.empleados (company_id, nombre, apellido, documento_identidad, email, telefono)
  values (p_company_id, p_nombre, p_apellido, p_documento_identidad, p_email, p_telefono)
  returning id, codigo_empleado into v_empleado_id, v_codigo_empleado;

  return query select v_empleado_id, v_codigo_empleado;
end;
$$;

comment on function rrhh.fn_crear_empleado(uuid, text, text, text, text, text) is
  'F1.1 (2026-09-07): alta de Expediente General exclusivamente -- nombre, apellido, documento, email, telefono. Sin puesto/departamento/modalidad/salario/PIN/nombre_usuario (eso es contrato, F1.2/F1.3). Gateada por rrhh.expedientes.empleados.crear. Reemplaza a la version de 13 parametros de 20260902000008 (no editada, si no reemplazada por esta funcion con firma distinta).';

create function public.crear_empleado(
  p_company_id uuid,
  p_nombre text,
  p_apellido text,
  p_documento_identidad text default null,
  p_email text default null,
  p_telefono text default null
)
returns table (empleado_id uuid, codigo_empleado bigint)
language sql
security definer
set search_path = rrhh, public
as $$
  select * from rrhh.fn_crear_empleado(p_company_id, p_nombre, p_apellido, p_documento_identidad, p_email, p_telefono);
$$;

comment on function public.crear_empleado(uuid, text, text, text, text, text) is
  'Wrapper publico de rrhh.fn_crear_empleado (F1.1, 2026-09-07). Solo Expediente General.';

revoke execute on function rrhh.fn_crear_empleado(uuid, text, text, text, text, text) from PUBLIC, anon, authenticated;
revoke execute on function public.crear_empleado(uuid, text, text, text, text, text) from PUBLIC, anon;
grant execute on function public.crear_empleado(uuid, text, text, text, text, text) to authenticated;
