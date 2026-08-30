-- =============================================================================
-- schema `crm` — migrado desde el proyecto Supabase materiales-jcastillo-crm
-- (arzadwxsifnaolvfcvqk), schema public. Estructura recreada segun
-- database.types.ts generado el 2026-08-29 (el proyecto de origen esta
-- pausado y no se pudo consultar en vivo — ver docs/MIGRATION_LOG.md sobre
-- los datos reales pendientes de copiar).
-- =============================================================================

create schema if not exists crm;

-- Postgres no permite una subquery cruda en DEFAULT; se envuelve en una
-- funcion stable, que si esta permitida.
create or replace function crm.default_company_id()
returns uuid
language sql
stable
as $$
  select id from core.companies where slug = 'materiales-jcastillo';
$$;

create table crm.clientes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id)
    default crm.default_company_id(),
  numero_cliente bigint generated always as identity,
  nombre text not null,
  telefono text,
  direccion text,
  ruc text,
  notas text,
  tipo_cliente text check (tipo_cliente in ('mayorista', 'detal')),
  datos_extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (numero_cliente)
);

comment on table crm.clientes is
  'Migrado desde materiales-jcastillo-crm (arzadwxsifnaolvfcvqk). numero_cliente se recreo como identity (bigint autoincremental) — verificar contra el original si usaba otro formato antes de dar por buena esta migracion.';

alter table crm.clientes enable row level security;

-- Las 4 policies usan core.has_permission(), la misma funcion que las
-- server actions llaman via RPC (public.has_permission) — una sola fuente
-- de verdad, no una regla distinta a nivel de base de datos.
create policy "clientes: ver con permiso" on crm.clientes
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, 'crm.clientes.ver'));

create policy "clientes: crear con permiso" on crm.clientes
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, 'crm.clientes.crear'));

create policy "clientes: editar con permiso" on crm.clientes
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, 'crm.clientes.editar'))
  with check (core.has_permission(auth.uid(), company_id, 'crm.clientes.editar'));

create policy "clientes: eliminar con permiso" on crm.clientes
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, 'crm.clientes.eliminar'));
