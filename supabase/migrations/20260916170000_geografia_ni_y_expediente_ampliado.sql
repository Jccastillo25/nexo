-- =============================================================================
-- Fase 5 del bloque "pre-F1.5" (docs/status-log/2026-09-16-rrhh-pre-f1-5.md):
-- expediente ampliado (Direccion, Informacion complementaria, Cuentas
-- bancarias, Beneficiario) + catalogo geografico de Nicaragua. Paso Cero
-- ya aplicado en 20260916160000_rrhh_expediente_ampliado_permisos.sql.
--
-- DEUDA EXPLICITA (documentada tambien en docs/status-log/2026-09-16-rrhh-
-- pre-f1-5.md e IMPLEMENTATION_STATUS.md) -- LEER ANTES DE ASUMIR QUE ESTE
-- CATALOGO ESTA COMPLETO:
-- Se intento poblar core.geografia_ni_municipios con los 153 municipios
-- oficiales de Nicaragua a partir de fuentes web (es.wikipedia.org, dos
-- intentos independientes). Ambos intentos devolvieron listas incompletas
-- e inconsistentes entre si (ej. "Quezalguaque" asignado a dos
-- departamentos distintos, "Siuna"/"Somotillo"/"Villanueva"/"San Marcos"
-- ausentes) -- no hay una fuente verificada disponible en esta sesion. En
-- vez de fabricar/adivinar los 153 nombres de memoria (alto riesgo de
-- introducir direcciones geograficamente incorrectas en produccion), esta
-- migracion crea la TABLA con su esquema y FK correctos pero la deja
-- VACIA. Los 17 departamentos/regiones si se siembran -- lista corta,
-- estable y de alta confianza (verificada contra Wikipedia dos veces sin
-- discrepancias). El campo `municipio_geo_id` en `rrhh.empleado_direccion`
-- es nullable a proposito: el formulario de Direccion (Fase 5, UI) debe
-- permitir elegir departamento y dejar municipio sin seleccionar mientras
-- este catalogo siga vacio. Completar `core.geografia_ni_municipios` con
-- una fuente oficial verificada (INIDE/INIFOM) es tarea pendiente,
-- explicitamente fuera de esta migracion.
--
-- Vive en `core` (no en `rrhh`) porque es dato de referencia NACIONAL,
-- reutilizable por otros modulos futuros (Flotilla, CRM) -- sin
-- company_id, catalogo publico de solo lectura para cualquier usuario
-- autenticado (no hay dato sensible en un nombre de departamento).
-- =============================================================================

create table core.geografia_ni_departamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null unique
);

comment on table core.geografia_ni_departamentos is
  'Fase 5 (2026-09-16): los 15 departamentos + 2 regiones autonomas de Nicaragua. Catalogo nacional de referencia, sin company_id -- reutilizable por cualquier modulo futuro que necesite geografia (Flotilla, CRM). codigo es un identificador estable interno (orden alfabetico, regiones autonomas al final), no una codificacion oficial externa.';

insert into core.geografia_ni_departamentos (codigo, nombre) values
  ('01', 'Boaco'),
  ('02', 'Carazo'),
  ('03', 'Chinandega'),
  ('04', 'Chontales'),
  ('05', 'Estelí'),
  ('06', 'Granada'),
  ('07', 'Jinotega'),
  ('08', 'León'),
  ('09', 'Madriz'),
  ('10', 'Managua'),
  ('11', 'Masaya'),
  ('12', 'Matagalpa'),
  ('13', 'Nueva Segovia'),
  ('14', 'Río San Juan'),
  ('15', 'Rivas'),
  ('16', 'Región Autónoma de la Costa Caribe Norte'),
  ('17', 'Región Autónoma de la Costa Caribe Sur');

alter table core.geografia_ni_departamentos enable row level security;

create policy "geografia_ni_departamentos: lectura autenticada" on core.geografia_ni_departamentos for select
  to authenticated
  using (true);

grant select on core.geografia_ni_departamentos to authenticated;

create table core.geografia_ni_municipios (
  id uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references core.geografia_ni_departamentos(id),
  codigo text not null unique,
  nombre text not null,
  unique (departamento_id, nombre)
);

comment on table core.geografia_ni_municipios is
  'Fase 5 (2026-09-16): municipios de Nicaragua -- INTENCIONALMENTE VACIA (ver cabecera de esta migracion). Esquema listo (FK a geografia_ni_departamentos, codigo/nombre unicos) para un seed posterior con fuente oficial verificada. rrhh.empleado_direccion.municipio_geo_id es nullable para que el formulario de Direccion funcione sin datos aca.';

create index geografia_ni_municipios_departamento_id_idx on core.geografia_ni_municipios (departamento_id);

alter table core.geografia_ni_municipios enable row level security;

create policy "geografia_ni_municipios: lectura autenticada" on core.geografia_ni_municipios for select
  to authenticated
  using (true);

grant select on core.geografia_ni_municipios to authenticated;

-- -----------------------------------------------------------------------------
-- rrhh.empleado_direccion -- 1:1 con empleado. No tan sensible como
-- compensacion -- visible tambien para 'consulta' (rrhh.expedientes.
-- direccion.ver/editar, Paso Cero de esta Fase).
-- -----------------------------------------------------------------------------
create table rrhh.empleado_direccion (
  empleado_id uuid primary key references rrhh.empleados(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  departamento_geo_id uuid references core.geografia_ni_departamentos(id),
  municipio_geo_id uuid references core.geografia_ni_municipios(id),
  direccion_detalle text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.empleado_direccion is
  'Fase 5 (2026-09-16): direccion del empleado. departamento_geo_id/municipio_geo_id son geografia NACIONAL de Nicaragua (core.geografia_ni_*) -- no confundir con rrhh.departamentos (departamento ORGANIZACIONAL, Fase 3). direccion_detalle es la referencia libre tipica nicaraguense ("de la rotonda X, 2c al lago").';

create index empleado_direccion_company_id_idx on rrhh.empleado_direccion (company_id);

alter table rrhh.empleado_direccion enable row level security;

create policy "empleado_direccion: ver con permiso" on rrhh.empleado_direccion for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.direccion.ver'));

create policy "empleado_direccion: crear con permiso" on rrhh.empleado_direccion for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.direccion.editar'));

create policy "empleado_direccion: editar con permiso" on rrhh.empleado_direccion for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.direccion.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.direccion.editar'));

grant select, insert, update on rrhh.empleado_direccion to authenticated;

create trigger trg_empleado_direccion_updated_at
  before update on rrhh.empleado_direccion
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- rrhh.empleado_info_complementaria -- 1:1, campos minimos (ampliable a
-- futuro con una decision de negocio aparte, no se agregan mas ahora).
-- -----------------------------------------------------------------------------
create table rrhh.empleado_info_complementaria (
  empleado_id uuid primary key references rrhh.empleados(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  estado_civil text check (estado_civil in ('soltero_a', 'casado_a', 'union_de_hecho', 'divorciado_a', 'viudo_a')),
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  contacto_emergencia_parentesco text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.empleado_info_complementaria is
  'Fase 5 (2026-09-16): campos complementarios minimos del expediente. Set deliberadamente acotado (estado civil + contacto de emergencia) -- ampliarlo requiere una regla de negocio nueva aprobada, no se sobre-construye aca.';

create index empleado_info_complementaria_company_id_idx on rrhh.empleado_info_complementaria (company_id);

alter table rrhh.empleado_info_complementaria enable row level security;

create policy "empleado_info_complementaria: ver con permiso" on rrhh.empleado_info_complementaria for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.info_complementaria.ver'));

create policy "empleado_info_complementaria: crear con permiso" on rrhh.empleado_info_complementaria for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.info_complementaria.editar'));

create policy "empleado_info_complementaria: editar con permiso" on rrhh.empleado_info_complementaria for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.info_complementaria.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.info_complementaria.editar'));

grant select, insert, update on rrhh.empleado_info_complementaria to authenticated;

create trigger trg_empleado_info_complementaria_updated_at
  before update on rrhh.empleado_info_complementaria
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- rrhh.empleado_cuentas_bancarias -- dato sensible, solo 'admin' (mismo
-- criterio que rrhh.expedientes.compensacion.*). Sin DELETE expuesto -- se
-- desactiva. A lo sumo una cuenta "principal" activa por empleado.
-- -----------------------------------------------------------------------------
create table rrhh.empleado_cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  banco text not null,
  tipo_cuenta text not null check (tipo_cuenta in ('ahorro', 'corriente')),
  moneda text not null default 'NIO' check (moneda in ('NIO', 'USD')),
  numero_cuenta text not null,
  principal boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.empleado_cuentas_bancarias is
  'Fase 5 (2026-09-16): cuentas bancarias del empleado -- dato sensible, gateado por rrhh.expedientes.cuentas_bancarias.* (solo admin). A lo sumo una cuenta principal activa por empleado (empleado_cuentas_bancarias_principal_unq). Sin DELETE fisico -- se desactiva (activo=false).';

create index empleado_cuentas_bancarias_empleado_id_idx on rrhh.empleado_cuentas_bancarias (empleado_id);
create index empleado_cuentas_bancarias_company_id_idx on rrhh.empleado_cuentas_bancarias (company_id);

create unique index empleado_cuentas_bancarias_principal_unq
  on rrhh.empleado_cuentas_bancarias (empleado_id)
  where principal and activo;

alter table rrhh.empleado_cuentas_bancarias enable row level security;

create policy "empleado_cuentas_bancarias: ver con permiso" on rrhh.empleado_cuentas_bancarias for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.cuentas_bancarias.ver'));

create policy "empleado_cuentas_bancarias: crear con permiso" on rrhh.empleado_cuentas_bancarias for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.cuentas_bancarias.editar'));

create policy "empleado_cuentas_bancarias: editar con permiso" on rrhh.empleado_cuentas_bancarias for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.cuentas_bancarias.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.cuentas_bancarias.editar'));

grant select, insert, update on rrhh.empleado_cuentas_bancarias to authenticated;

create trigger trg_empleado_cuentas_bancarias_updated_at
  before update on rrhh.empleado_cuentas_bancarias
  for each row execute function rrhh.fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- rrhh.empleado_beneficiarios -- dato sensible, solo 'admin'. La suma de
-- porcentaje de beneficiarios activos por empleado no puede exceder 100 --
-- un CHECK de fila no alcanza para una regla que cruza filas, hace falta
-- un trigger (mismo motivo que el EXCLUDE de rrhh.contrato_jornadas para
-- su propia regla entre filas).
-- -----------------------------------------------------------------------------
create table rrhh.empleado_beneficiarios (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  company_id uuid not null references core.companies(id),
  nombre_completo text not null,
  parentesco text not null,
  porcentaje numeric not null check (porcentaje > 0 and porcentaje <= 100),
  documento_identidad text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table rrhh.empleado_beneficiarios is
  'Fase 5 (2026-09-16): beneficiarios del empleado -- dato sensible, gateado por rrhh.expedientes.beneficiarios.* (solo admin). La suma de porcentaje de filas activas por empleado no puede exceder 100 (trg_validar_porcentaje_beneficiarios). Sin DELETE fisico -- se desactiva.';

create index empleado_beneficiarios_empleado_id_idx on rrhh.empleado_beneficiarios (empleado_id);
create index empleado_beneficiarios_company_id_idx on rrhh.empleado_beneficiarios (company_id);

alter table rrhh.empleado_beneficiarios enable row level security;

create policy "empleado_beneficiarios: ver con permiso" on rrhh.empleado_beneficiarios for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.beneficiarios.ver'));

create policy "empleado_beneficiarios: crear con permiso" on rrhh.empleado_beneficiarios for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.beneficiarios.editar'));

create policy "empleado_beneficiarios: editar con permiso" on rrhh.empleado_beneficiarios for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.beneficiarios.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.beneficiarios.editar'));

grant select, insert, update on rrhh.empleado_beneficiarios to authenticated;

create trigger trg_empleado_beneficiarios_updated_at
  before update on rrhh.empleado_beneficiarios
  for each row execute function rrhh.fn_touch_updated_at();

create or replace function rrhh.fn_validar_porcentaje_beneficiarios()
returns trigger
language plpgsql
set search_path = rrhh, pg_temp
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(porcentaje), 0) into v_total
  from rrhh.empleado_beneficiarios
  where empleado_id = new.empleado_id and activo
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.activo then
    v_total := v_total + new.porcentaje;
  end if;

  if v_total > 100 then
    raise exception 'La suma de porcentajes de beneficiarios activos no puede superar 100%% (quedaría en %)', v_total;
  end if;

  return new;
end;
$$;

comment on function rrhh.fn_validar_porcentaje_beneficiarios() is
  'Fase 5 (2026-09-16): la suma de porcentaje de beneficiarios activos por empleado no puede exceder 100 -- regla entre filas, no expresable como CHECK de columna.';

create trigger trg_validar_porcentaje_beneficiarios
  before insert or update on rrhh.empleado_beneficiarios
  for each row execute function rrhh.fn_validar_porcentaje_beneficiarios();
