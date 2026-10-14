# 2026-10-14 — Esquema de usuarios y roles + nueva `has_permission`

## Contexto

Segundo paso de la administración de usuarios y roles de `apps/nexo`, después
del [Paso Cero](2026-10-14-paso-cero-administracion-usuarios-roles.md).
Diseño: [`plan/12-administracion-usuarios-roles.md`](../plan/12-administracion-usuarios-roles.md)
secciones 4-6. SQL revisado y aprobado explícitamente por el usuario antes de aplicar.

## Estado anterior → estado nuevo

- Roles: `core.app_roles` por módulo, asignables solo por SQL (0 asignaciones)
  → **roles de empresa** (`core.roles`/`core.rol_permisos`), un rol por usuario
  (`core.company_memberships.rol_id`), administrables por RPC.
- `core.has_permission`: código → `user_permissions` → `user_app_roles` →
  owner/admin → **código → módulo habilitado → membresía activa →
  `user_permissions` → owner → rol de empresa**.
- Usuarios: sin datos de perfil ni estado → `core.perfiles` + `activo`.
- Pantallas: siguen **sin implementar**.

## Verificación previa (solo lectura)

- `authenticated` **no tiene `USAGE` sobre `core`** → se descartaron las
  policies de lectura del diseño; toda lectura va por RPC.
- `core.audit_log` con particiones solo hasta 2026-11 y **sin `pg_cron`** →
  `core.fn_auditar` asegura la partición del mes antes de insertar y la
  migración crea hasta 2027-01.
- `public.update_platform_settings` usa `core.has_permission` (compatible).
- 1 usuario (owner), 0 `user_app_roles`, 0 `user_permissions`, 0 membresías `admin`.

## Prueba en transacción revertida (antes de aplicar)

Migración completa + bloque de pruebas en una sola transacción contra
`nexo-core`, forzada a revertirse al final; luego se verificó que no quedó
nada (sin tablas, sin columnas, sin usuario de prueba, 0 filas de auditoría).

| # | Caso | Resultado |
|---|---|---|
| T1 | Owner tiene `nexo.administracion.*` y `rrhh.*` | ✓ |
| T2 | Owner sin `agencia.ver_modulo` (módulo no habilitado) | ✓ |
| T3 | Crear 2 roles; permisos duplicados se guardan una vez | ✓ |
| T4 | Permiso de app no habilitada → "Permisos inválidos o de apps no habilitadas" | ✓ |
| T5 | Nombre repetido (mayúsculas distintas) / muy corto → rechazado | ✓ |
| T6 | Alta de usuario con rol; alta duplicada rechazada; owner no puede desactivarse; rol en uso no se elimina | ✓ |
| T7-T8 | Usuario con rol: solo sus permisos, ve solo 1 app | ✓ |
| T9 | Otorgar permiso que no tiene → "No podés otorgar permisos que vos no tenés." | ✓ |
| T10 | Editar su propio rol → rechazado | ✓ |
| T11 | Cambiarse su propio rol → rechazado | ✓ |
| T12 | Modificar al owner sin ser owner → rechazado | ✓ |
| T13 | Auditoría sin permiso → rechazado | ✓ |
| T14 | Usuario desactivado pierde todos los permisos | ✓ |
| T15 | Sin sesión → rechazado | ✓ |

## Migración aplicada

- `20261014203144_nexo_usuarios_roles_esquema` (archivo creado como
  `20261014230000_...`, renombrado a la versión remota sin tocar el SQL).

## Postcheck

- `core.roles`, `core.rol_permisos`, `core.perfiles` creadas; 3 columnas nuevas en membresías.
- 14 RPC presentes; `anon` sin `EXECUTE` en ninguna; helpers `core.fn_*` sin `EXECUTE` para `authenticated`.
- Owner: `rrhh.expedientes.empleados.crear` ✓, `nexo.administracion.roles.crear` ✓, `agencia.ver_modulo` ✗ (esperado).
- 1 membresía activa; `core.audit_log_2027_01` existe; 0 roles; 0 filas de auditoría.
- `get_advisors(security)`: solo avisos esperados en lo nuevo (`rls_enabled_no_policy`
  INFO deliberado; `authenticated_security_definer_function_executable` como el resto
  de RPC de la suite). Preexistentes, sin cambios: `anon` puede ejecutar
  `update_platform_settings` (rechaza sin sesión) y `get_platform_settings`
  (la usa el login); **"Leaked password protection" desactivado** en Auth.

## Pruebas no ejecutadas

- Sin build/E2E: no hay código de app todavía y Node.js/pnpm no están
  instalados en la máquina actual.
- Sin recorrido con las apps desplegadas: el comportamiento para el owner no
  cambia salvo `agencia` (ya inactiva y sin habilitar).

## Deuda / siguiente

1. Pantallas en `apps/nexo` (`/configuracion/usuarios`, `/configuracion/roles`,
   `/configuracion/auditoria`) + Server Actions de Auth (crear cuenta,
   restablecer contraseña, bloquear/desbloquear) + `/cambiar-contrasena`.
   Requiere Node.js 22 + pnpm.
2. Activar "Leaked password protection" en Supabase Auth (acción manual del usuario).
3. Reconciliar `20261014181353_agencia_dashboard_access` (en remoto, no en `main`).
4. Instalar `pg_cron` o un job equivalente para particiones de `rrhh.*`.

## Commit

Rama `feat/usuarios-roles-nexo` (sin push ni merge a `main`).
