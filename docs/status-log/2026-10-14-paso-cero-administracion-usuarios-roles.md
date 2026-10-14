# 2026-10-14 — Paso Cero: administración de usuarios y roles (`apps/nexo`)

## Contexto

El usuario pidió construir primero la administración de usuarios, roles y
permisos, y después el módulo de Turnos (sala de espera). Hoy el motor de
permisos existe solo en base de datos: no hay pantalla para crear usuarios
ni asignar roles (se hace con SQL manual).

Decisiones explícitas del usuario (mismo día), registradas en
[`plan/12-administracion-usuarios-roles.md`](../plan/12-administracion-usuarios-roles.md):

1. Usuarios y roles se administran en `apps/nexo`.
2. Un solo rol por usuario, personalizado por la empresa.
3. Rol = nombre + apps con acceso + permisos internos de cada app.
4. Pantalla de rol en una sola vista (opción A, elegida tras probar un prototipo A/B).
5. El administrador pone la contraseña (con cambio obligatorio al primer ingreso).
6. Vínculo usuario ↔ empleado de RRHH desde ya (opcional).

## Estado anterior → estado nuevo

- Catálogo `nexo`: 2 códigos (`nexo.ver_modulo`, `nexo.configuracion.editar`)
  → 11 códigos (+9 `nexo.administracion.*`).
- Administración de usuarios/roles: inexistente → **Paso Cero aplicado; esquema,
  RPC y UI solo diseñados (sin implementar)**.

## Verificación remota previa (solo lectura, `nexo-core`)

- `auth.users`: 1 usuario; `core.company_memberships`: 1 fila (`owner`).
- `core.user_app_roles` y `core.user_permissions`: 0 filas → el cambio de
  modelo propuesto no quita acceso a nadie.
- `core.app_roles`: 5 roles de RRHH + 1 de `agencia` (se proponen como plantillas).
- `rrhh.empleados.user_id` ya existe (FK a `auth.users`, `UNIQUE`) → se reutiliza para el vínculo.
- `core.has_permission` y `public.get_visible_apps` remotos coinciden con el repo.
- 0 códigos `nexo.administracion.%` antes de aplicar.

## Migración

- `20261014201119_nexo_administracion_permisos_paso_cero` — solo catálogo
  (9 `insert` en `core.permissions_catalog`). Aplicada con `apply_migration`
  tras aprobación explícita del usuario.

## Postcheck

- 9 códigos nuevos presentes; `nexo` = 11 en el catálogo.
- `core.user_permissions` y `core.user_app_roles` siguen en 0 filas.
- Versión remota registrada: `20261014201119` (coincide con el nombre del archivo local).

## Pruebas

Solo verificación SQL remota. Sin build: Node.js/pnpm no están instalados en
la máquina de desarrollo actual (`Ventas03`) — no hubo cambios de código de app.

## Divergencias y deuda

- `20261014181353_agencia_dashboard_access` aplicada en `nexo-core` pero
  ausente en `main` (probable origen: rama `feat/issue-18-agencia-independiente`).
  Pendiente de reconciliar; no interfiere con esta migración.
- Próximo paso: migración de esquema (secciones 4-6 del plan 12:
  `core.roles`, `core.rol_permisos`, `core.perfiles`, membresía con `rol_id`/`activo`,
  nueva `core.has_permission`, RPC de administración) — requiere aprobación aparte.
- Instalar Node.js 22 LTS + pnpm (`corepack enable`) antes de tocar código de `apps/nexo`.

## Commit

Rama `feat/usuarios-roles-nexo` (sin push ni merge a `main`).
