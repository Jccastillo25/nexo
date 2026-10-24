-- ENTORNO DESECHABLE para las pruebas de Flotilla (E2). Solo motor efímero
-- (PGlite en memoria): NO es el esquema real de nexo-core y NO se aplica a
-- ninguna base compartida.
--
-- Replica lo que la migración 20261024140400_flotilla_e2_esquema.sql toca o
-- lee, con los nombres que el coordinador verificó en remoto el 2026-10-24:
-- core.companies, catálogo de permisos (36 códigos flotilla), permisos
-- simulados, particiones, rrhh.empleados (unique (id, company_id)) y
-- productos.productos (unique (id, company_id)).
--
-- Límites: has_permission lee core.prueba_permisos (no membresías ni roles
-- reales), las pruebas corren como superusuario (sin RLS efectiva), sin
-- pg_cron y sin concurrencia real entre sesiones.

create schema if not exists core;
create schema if not exists rrhh;
create schema if not exists productos;
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
select c, 'flotilla', split_part(c, '.', 2) from unnest(array[
  'flotilla.ver_modulo',
  'flotilla.dashboard.indicadores.ver','flotilla.entregas.orden_propia.ver','flotilla.entregas.orden.ver','flotilla.entregas.orden.crear',
  'flotilla.entregas.orden.editar','flotilla.entregas.orden.cancelar','flotilla.entregas.orden.cerrar','flotilla.entregas.orden.reabrir',
  'flotilla.entregas.pago.validar','flotilla.entregas.material.validar','flotilla.entregas.cliente.confirmar','flotilla.entregas.cobro.conciliar',
  'flotilla.entregas.recepcion.corregir','flotilla.entregas.evidencia.ver','flotilla.entregas.evidencia.adjuntar','flotilla.rutas.recorrido.ver',
  'flotilla.rutas.recorrido.programar','flotilla.rutas.recorrido.despachar','flotilla.rutas.parada.reprogramar','flotilla.rutas.recorrido.cerrar',
  'flotilla.bodega.carga.preparar','flotilla.bodega.carga.validar','flotilla.bodega.retorno.conciliar','flotilla.conductor.recorrido_propio.operar',
  'flotilla.incidencias.incidencia.crear','flotilla.incidencias.incidencia.gestionar','flotilla.incidencias.incidencia.resolver',
  'flotilla.flota.vehiculo.ver','flotilla.flota.vehiculo.gestionar','flotilla.conductores.perfil.ver','flotilla.conductores.perfil.habilitar',
  'flotilla.configuracion.reglas.gestionar','flotilla.configuracion.excepcion.aprobar','flotilla.reportes.entregas.ver',
  'flotilla.reportes.entregas.exportar']) c;

create table core.prueba_permisos (usuario uuid, empresa uuid, codigo text, primary key (usuario, empresa, codigo));
create function core.has_permission(u uuid, e uuid, c text) returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select exists (select 1 from core.prueba_permisos p where p.usuario = u and p.empresa = e and p.codigo = c)
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

create table productos.productos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null,
  unique (id, company_id)
);
