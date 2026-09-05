# Base de datos de Nexo

Estado (verificado contra el proyecto remoto, 2026-09-04): schema `core`
aplicado (2026-08-30), schema `crm` aplicado y en producción (2026-08-30),
**schema `rrhh` aplicado y en producción (2026-09-02 a 2026-09-04)**.
`flotilla` todavía no existe.

## Proyecto

- Nombre: `nexo-core`
- Project ref: `yrbjlmiqhkyxtlcerowh`
- Organización: `Grupo CT` (`uahxpcssvfzlfxcvtvhu`)
- Región: `us-east-1`
- Plan: gratuito ($0/mes)
- 24 migraciones aplicadas al remoto (`list_migrations`, 2026-09-04),
  todas presentes también en [`supabase/migrations/`](../supabase/migrations/)
  — sin drift entre local y remoto a esa fecha.

## Schemas

| Schema | Contenido | Origen | Estado |
|---|---|---|---|
| `core` | Compañías, membresías/roles, catálogo de apps, catálogo de permisos, roles por app, auditoría, mapa de migración | Nuevo | ✅ Aplicado (2026-08-30), extendido 2026-09-02 (`app_scoped_roles`) |
| `crm` | `clientes` | Migrado de materiales-jcastillo | ✅ Completo (2026-08-30), en producción |
| `rrhh` | Empleados, compensación, kioscos, asistencia, seguridad de accesos, parámetros de ley, planillas — 8 tablas base (14 con particiones) | Diseño nuevo para Nexo (no migración 1:1 de Gestor360) | ✅ Aplicado (2026-09-02 a 2026-09-04), en producción. **MVP operativo sin validar** — ver [RRHH_MVP.md](RRHH_MVP.md) |
| `flotilla` | Flota, viajes, conductores, evidencias | Migrado de Ruta360 | ⏳ Pendiente |

## Exponer schemas en la API (paso manual)

`supabase-js` solo puede leer/escribir en schemas que Supabase expone via
PostgREST — por defecto solo `public`. Ya expuestos a mano en el
dashboard (Settings → API → Data API → Exposed schemas): `public`,
`graphql_public`, `crm`, `rrhh`. No hay herramienta MCP para este ajuste,
hay que repetirlo a mano para `flotilla` cuando le toque su fase.

`core` queda deliberadamente **sin exponer** — todo lo que las apps
necesitan de `core` (permisos, catálogo de módulos) pasa por wrappers en
`public` (`public.has_permission`, `public.get_visible_apps`), así se
evita exponer tablas sensibles como `user_permissions` directo a la API.

## Tablas de `core` (aplicadas)

- `core.companies` — 1 fila: `materiales-jcastillo`
- `core.company_memberships` — roles de usuarios por compañía
- `core.apps` — sembrada con los 4 módulos (`nexo`, `rrhh`, `flotilla`, `crm`)
- `core.company_apps` — `materiales-jcastillo` tiene `nexo`, `crm` y
  `rrhh` habilitados (`enabled = true`, verificado 2026-09-04); `flotilla`
  no tiene fila todavía
- `core.permissions_catalog` — catálogo único de códigos de permiso
  `[app].[modulo].[recurso].[accion]`. 37 códigos bajo `rrhh.*` (dominios
  `expedientes`, `asistencia`, `planillas`, más `rrhh.ver_modulo`) además
  de los de `crm.*` y los 4 de visibilidad de módulo
- `core.app_roles` / `core.app_role_permissions` — roles con alcance por
  app (`app_scoped_roles`, 2026-09-02): para `rrhh`, los roles
  `admin`, `supervisor_asistencia`, `gestor_expedientes`,
  `especialista_planillas` (ver [PERMISSIONS.md](PERMISSIONS.md))
- `core.user_permissions`, `core.audit_log` (particionada mensualmente
  desde 2026-09-02), `core.migration_map`
- `core.tablas_particionadas` — registro genérico de qué tablas
  particionadas mantiene `core.fn_asegurar_particiones_futuras()` (usado
  también por `rrhh.asistencia_marcas` y `rrhh.seguridad_accesos`)
- `core.has_permission()` / `public.has_permission()` — función única de
  la norma v3.0, RLS y apps la llaman por igual (ver PERMISSIONS.md)
- `core.platform_settings` — singleton de marca de la plataforma

Migraciones aplicadas, en orden — ver el archivo correspondiente en
[`supabase/migrations/`](../supabase/migrations/) para el detalle
completo de cada una:

```
20260830000001_core_schema
20260830000002_core_seed_apps
20260830000003_crm_permissions_catalog
20260830000004_seed_materiales_jcastillo
20260830000005_crm_schema
20260830000006_fix_security_advisors
20260830000007_fix_has_permission_execute_grant
20260830000008_get_visible_apps
20260830000009_get_visible_apps_exclude_nexo
20260830000010_fix_crm_schema_grants
20260830000011_platform_settings
20260830000012_fix_update_platform_settings_execute_grant
20260902000001_app_scoped_roles
20260902000002_partition_core_audit_log
20260902000003_fix_audit_log_partitions_rls
20260902000004_fix_partition_functions_search_path
20260902000005_rrhh_permissions_and_roles
20260902000006_rrhh_schema_and_tables
20260902000007_fix_rrhh_search_path_and_pin_grant
20260902000008_rrhh_nicaragua_and_contracts
20260902000009_fix_crear_empleado_anon_grant
20260903000001_enable_rrhh_company_app
20260904000001_fix_rrhh_schema_grants
```

Nota histórica: `core_schema` se reseteó una vez completo (`drop schema
core cascade` + recrear) durante la Fase 3, antes de tener datos reales
— por pedido explícito del usuario, confirmado de bajo riesgo. Ver
[MIGRATION_LOG.md](MIGRATION_LOG.md).

## Schema `rrhh` — detalle completo

Diseñado desde cero para Nexo (no es una migración 1:1 de la base de
Gestor360) en
[`20260902000006_rrhh_schema_and_tables.sql`](../supabase/migrations/20260902000006_rrhh_schema_and_tables.sql)
y extendido en
[`20260902000008_rrhh_nicaragua_and_contracts.sql`](../supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql).
Sigue la plantilla de
[`ARQUITECTURA_MVP_ESCALABLE.md §2-3`](planning/ARQUITECTURA_MVP_ESCALABLE.md):
toda tabla de hechos nace particionada por rango mensual, RLS habilitado
en cada tabla y cada partición desde su creación, ningún permiso
hardcodeado en la app (todo pasa por `core.has_permission()`).

### Tablas

| Tabla | Tipo | Propósito |
|---|---|---|
| `rrhh.empleados` | Catálogo (no particionada) | Legajo base: nombre, documento, puesto, fecha de ingreso/baja, estado, `pin_hash` (bcrypt, nunca texto plano), `nombre_usuario`, `pin_bloqueado`, `intentos_fallidos`, `user_id` (nullable, se vincula cuando el empleado tiene cuenta de acceso operativo) |
| `rrhh.empleado_compensacion` | Catálogo, 1:1 con `empleados` | Salario base y `modalidad_contrato` (`nomina_estandar` \| `comisionista_destajo`). **Tabla separada a propósito**: así `compensacion.ver/editar` es un permiso realmente distinto de `empleados.ver` a nivel de RLS (RLS filtra filas, no columnas) |
| `rrhh.kiosko_dispositivos` | Catálogo (no particionada) | Terminales físicas de marcaje. El `id` (UUID aleatorio) actúa como credencial del dispositivo frente al RPC de marcación |
| `rrhh.asistencia_marcas` | **Hechos, particionada por mes** (`marcado_en`) | Un renglón por marca de entrada/salida, para siempre. Particiones vigentes: `_2026_09`, `_2026_10`, `_2026_11` (mantenidas por `core.fn_asegurar_particiones_futuras`, 2 meses de anticipación) |
| `rrhh.seguridad_accesos` | **Hechos, particionada por mes** (`intentado_en`) | Solo intentos **fallidos** de acceso operativo (`nombre_usuario` + PIN) — no es un log de éxitos. Señal de fuerza bruta/enumeración |
| `rrhh.parametros_ley` | Catálogo versionado | Valores oficiales INSS/INATEC que debe leer el motor de planillas (nunca hardcodeados). Versionado por `vigente_desde`/`vigente_hasta`: nunca se sobreescribe un valor histórico. **`techo_inss` sembrado con un valor de ejemplo (100000.00), no verificado como el oficial vigente** — ver [RRHH_MVP.md](RRHH_MVP.md) "Decisiones de negocio pendientes" |
| `rrhh.planillas` | Catálogo (no particionada — volumen acotado, una fila por corrida) | Corridas de nómina: `periodo_inicio/fin`, `estado` (`borrador`/`aprobada`/`anulada`), `total`. `asiento_contable_id` queda suelto hasta que exista el schema `contabilidad` |
| `rrhh.planilla_detalles` | Catálogo (no particionada) | Un renglón por empleado por planilla: `salario_base`, `horas_extra`, `bonos`, `deducciones`, `total` |

### Funciones públicas (RPC) que consume `apps/rrhh`

Todas `SECURITY DEFINER`, con `search_path` fijado explícitamente
(`set search_path = rrhh, ...`) — mitiga el vector clásico de
`search_path` mutable en funciones `SECURITY DEFINER`.

| Función (`public.*`, wrapper) | Función real (`rrhh.*`) | Rol que la ejecuta | Qué hace |
|---|---|---|---|
| `registrar_marca_kiosko(pin, kiosko_id)` | `fn_registrar_marca_kiosko` | `anon` **a propósito** (el kiosko no tiene sesión) | Valida PIN (bcrypt) contra empleados activos de la empresa del kiosko, alterna entrada/salida según la última marca, inserta en `asistencia_marcas` |
| `validar_acceso_operativo(nombre_usuario, pin)` | `fn_validar_acceso_operativo` | `anon` **a propósito** (login inicial del módulo móvil) | Valida credencial, bloquea a 3 fallos consecutivos, registra fallidos en `seguridad_accesos`, devuelve `auth.users.id` si es válido |
| `crear_empleado(...)` | `fn_crear_empleado` | Solo `authenticated` (revocado de `anon`/`PUBLIC` explícitamente) | Alta de empleado, autogenera `nombre_usuario`/PIN si no se proveen, exige `rrhh.expedientes.empleados.crear` y, si fija salario/modalidad, además `rrhh.expedientes.compensacion.editar` |
| `set_pin_empleado(...)` | `fn_set_pin_empleado` | Solo `authenticated` (revocado de `anon`) | Único camino para asignar/cambiar un PIN — hashea con bcrypt, exige `rrhh.expedientes.empleados.editar` |

`rrhh.fn_asegurar_particion_asistencia_marcas` /
`rrhh.fn_asegurar_particion_seguridad_accesos` — no son RPC de la app,
las invoca `core.fn_asegurar_particiones_futuras()` (mantenimiento de
particiones).

### RLS y permisos — estado verificado

Las 8 tablas base tienen `rowsecurity = true`. Policies por tabla (todas
`for authenticated`, contra `core.has_permission()`): `empleados` (4:
ver/crear/editar/eliminar), `empleado_compensacion` (3: ver/crear/editar
— sin delete, se elimina en cascada con el empleado), `kiosko_dispositivos`
(4), `asistencia_marcas` (4 — el insert desde el kiosko físico bypassea
esta policy porque `fn_registrar_marca_kiosko` es `SECURITY DEFINER`),
`parametros_ley` (3 — sin delete: un parámetro se cierra, no se borra),
`planillas` (3 — sin delete: se anula, no se borra), `planilla_detalles`
(4). `seguridad_accesos` tiene RLS habilitado **sin ninguna policy para
`authenticated`** a propósito (deny-by-default, mismo criterio que
`core.audit_log`): solo `fn_validar_acceso_operativo` (`SECURITY
DEFINER`) escribe ahí.

`GRANT` base de Postgres (`USAGE ON SCHEMA rrhh` + `SELECT, INSERT,
UPDATE, DELETE` en las tablas, para `authenticated`): aplicado en
[`20260904000001_fix_rrhh_schema_grants.sql`](../supabase/migrations/20260904000001_fix_rrhh_schema_grants.sql)
— **faltó en la migración original que creó el schema** (mismo bug ya
visto antes en `crm`, ver
[`20260830000010_fix_crm_schema_grants.sql`](../supabase/migrations/20260830000010_fix_crm_schema_grants.sql)).
Habilitar RLS no sustituye este `GRANT`: sin él, cualquier query falla
con `42501 permission denied` antes de evaluar ninguna policy. Ver el
checklist en [`CLAUDE.md`](../CLAUDE.md) para no repetir este error en el
próximo módulo.

### Riesgos de seguridad detectados (pendientes de resolver antes de producción real)

Verificado con `get_advisors(type=security)` el 2026-09-04, no asumido:

1. **Las funciones internas `rrhh.fn_crear_empleado` y
   `rrhh.fn_set_pin_empleado` son ejecutables directamente por `anon`**
   (WARN `anon_security_definer_function_executable`), pese a que sus
   wrappers en `public` (`crear_empleado`, `set_pin_empleado`) sí tienen
   el `EXECUTE` revocado de `anon`/`PUBLIC` explícitamente. Causa
   probable: el mismo `ALTER DEFAULT PRIVILEGES` del proyecto que ya
   forzó un fix idéntico en `public.crear_empleado`
   ([`20260902000009`](../supabase/migrations/20260902000009_fix_crear_empleado_anon_grant.sql))
   nunca se replicó contra las funciones del schema `rrhh` en sí. Como
   `rrhh` está expuesto en la Data API, un llamado directo (`POST
   /rest/v1/rpc/fn_crear_empleado` con header `Content-Profile: rrhh`,
   sin sesión) es posible a nivel de grant. **Riesgo real hoy: bajo pero
   no cero** — ambas funciones exigen `core.has_permission(auth.uid(),
   ...)` puertas adentro, y `auth.uid()` es `null` para `anon`, así que
   la llamada debería fallar con "Permiso denegado" — pero eso depende
   enteramente de que ese chequeo interno nunca tenga un bug, no de una
   capa de defensa independiente. **Acción recomendada (no aplicada
   todavía, requiere una migración nueva)**: `REVOKE EXECUTE ... FROM
   anon` explícito en ambas funciones del schema `rrhh`, igual que ya se
   hizo para sus wrappers en `public`.
2. **`rrhh.fn_asegurar_particion_asistencia_marcas` también es
   ejecutable por `anon`** pese a no ser el flujo previsto (no es
   `SECURITY DEFINER`, corre con los privilegios del que llama — `anon`
   casi con certeza no tiene `CREATE` en el schema, así que fallaría,
   pero es una superficie innecesaria). Revisar si conviene revocar
   igual, por consistencia.
3. **`auth_leaked_password_protection` deshabilitado** a nivel de
   proyecto (no específico de RRHH) — Supabase Auth no está chequeando
   contraseñas filtradas contra HaveIBeenPwned. Recomendado activarlo
   antes de producción real con usuarios administrativos.

Ninguno de estos tres se corrigió en esta sesión de documentación —
**está documentado, no resuelto**, a la espera de una migración
dedicada. Ver la sección equivalente en [RRHH_MVP.md](RRHH_MVP.md) para
el resto de la auditoría de seguridad pendiente (protección del PIN,
acceso directo a particiones, alcance del kiosko anónimo).

## Escalabilidad (particionamiento, pooling, read replicas)

Diseño completo, con SQL, en
[planning/ARQUITECTURA_MVP_ESCALABLE.md §2](planning/ARQUITECTURA_MVP_ESCALABLE.md#2-estrategia-de-escalabilidad-extrema).
Resumen: toda tabla de hechos (transacciones, históricos, logs) nace
particionada por rango mensual desde su primera migración —
`core.audit_log`, `rrhh.asistencia_marcas` y `rrhh.seguridad_accesos` ya
siguen este patrón, mantenidas por `core.fn_asegurar_particiones_futuras()`
(agnóstica de schema, registrada por tabla en `core.tablas_particionadas`).
Server Components/Actions usan siempre el pooler de Supavisor en modo
transacción (puerto `6543`); migraciones y `pg_cron` usan conexión
directa/sesión (`5432`). Read replicas se aprovisionan recién cuando
aparezca el primer reporte cross-módulo pesado (Torre de Control) — no
antes.
