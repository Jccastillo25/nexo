-- =============================================================================
-- Entorno DESECHABLE para la prueba P1 (issue #30).
--
-- NO es el esquema real de nexo-core y NO debe aplicarse a ninguna base
-- compartida: crea un `rrhh` mínimo (solo las tablas/columnas que toca
-- rrhh.fn_registrar_marca_kiosko) más `core.companies`. Sirve para ejecutar
-- `rrhh_p1_pin_ambiguo.prueba.sql` en un PostgreSQL desechable (contenedor,
-- PGlite, base local) sin necesidad de clonar el esquema completo.
--
-- Orden de ejecución (ver supabase/tests/README.md):
--   1. este archivo
--   2. supabase/migrations/20261017131004_p1_pin_ambiguo_fallo_cerrado.sql
--   3. rrhh_p1_pin_ambiguo.prueba.sql
--
-- Lo que SÍ replica del esquema real (importa para que la prueba sea válida):
--   * una sola credencial por contrato (unique en contrato_id);
--   * a lo sumo un contrato activo por empleado (índice parcial único);
--   * FK compuesta (empleado_id, company_id) de contratos -> empleados;
--   * rrhh.kiosko_rate_limits con la misma forma y check;
--   * el wrapper público public.registrar_marca_kiosko (copia literal del
--     vigente en 20260905000005_rrhh_public_auth_hardening.sql) porque la
--     prueba comprueba también el camino anónimo real.
-- Lo que NO replica: particiones de rrhh.asistencia_marcas (aquí tabla plana),
-- RLS/policies, triggers, el resto de columnas del esquema, ni bcrypt real si
-- la plataforma no trae pgcrypto (ver el bloque de `crypt` más abajo).
-- =============================================================================

create schema if not exists core;
create schema if not exists rrhh;
create schema if not exists extensions;

-- Roles que usan los REVOKE/GRANT de las migraciones reales.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$roles$;

-- pgcrypto, con el mismo layout que Supabase (schema `extensions`, que es el
-- que incluye el search_path de la función). Se exige pgcrypto REAL: la prueba
-- compara PINes con el mismo crypt()/bcrypt que producción, no con un
-- sustituto. Si la plataforma no lo trae, se avisa y se aborta en vez de
-- degradar la prueba en silencio (PGlite incluye pgcrypto en
-- @electric-sql/pglite/contrib/pgcrypto; ver supabase/tests/README.md).
create extension if not exists pgcrypto with schema extensions;

do $crypto$
begin
  if to_regprocedure('extensions.crypt(text,text)') is null then
    raise exception 'entorno P1: falta pgcrypto (extensions.crypt) — la prueba necesita bcrypt real para comparar PINes';
  end if;
end
$crypto$;

create table core.companies (
  id uuid primary key,
  nombre text not null
);

create table rrhh.empleados (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  codigo_empleado bigint generated always as identity,
  nombre text not null,
  apellido text not null,
  documento_identidad text,
  estado text not null default 'activo',
  unique (id, company_id)
);

create table rrhh.kiosko_dispositivos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null,
  ubicacion text,
  activo boolean not null default true
);

create table rrhh.kiosko_rate_limits (
  kiosko_id uuid primary key references rrhh.kiosko_dispositivos(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  intentos_en_ventana smallint not null default 0 check (intentos_en_ventana >= 0),
  bloqueado_hasta timestamptz,
  updated_at timestamptz not null default now()
);

create table rrhh.contratos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  numero_contrato bigint generated always as identity,
  estado text not null default 'borrador' check (estado in ('borrador', 'activo', 'finalizado')),
  fecha_inicio date,
  foreign key (empleado_id, company_id) references rrhh.empleados (id, company_id)
);

create unique index contratos_empleado_activo_unq on rrhh.contratos (empleado_id) where estado = 'activo';

create table rrhh.contrato_credenciales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contrato_id uuid not null unique references rrhh.contratos(id) on delete cascade,
  pin_hash text not null,
  activo boolean not null default true,
  pin_bloqueado boolean not null default false,
  intentos_fallidos smallint not null default 0,
  rotacion_numero int not null default 1,
  revocado_at timestamptz
);

-- En el esquema real esta tabla está particionada por mes; aquí es plana (a la
-- función le da igual: solo inserta y ordena por marcado_en).
create table rrhh.asistencia_marcas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id),
  kiosko_id uuid references rrhh.kiosko_dispositivos(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  origen text not null default 'kiosko' check (origen in ('kiosko', 'manual')),
  marcado_en timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Copia literal del wrapper público vigente
-- (supabase/migrations/20260905000005_rrhh_public_auth_hardening.sql). El único
-- camino anónimo real hacia la función interna.
--
-- check_function_bodies = off: en nexo-core el wrapper se crea DESPUÉS de la
-- función interna (20260905000002/000005); aquí se crea antes de aplicar la
-- migración P1, así que Postgres no puede validar todavía el cuerpo SQL.
set check_function_bodies = off;

create function public.registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language sql
security definer
set search_path = rrhh, pg_temp
as $$
  select * from rrhh.fn_registrar_marca_kiosko(p_pin, p_kiosko_id);
$$;

reset check_function_bodies;

revoke execute on function public.registrar_marca_kiosko(text, uuid) from public;
grant execute on function public.registrar_marca_kiosko(text, uuid) to anon, authenticated;
