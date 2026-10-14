# 2026-10-14 — Pantallas de usuarios, roles y auditoría (`apps/nexo`)

## Contexto

Tercer paso de la administración de usuarios y roles, sobre la base de datos
ya aplicada ([esquema](2026-10-14-usuarios-roles-esquema.md)). Diseño:
[`plan/12-administracion-usuarios-roles.md`](../plan/12-administracion-usuarios-roles.md) §7.

## Estado anterior → estado nuevo

- Sin pantallas (alta de usuarios por SQL) → **implementado, sin validar con sesión real**.

## Entregado

| Ruta | Permiso | Qué hace |
|---|---|---|
| `/configuracion/usuarios` | `usuarios.ver` | Lista: nombre, correo, rol, empleado RRHH, estado, contraseña temporal, último ingreso |
| `/configuracion/usuarios/nuevo` | `usuarios.crear` (+ `roles.ver` para la lista de roles) | Alta con contraseña temporal, rol y vínculo RRHH |
| `/configuracion/usuarios/[id]` | `usuarios.editar` / `usuarios.desactivar` | Editar datos, rol y vínculo; restablecer contraseña; desactivar/reactivar |
| `/configuracion/roles` | `roles.ver` / `roles.eliminar` | Lista con apps, permisos y usuarios; eliminar si no está en uso |
| `/configuracion/roles/nuevo`, `/[id]` | `roles.crear` / `roles.editar` | Editor opción A: activar app → permisos por dominio/recurso, "Marcar todo", "Cargar plantilla" (`core.app_roles`) |
| `/configuracion/auditoria` | `auditoria.ver` | Últimos 200 cambios `admin.*` |
| `/cambiar-contrasena` | sesión | Primer ingreso con contraseña temporal; el login, el Launcher y el layout `(app)` redirigen ahí mientras `debe_cambiar_password` |

- Server Actions (`requirePermission` antes de todo; la regla real vive en las RPC):
  `crearUsuario` (Auth `createUser` con service role → `admin_completar_alta`;
  si la RPC falla se borra la cuenta), `editarUsuario`, `cambiarEstadoUsuario`
  (RPC + `ban_duration` en Auth), `restablecerPassword` (RPC primero, después
  Auth), `buscarEmpleados`, `guardarRol`, `eliminarRol`, `cambiarPassword`.
- Sidebar de Nexo: "Configuración" pasa a grupo con Marca, Usuarios, Roles, Auditoría.
- **Fix de seguridad del análisis del 2026-10-14**: `login/actions.ts` ya no
  acepta `next=//otro-sitio` ni `/\otro-sitio` (redirección abierta).
- Texto del Launcher sin apps: ya no menciona tablas internas.
- **Ajuste tras el primer preview (mismo día):** el usuario no encontraba las
  pantallas porque el Launcher no tenía forma de llegar a Configuración
  (decisión 2026-09-17). Nueva decisión: sección "Administración" con tarjeta
  "Configuración" en el Launcher, visible solo con algún permiso de
  administración. `tsc` y `eslint` limpios.

## Pruebas ejecutadas

- `pnpm install --frozen-lockfile` (sin cambios de dependencias ni de lockfile).
- `next build` de `apps/nexo`: limpio (14 rutas). `eslint`: limpio.
- `next dev` local: `/configuracion/usuarios` sin sesión redirige a
  `/login?next=...`; el login renderiza; consola sin errores.

## Pruebas NO ejecutadas (pendientes)

- Recorrido con sesión real (crear rol, crear usuario, primer ingreso,
  desactivar): sin credenciales de prueba en esta sesión.
- Alta de usuarios en local necesita `SUPABASE_SERVICE_ROLE_KEY` en
  `apps/nexo/.env.local` (no se configuró: es un secreto del usuario). En
  Vercel, `nexocore` ya lo usa para Marca — verificar que esté en Preview y Production.
- Deployment de Vercel de la rama (sin push todavía).

## Deuda

- Un usuario con `usuarios.crear` pero sin `roles.ver` ve la lista de roles vacía (avisado en el formulario).
- El correo no se edita después del alta.
- Activar "Leaked password protection" en Supabase Auth.

## Commit y despliegue

Rama `feat/usuarios-roles-nexo` (con el ticket #18 de Agencia unido por merge),
fusionada a `main` en el PR #20 (merge commit `ff46bce`, 2026-10-14) por
decisión del usuario ("mandar todo a producción", Agencia en espera).
Production de Vercel: `nexocore` READY; `/configuracion/usuarios` sin sesión
redirige a `/login` en `nexo.materialesjcastillo.com`. `nexo-crm`/`nexo-rrhh`
recompilando al momento de escribir esto; `nexo-agencia` READY pero sin
conectar (sin `AGENCIA_APP_URL` de Production, app inactiva en `nexo-core`).
