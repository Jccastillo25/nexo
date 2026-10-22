-- ENTORNO DESECHABLE para la prueba de PL2c (solo PGlite en memoria). Se carga
-- después de rrhh_planilla_entorno.sql y de la migración PL2a, y antes de la
-- migración 20261022000003_rrhh_planilla_pl2c_reportes.sql. NO es el esquema
-- real de nexo-core y NO se aplica a ninguna base compartida.
--
-- Agrega lo que PL2c lee y el entorno de PL2a no tiene, con los nombres de
-- remoto: los permisos rrhh.asistencia.reportes.ver (20261018014012) y
-- rrhh.expedientes.compensacion.ver (20260902000005), core.companies.name y
-- tax_id, rrhh.empleados.documento_identidad (20260902000006), rrhh.puestos.nombre
-- (20260916150000) y una versión mínima de rrhh.fn_asistencia_dias
-- (20261018014127) con la misma firma, las mismas columnas de salida y la misma
-- exigencia de permiso, que en vez de calcular desde las marcas devuelve los
-- días que la prueba carga en rrhh.prueba_asistencia_dias.
--
-- Límite: no prueba el cálculo real de fn_asistencia_dias (jornadas,
-- tolerancias, descansos, feriados); eso lo cubren las pruebas de Asistencia.

-- Todo es idempotente para poder correr junto con el entorno de PL2b.
insert into core.permissions_catalog (code, module_slug, domain) values
  ('rrhh.asistencia.reportes.ver', 'rrhh', 'asistencia'),
  ('rrhh.expedientes.compensacion.ver', 'rrhh', 'expedientes')
on conflict do nothing;

-- core.companies en nexo-core tiene name y tax_id (el entorno compartido usa nombre).
alter table core.companies add column if not exists name text, add column if not exists tax_id text;
update core.companies set name = coalesce(name, nombre), tax_id = coalesce(tax_id, 'PRUEBA-RUC-' || slug);

alter table rrhh.empleados add column if not exists documento_identidad text;
alter table rrhh.puestos add column if not exists nombre text;

create table if not exists rrhh.prueba_asistencia_dias (
  contrato_id uuid not null references rrhh.contratos(id),
  fecha date not null,
  estado text not null,
  minutos_sobre_jornada integer,
  primary key (contrato_id, fecha)
);

create or replace function rrhh.fn_asistencia_dias(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null)
returns table(
  fecha date, es_hoy boolean,
  contrato_id uuid, contrato_numero bigint, empleado_id uuid, empleado_codigo bigint, empleado_nombre text,
  departamento_id uuid, departamento text, puesto_id uuid, puesto text,
  jornada_id uuid, jornada_nombre text, laborable boolean, es_feriado boolean, feriado_nombre text,
  hora_entrada_prog time, hora_salida_prog time, descanso_prog_min integer,
  tol_entrada_min integer, tol_salida_min integer,
  entrada timestamptz, inicio_descanso timestamptz, fin_descanso timestamptz, salida timestamptz,
  marcas_count integer, secuencia text[],
  descanso_real_min integer, descanso_aplicado_min integer, descanso_origen text,
  minutos_netos integer, minutos_programados integer, minutos_sobre_jornada integer,
  minutos_no_laborable integer, minutos_tardanza integer, minutos_salida_temprana integer,
  estado text, observaciones text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.ver') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  select d.fecha, false, c.id, c.numero_contrato, c.empleado_id, null::bigint, e.apellido || ', ' || e.nombre,
         null::uuid, null::text, null::uuid, null::text,
         null::uuid, null::text, d.estado not in ('dia_descanso', 'sin_jornada', 'feriado'), d.estado = 'feriado', null::text,
         null::time, null::time, null::integer, null::integer, null::integer,
         null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, 0, '{}'::text[],
         null::integer, null::integer, null::text, null::integer, null::integer, d.minutos_sobre_jornada,
         null::integer, null::integer, null::integer, d.estado, '{}'::text[]
  from rrhh.prueba_asistencia_dias d
  join rrhh.contratos c on c.id = d.contrato_id and c.company_id = p_company_id and c.estado in ('activo', 'finalizado')
  join rrhh.empleados e on e.id = c.empleado_id
  where d.fecha between p_desde and p_hasta
    and (p_contrato_id is null or c.id = p_contrato_id)
    and (p_empleado_id is null or c.empleado_id = p_empleado_id);
end $$;

revoke execute on function rrhh.fn_asistencia_dias(uuid, date, date, uuid, uuid, uuid, uuid) from public, anon, authenticated;
