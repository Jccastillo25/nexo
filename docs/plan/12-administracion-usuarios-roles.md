# Administración de usuarios y roles en Nexo — Paso Cero y diseño (borrador para aprobación)

Fecha: 2026-10-14 · Estado: **Paso Cero (sección 3) aprobado y aplicado a `nexo-core`
el 2026-10-14** (migración `20261014201119_nexo_administracion_permisos_paso_cero`).
Secciones 4-8 (esquema, `has_permission`, RPC, pantallas): **diseño, sin implementar**.

## 1. Decisiones del usuario

| # | Decisión |
|---|---|
| D1 | Usuarios y roles se administran en `apps/nexo`. Se construye antes que el módulo de Turnos. |
| D2 | **Un solo rol por usuario.** Cada rol se personaliza por separado. |
| D3 | El rol define: nombre, descripción, **a qué apps tiene acceso** y **qué permisos internos** tiene en cada app. |
| D4 | Pantalla de rol: **opción A — todo en una sola pantalla** (al activar una app se despliegan sus permisos). |
| D5 | **El administrador pone la contraseña** de cada usuario (con opción de exigir el cambio en el primer ingreso). |
| D6 | **Vínculo usuario ↔ empleado de RRHH desde ya**, opcional por usuario. |

## 2. Estado real verificado en `nexo-core` (2026-10-14, solo lectura)

- `auth.users`: **1 usuario**. `core.company_memberships`: 1 fila, rol `owner`.
- `core.user_app_roles`: **0 filas**. `core.user_permissions`: **0 filas**.
  → Cambiar el modelo **no le quita acceso a nadie**.
- `core.app_roles`: 5 roles de RRHH (admin 65, gestor_expedientes 27,
  supervisor_asistencia 26, especialista_planillas 17, consulta 14) + 1 de `agencia`.
- `core.permissions_catalog`: rrhh 66, crm 5, nexo 2, agencia 2, flotilla 1.
- `core.apps`: nexo, rrhh, crm, flotilla (activas) y agencia (inactiva).
  `core.company_apps` habilita nexo, crm y rrhh.
- `rrhh.empleados.user_id` ya existe: FK a `auth.users`, `UNIQUE`. Se reutiliza para D6.
- `core.has_permission` y `public.get_visible_apps` coinciden con las migraciones del repo.

## 3. Matriz de permisos de la administración (Paso Cero)

Formato estricto de 4 segmentos `[app].[modulo].[recurso].[accion]`.

| Código | Etiqueta | Para qué |
|---|---|---|
| `nexo.administracion.usuarios.ver` | Ver usuarios | Lista y ficha de usuarios |
| `nexo.administracion.usuarios.crear` | Crear usuarios | Alta con contraseña y rol |
| `nexo.administracion.usuarios.editar` | Editar usuarios | Datos, rol, vínculo con RRHH, restablecer contraseña |
| `nexo.administracion.usuarios.desactivar` | Desactivar usuarios | Bloquear o reactivar el acceso |
| `nexo.administracion.roles.ver` | Ver roles | Lista y detalle de roles |
| `nexo.administracion.roles.crear` | Crear roles | Rol nuevo con sus apps y permisos |
| `nexo.administracion.roles.editar` | Editar roles | Cambiar apps y permisos de un rol |
| `nexo.administracion.roles.eliminar` | Eliminar roles | Solo si ningún usuario lo tiene asignado |
| `nexo.administracion.auditoria.ver` | Ver auditoría | Historial de cambios de usuarios y roles |

No hay roles predefinidos: el **owner** tiene todo y crea los roles desde la pantalla
(por ejemplo, "Administrador de usuarios" con los 9 permisos de arriba).

```sql
-- Paso Cero: solo catálogo. Precheck obligatorio antes de aplicar:
--   select code from core.permissions_catalog where code like 'nexo.administracion.%';  -- debe dar 0 filas
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('nexo.administracion.usuarios.ver',        'nexo', 'administracion', 'Ver usuarios',        'Ver la lista y la ficha de usuarios de la empresa.'),
  ('nexo.administracion.usuarios.crear',      'nexo', 'administracion', 'Crear usuarios',      'Dar de alta usuarios con contraseña y rol.'),
  ('nexo.administracion.usuarios.editar',     'nexo', 'administracion', 'Editar usuarios',     'Editar datos, rol, vínculo con RRHH y restablecer contraseña.'),
  ('nexo.administracion.usuarios.desactivar', 'nexo', 'administracion', 'Desactivar usuarios', 'Bloquear o reactivar el acceso de un usuario.'),
  ('nexo.administracion.roles.ver',           'nexo', 'administracion', 'Ver roles',           'Ver roles y sus permisos.'),
  ('nexo.administracion.roles.crear',         'nexo', 'administracion', 'Crear roles',         'Crear roles con apps y permisos.'),
  ('nexo.administracion.roles.editar',        'nexo', 'administracion', 'Editar roles',        'Cambiar las apps y permisos de un rol.'),
  ('nexo.administracion.roles.eliminar',      'nexo', 'administracion', 'Eliminar roles',      'Eliminar un rol sin usuarios asignados.'),
  ('nexo.administracion.auditoria.ver',       'nexo', 'administracion', 'Ver auditoría',       'Historial de cambios de usuarios y roles.');
```

## 4. Modelo de datos nuevo

```text
core.roles            rol de la empresa (nombre, descripción, activo)
core.rol_permisos     permisos del rol  (incluye <app>.ver_modulo = "acceso a la app")
core.perfiles         datos de la persona (nombre, teléfono, cargo, debe_cambiar_password)
core.company_memberships  + rol_id, + activo      (1 rol por usuario y empresa)
rrhh.empleados.user_id    (ya existe)              vínculo con el expediente
```

```sql
create table core.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 2 and 80),
  descripcion text,
  activo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index roles_company_nombre_uq on core.roles (company_id, lower(nombre));

create table core.rol_permisos (
  rol_id uuid not null references core.roles(id) on delete cascade,
  permission_code text not null references core.permissions_catalog(code) on update cascade,
  primary key (rol_id, permission_code)
);
create index rol_permisos_code_idx on core.rol_permisos (permission_code);

create table core.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  telefono text,
  cargo text,
  debe_cambiar_password boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table core.company_memberships
  add column rol_id uuid,
  add column activo boolean not null default true,
  add constraint memberships_rol_misma_empresa
    foreign key (rol_id, company_id) references core.roles(id, company_id);
create index memberships_rol_idx on core.company_memberships (rol_id);

-- RLS: lectura solo con permiso; SIN policies de escritura (todo pasa por RPC security definer).
alter table core.roles enable row level security;
alter table core.rol_permisos enable row level security;
alter table core.perfiles enable row level security;
create policy "roles: ver con permiso" on core.roles for select to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'nexo.administracion.roles.ver'));
create policy "rol_permisos: ver con permiso" on core.rol_permisos for select to authenticated
  using (exists (select 1 from core.roles r where r.id = rol_id
    and core.has_permission((select auth.uid()), r.company_id, 'nexo.administracion.roles.ver')));
create policy "perfiles: ver el propio" on core.perfiles for select to authenticated
  using (user_id = (select auth.uid()));
grant select on core.roles, core.rol_permisos, core.perfiles to authenticated;
```

## 5. `core.has_permission` — nueva evaluación

Las apps **no cambian**: siguen llamando a `public.has_permission(companyId, code)`.

| Orden | Regla | Cambio |
|---|---|---|
| 1 | Código no registrado → **no** | igual |
| 2 | Módulo del permiso no habilitado para la empresa (`company_apps`) → **no** (incluso para el owner) | **nuevo** (cierra el hueco del análisis) |
| 3 | Usuario sin membresía o con `activo = false` → **no** | **nuevo** |
| 4 | Fila explícita en `user_permissions` → esa fila manda | igual (sin pantalla por ahora) |
| 5 | Membresía `owner` → **sí** | se quita el bypass de `admin`: hoy no hay ningún admin |
| 6 | El rol del usuario incluye el permiso → **sí** | **nuevo**, reemplaza a `user_app_roles` |
| 7 | En cualquier otro caso → **no** | igual |

`core.app_roles` deja de evaluarse y se conserva como **plantillas**: en el editor de roles,
al activar RRHH aparece "Cargar plantilla ▼" (Gestor de expedientes, Supervisor de asistencia, etc.),
que marca esas casillas de una vez.

## 6. Funciones (RPC) y acciones

Todas las RPC son `security definer`, validan el permiso con `auth.uid()`, y escriben en `core.audit_log`.

| Función | Permiso | Reglas de seguridad |
|---|---|---|
| `admin_listar_usuarios(company)` | usuarios.ver | — |
| `admin_guardar_rol(company, rol_id?, nombre, descripcion, permisos[])` | roles.crear / roles.editar | Códigos válidos y de módulos habilitados; **no puede editar su propio rol**; solo puede otorgar permisos que él mismo tiene (owner exento) |
| `admin_eliminar_rol(company, rol_id)` | roles.eliminar | Solo si nadie lo tiene asignado |
| `admin_completar_alta(company, user_id, perfil, rol_id, empleado_id?)` | usuarios.crear | El empleado debe ser de la misma empresa y no estar vinculado a otro usuario |
| `admin_editar_usuario(company, user_id, perfil, rol_id, empleado_id?)` | usuarios.editar | **No puede cambiarse su propio rol**; no se puede tocar al owner |
| `admin_cambiar_estado(company, user_id, activo)` | usuarios.desactivar | No puede desactivarse a sí mismo ni al owner |

Server Actions de `apps/nexo` (necesarias porque la API de administración de Supabase Auth
solo se usa del lado del servidor con `SUPABASE_SERVICE_ROLE_KEY`, que `nexocore` ya tiene):

- **Crear usuario:** valida permiso → `auth.admin.createUser({ email, password, email_confirm: true })`
  → RPC `admin_completar_alta`. Si la RPC falla, se borra el usuario recién creado en Auth.
- **Restablecer contraseña:** valida permiso → `auth.admin.updateUserById` → marca `debe_cambiar_password`.
- **Desactivar:** RPC `admin_cambiar_estado` + bloqueo en Auth (`ban_duration`), así no puede iniciar sesión.
  Conserva su rol y su historial; al reactivar recupera todo.
- **Primer ingreso:** si `debe_cambiar_password = true`, el login de Nexo lo manda a `/cambiar-contrasena`.

## 7. Pantallas (`apps/nexo`)

- `/configuracion/usuarios`: lista con búsqueda, estado y rol. Nuevo y editar: nombre, correo,
  teléfono, cargo, contraseña temporal, empleado de RRHH (buscador), rol (lista), estado.
- `/configuracion/roles`: lista con apps y número de permisos. Nuevo y editar: **opción A**.
- `/configuracion/auditoria`: historial filtrable.
- Todos los botones se ocultan si el usuario no tiene el permiso (la RPC igual lo bloquea).

## 8. Orden de implementación

1. **Paso Cero** — aplicar la sección 3 (solo catálogo), tras tu aprobación.
2. **Migración del esquema** — sección 4 + nueva `has_permission` + RPC. Prechecks y postchecks de solo lectura.
3. **Roles** — pantalla de la opción A con plantillas.
4. **Usuarios** — alta con contraseña, edición, vínculo con RRHH, desactivar.
5. **Primer ingreso y auditoría.**
6. **Documentación** — `PERMISSIONS.md`, `DATABASE.md`, `MIGRATION_LOG.md`, `IMPLEMENTATION_STATUS.md` + status-log.
7. Recién después: **Paso Cero de Turnos**, que solo registra su catálogo; sus roles se arman en esta pantalla.

## 9. Pendiente

- ~~Aprobación explícita del Paso Cero (sección 3)~~ — aprobado y aplicado 2026-10-14.
- Aprobación de la migración de esquema (secciones 4-6) antes de aplicarla.
- Node.js + pnpm en la máquina de desarrollo para `pnpm install`/`next build` (hoy no están instalados en `Ventas03`).
