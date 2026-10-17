# Verificación remota de seguridad — consultas de solo lectura

Para el **coordinador** (los subagentes no tienen el MCP de Supabase). Proyecto
`nexo-core`, ref `yrbjlmiqhkyxtlcerowh`. Todo aquí es diagnóstico: **ninguna
consulta escribe**. No usar `apply_migration` desde esta guía; una corrección
se propone como migración nueva por el flujo normal (`CLAUDE.md`).

## 1. Advisors

`get_advisors` con tipo `security`. Avisos **esperados** (no son hallazgo por sí
solos, ver `docs/MIGRATION_LOG.md:204-208`):

- `rls_enabled_no_policy` (INFO) en tablas de schemas privados (patrón B: `productos`, `atencion`, `core`).
- `authenticated_security_definer_function_executable` (WARN) en RPC `public.*` que validan permiso adentro con `core.fn_exigir_permiso`.

Sí son hallazgo: `rls_disabled_in_public`, `policy_exists_rls_disabled`,
`function_search_path_mutable`, `anon_security_definer_function_executable`
(salvo excepciones documentadas, p. ej. `public.get_platform_settings`, que el
login llama sin sesión: `20260830000011_platform_settings.sql:64-65`),
`permissive_rls_policy`, `rls_references_user_metadata`,
`security_definer_view`, `sensitive_columns_exposed`.

Lista de lints de referencia: https://supabase.com/docs/guides/database/database-advisors

## 2. Consultas (`execute_sql`, solo `select`)

Schemas internos que se excluyen en todas:

```sql
-- reutilizar este filtro en cada consulta
n.nspname not in ('pg_catalog','information_schema','pg_toast','auth','storage',
  'realtime','_realtime','supabase_functions','supabase_migrations','extensions',
  'graphql','graphql_public','net','pgsodium','pgsodium_masks','vault','cron',
  'pgbouncer','_analytics')
and n.nspname not like 'pg_temp%' and n.nspname not like 'pg_toast_temp%'
```

### 2.1 Tablas (y particiones) sin RLS

```sql
select n.nspname as schema, c.relname as tabla, c.relkind, c.relispartition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p')
  and not c.relrowsecurity
  and n.nspname not in ('pg_catalog','information_schema','pg_toast','auth','storage',
    'realtime','_realtime','supabase_functions','supabase_migrations','extensions',
    'graphql','graphql_public','net','pgsodium','pgsodium_masks','vault','cron',
    'pgbouncer','_analytics')
  and n.nspname not like 'pg_temp%'
order by 1, 2;
```

Esperado: 0 filas. Las particiones cuentan: una partición sin RLS es accesible
directamente aunque la tabla madre tenga RLS (precedente:
`20260902000003_fix_audit_log_partitions_rls.sql`).

### 2.2 Funciones `security definer` sin `search_path` fijo (o no vacío)

```sql
select n.nspname as schema, p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as args,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and n.nspname not in ('pg_catalog','information_schema','auth','storage','realtime',
    'supabase_functions','extensions','graphql','graphql_public','net','pgsodium',
    'vault','cron','pgbouncer')
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
    where cfg in ('search_path=""', 'search_path=')
  )
order by 1, 2;
```

Filas con `proconfig` nulo → sin `search_path`: hallazgo. Filas con
`search_path=core` u otro valor no vacío → aceptable si es pre-existente
(`20260830000006_fix_security_advisors.sql:14`); en código nuevo se pide `''`.
La forma exacta en que Postgres guarda el valor vacío en `proconfig` puede
variar (`search_path=""`); si una función conocida con `set search_path = ''`
aparece aquí, ajustar el filtro en vez de reportarla.

### 2.3 Funciones `security definer` ejecutables por `anon`

```sql
select n.nspname as schema, p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and n.nspname not in ('pg_catalog','information_schema','auth','storage','realtime',
    'supabase_functions','extensions','graphql','graphql_public','net','pgsodium',
    'vault','cron','pgbouncer')
order by 1, 2;
```

Cada fila necesita justificación escrita en su migración (login sin sesión,
kiosko de RRHH). Si no la tiene: hallazgo.

### 2.4 Privilegios de schema para `authenticated` y `anon`

```sql
select n.nspname as schema,
       has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage,
       has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage
from pg_namespace n
where n.nspname not in ('pg_catalog','information_schema','pg_toast','auth','storage',
    'realtime','_realtime','supabase_functions','supabase_migrations','extensions',
    'graphql','graphql_public','net','pgsodium','pgsodium_masks','vault','cron',
    'pgbouncer','_analytics')
  and n.nspname not like 'pg_temp%' and n.nspname not like 'pg_toast_temp%'
order by 1;
```

Lectura:
- Patrón A (`crm`, `rrhh`): `authenticated_usage = true`. Si es `false`, las
  pantallas fallan con 42501 (bug ya visto dos veces).
- Patrón B (`productos`, `atencion`, `core`): `false` en ambas columnas.
- `anon_usage = true` fuera de `public` → hallazgo salvo justificación.

### 2.5 Tablas con privilegios para `anon` fuera de `public`

```sql
select n.nspname as schema, c.relname as tabla,
       has_table_privilege('anon', c.oid, 'SELECT') as sel,
       has_table_privilege('anon', c.oid, 'INSERT') as ins,
       has_table_privilege('anon', c.oid, 'UPDATE') as upd,
       has_table_privilege('anon', c.oid, 'DELETE') as del
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p','v','m')
  and n.nspname not in ('public','pg_catalog','information_schema','pg_toast','auth',
    'storage','realtime','_realtime','supabase_functions','supabase_migrations',
    'extensions','graphql','graphql_public','net','pgsodium','pgsodium_masks','vault',
    'cron','pgbouncer','_analytics')
  and (has_table_privilege('anon', c.oid, 'SELECT')
    or has_table_privilege('anon', c.oid, 'INSERT')
    or has_table_privilege('anon', c.oid, 'UPDATE')
    or has_table_privilege('anon', c.oid, 'DELETE'))
order by 1, 2;
```

Esperado: 0 filas. Nota: `has_table_privilege` exige además `USAGE` en el
schema para que el acceso sea efectivo; cruzar con 2.4.

## 3. Cómo reportar

Cada fila anómala es un hallazgo con el formato de la skill, citando la
consulta (`2.x`) como evidencia en lugar de `archivo:línea`, y la migración
que debería corregirlo. Si el MCP no está disponible, marcar toda esta sección
como **pendiente / no comprobado**.
