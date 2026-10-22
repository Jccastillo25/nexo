-- ENTORNO DESECHABLE para las pruebas de Planilla (PL2a). Solo motor efímero
-- (PGlite en memoria): NO es el esquema real de nexo-core y NO se aplica a
-- ninguna base compartida.
--
-- Replica lo que la migración 20261021191441_rrhh_planilla_pl2a_motor.sql
-- toca o lee, con los mismos nombres de columnas, constraints y policies que
-- verificó el coordinador en remoto el 2026-10-21: core.companies, permisos
-- simulados, auditoría, particiones, empleados, contratos, compensación,
-- jornadas, feriados, parametros_ley (las 4 semillas de 2026-09-02),
-- planillas y planilla_detalles (con sus grants y policies de escritura, para
-- probar que la migración los retira), cuentas bancarias y marcas.
--
-- Límites: no reproduce las membresías y roles reales (has_permission lee
-- core.prueba_permisos), ni RLS efectiva (las pruebas corren como superusuario),
-- ni pg_cron, ni el resto de triggers de RRHH.

create schema if not exists core;
create schema if not exists rrhh;
create schema if not exists auth;
create schema if not exists extensions;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end
$roles$;

create extension if not exists pgcrypto with schema extensions;

create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table core.companies (id uuid primary key, nombre text not null, slug text unique);
create table core.permissions_catalog (code text primary key, module_slug text, domain text, label text, description text);
insert into core.permissions_catalog (code, module_slug, domain)
select 'rrhh.planillas.' || c, 'rrhh', 'planillas' from unnest(array[
  'planilla.ver', 'planilla.generar', 'planilla.aprobar', 'planilla.anular', 'planilla.pagar',
  'movimientos.ver', 'movimientos.crear', 'movimientos.eliminar', 'parametros.ver', 'parametros.editar',
  'reportes.exportar', 'regimen.ver', 'regimen.cambiar', 'conceptos.ver', 'conceptos.gestionar',
  'vacaciones.ver', 'vacaciones.registrar', 'vacaciones.aprobar', 'prestamos.ver', 'prestamos.gestionar',
  'liquidaciones.ver', 'liquidaciones.calcular', 'liquidaciones.aprobar', 'declaraciones.generar',
  'colillas.enviar']) c;

create table core.prueba_permisos (usuario uuid, empresa uuid, codigo text, primary key (usuario, empresa, codigo));
create function core.has_permission(u uuid, e uuid, c text) returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select exists (select 1 from core.prueba_permisos p where p.usuario = u and p.empresa = e and p.codigo = c)
$$;
-- Copia literal de 20261014203144_nexo_usuarios_roles_esquema.sql:221-237.
create function core.fn_exigir_permiso(p_company_id uuid, p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not core.has_permission(v_uid, p_company_id, p_code) then
    raise exception using
      errcode = '42501',
      message = format('No tenés permiso para esta acción (%s).', p_code);
  end if;
  return v_uid;
end;
$$;

create table core.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid, company_id uuid, action text not null, entity text, entity_id text, metadata jsonb,
  created_at timestamptz not null default now()
);
create function core.fn_auditar(p_user_id uuid, p_company_id uuid, p_action text, p_entity text, p_entity_id text, p_metadata jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into core.audit_log (user_id, company_id, action, entity, entity_id, metadata)
  values (p_user_id, p_company_id, p_action, p_entity, p_entity_id, p_metadata);
end;
$$;

-- Copia de 20260902000004_fix_partition_functions_search_path.sql:34-49.
create table core.tablas_particionadas (
  schema_nombre text not null, tabla_nombre text not null, fn_asegurar_particion text not null,
  primary key (schema_nombre, tabla_nombre)
);
create function core.fn_asegurar_particiones_futuras(p_meses_adelante int default 3)
returns void language plpgsql set search_path = core, pg_temp as $$
declare
  r record;
  i int;
begin
  for r in select * from core.tablas_particionadas loop
    for i in 0..p_meses_adelante loop
      execute format('select %s(%L)', r.fn_asegurar_particion, (date_trunc('month', now()) + (i || ' months')::interval)::date);
    end loop;
  end loop;
end;
$$;

create table rrhh.empleados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null,
  apellido text not null,
  unique (id, company_id)
);

create table rrhh.contratos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  numero_contrato bigint generated always as identity,
  estado text not null default 'borrador' check (estado in ('borrador', 'activo', 'finalizado')),
  fecha_inicio date,
  fecha_fin_prevista date,
  fecha_fin_real date,
  puesto_id uuid,
  departamento_id uuid,
  plantilla_contrato_id uuid,
  modalidad_contrato text,
  created_by uuid,
  updated_at timestamptz not null default now(),
  constraint contratos_id_company_empleado_key unique (id, company_id, empleado_id),
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id)
);
create unique index contratos_empleado_activo_unq on rrhh.contratos (empleado_id) where estado = 'activo';

create table rrhh.contrato_compensacion (
  contrato_id uuid primary key references rrhh.contratos(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  salario_base numeric not null,
  frecuencia_pago text not null default 'mensual' check (frecuencia_pago in ('mensual', 'quincenal', 'semanal')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table rrhh.jornadas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null
);
create table rrhh.jornada_dias (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references rrhh.jornadas(id),
  company_id uuid not null references core.companies(id),
  dia_semana smallint not null,
  laborable boolean not null,
  hora_entrada time,
  hora_salida time,
  minutos_descanso integer not null default 0
);
create table rrhh.contrato_jornadas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null references rrhh.contratos(id) on delete cascade,
  jornada_id uuid not null references rrhh.jornadas(id),
  vigente_desde date not null,
  vigente_hasta date
);

create table rrhh.feriados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  fecha date not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_id, fecha)
);

-- Igual a 20260902000008:33-65 (sin el default de empresa).
create table rrhh.parametros_ley (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  codigo text not null,
  unidad text not null check (unidad in ('porcentaje', 'monto')),
  valor numeric(12,4) not null,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
create unique index parametros_ley_activo_unico on rrhh.parametros_ley (company_id, codigo) where vigente_hasta is null;
alter table rrhh.parametros_ley enable row level security;
create policy "parametros_ley: ver con permiso" on rrhh.parametros_ley for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.ver'));
create policy "parametros_ley: crear con permiso" on rrhh.parametros_ley for insert to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.editar'));
create policy "parametros_ley: editar con permiso" on rrhh.parametros_ley for update to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.editar'));

-- Igual a 20260902000006:166-212 (columnas, estados y policies vigentes en remoto).
create table rrhh.planillas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  periodo_inicio date not null,
  periodo_fin date not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobada', 'anulada')),
  total numeric(14,2) not null default 0,
  generada_por uuid references auth.users(id),
  generada_en timestamptz not null default now(),
  aprobada_por uuid references auth.users(id),
  aprobada_en timestamptz,
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  asiento_contable_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_fin >= periodo_inicio)
);
create table rrhh.planilla_detalles (
  id uuid primary key default gen_random_uuid(),
  planilla_id uuid not null references rrhh.planillas(id) on delete cascade,
  empleado_id uuid not null references rrhh.empleados(id),
  company_id uuid not null references core.companies(id),
  salario_base numeric(14,2) not null default 0,
  horas_extra numeric(14,2) not null default 0,
  bonos numeric(14,2) not null default 0,
  deducciones numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table rrhh.planillas enable row level security;
alter table rrhh.planilla_detalles enable row level security;
create policy "planillas: ver con permiso" on rrhh.planillas for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.ver'));
create policy "planillas: crear con permiso" on rrhh.planillas for insert to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.generar'));
create policy "planillas: editar borrador con permiso" on rrhh.planillas for update to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.generar'));
create policy "detalles: ver con permiso" on rrhh.planilla_detalles for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.ver'));
create policy "detalles: crear con permiso" on rrhh.planilla_detalles for insert to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.crear'));
create policy "detalles: editar con permiso" on rrhh.planilla_detalles for update to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.crear'));
create policy "detalles: eliminar con permiso" on rrhh.planilla_detalles for delete to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.eliminar'));

create table rrhh.empleado_cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references rrhh.empleados(id),
  company_id uuid not null references core.companies(id),
  activo boolean not null default true
);

-- En remoto está particionada por mes; aquí es plana (el motor solo la consulta).
create table rrhh.asistencia_marcas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id),
  contrato_id uuid references rrhh.contratos(id),
  marcado_en timestamptz not null default now()
);

-- Catálogos mínimos de contratación (lo que leen fn_crear_contrato y fn_editar_contrato).
create table rrhh.departamentos (id uuid primary key default gen_random_uuid(), company_id uuid not null, activo boolean not null default true);
create table rrhh.puestos (id uuid primary key default gen_random_uuid(), company_id uuid not null, departamento_id uuid not null,
  activo boolean not null default true);
create table rrhh.plantillas_contrato (id uuid primary key default gen_random_uuid(), company_id uuid not null, activo boolean not null default true);
create table rrhh.puesto_plantillas (puesto_id uuid not null, plantilla_id uuid not null, company_id uuid not null,
  activo boolean not null default true);

-- Firmas vigentes de las RPC de contrato (20260918043955); la migración las
-- reemplaza con el parámetro de frecuencia. Aquí basta la firma.
create function rrhh.fn_crear_contrato(p_company_id uuid, p_empleado_id uuid, p_puesto_id uuid, p_departamento_id uuid,
  p_plantilla_contrato_id uuid, p_modalidad_contrato text default null, p_fecha_inicio date default null,
  p_salario_base numeric default null)
returns table(contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language sql as $$ select null::uuid, null::bigint, null::uuid where false $$;
create function public.crear_contrato(p_company_id uuid, p_empleado_id uuid, p_puesto_id uuid, p_departamento_id uuid,
  p_plantilla_contrato_id uuid, p_modalidad_contrato text default null, p_fecha_inicio date default null,
  p_salario_base numeric default null)
returns table(contrato_id uuid, numero_contrato bigint, plantilla_contrato_id uuid)
language sql as $$ select * from rrhh.fn_crear_contrato(p_company_id, p_empleado_id, p_puesto_id, p_departamento_id,
  p_plantilla_contrato_id, p_modalidad_contrato, p_fecha_inicio, p_salario_base) $$;
create function rrhh.fn_editar_contrato(p_contrato_id uuid, p_company_id uuid, p_puesto_id uuid default null,
  p_departamento_id uuid default null, p_plantilla_contrato_id uuid default null, p_modalidad_contrato text default null,
  p_fecha_inicio date default null, p_fecha_fin_prevista date default null, p_salario_base numeric default null)
returns void language sql as $$ select $$;
create function public.editar_contrato(p_contrato_id uuid, p_company_id uuid, p_puesto_id uuid default null,
  p_departamento_id uuid default null, p_plantilla_contrato_id uuid default null, p_modalidad_contrato text default null,
  p_fecha_inicio date default null, p_fecha_fin_prevista date default null, p_salario_base numeric default null)
returns void language sql as $$ select $$;

grant usage on schema rrhh, core, auth to authenticated, anon;
grant select, insert, update, delete on rrhh.planillas, rrhh.planilla_detalles, rrhh.parametros_ley,
  rrhh.feriados to authenticated;
-- Como en remoto (20260904000001): contratos con insert/select/update; la compensación solo select.
grant select, insert, update on rrhh.contratos to authenticated;
grant select on rrhh.contrato_compensacion to authenticated;

-- Empresas y semillas de parámetros como en remoto (2026-09-02). Sin datos personales.
insert into core.companies (id, nombre, slug) values
  ('00000000-0000-4000-8000-00000000000a', 'PRUEBA Empresa A', 'prueba-a'),
  ('00000000-0000-4000-8000-00000000000b', 'PRUEBA Empresa B', 'prueba-b');
insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde)
select c.id, x.codigo, x.unidad, x.valor, date '2026-09-02'
from core.companies c
cross join (values ('inss_laboral', 'porcentaje', 0.07), ('inss_patronal', 'porcentaje', 0.225),
                   ('inatec', 'porcentaje', 0.02), ('techo_inss', 'monto', 100000.00)) as x(codigo, unidad, valor);

-- Un contrato activo en frecuencia mensual antes de la migración (empresa B),
-- como los 4 de remoto: la migración lo pasa a quincenal y le da régimen.
insert into rrhh.empleados (id, company_id, nombre, apellido)
values ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000000b', 'PRUEBA', 'B0');
insert into rrhh.contratos (id, company_id, empleado_id, estado, fecha_inicio)
values ('00000000-0000-4000-8000-0000000000c0', '00000000-0000-4000-8000-00000000000b',
        '00000000-0000-4000-8000-0000000000e0', 'activo', date '2025-03-15');
insert into rrhh.contrato_compensacion (contrato_id, company_id, salario_base)
values ('00000000-0000-4000-8000-0000000000c0', '00000000-0000-4000-8000-00000000000b', 11350);
