# Panel de plataforma (super admin): empresas, módulos y cupo de usuarios — Paso Cero y diseño

Fecha: 2026-10-22 · Estado: **Paso Cero (sección 3) aprobado y aplicado en `nexo-core` el
2026-10-23** (`20261024033541_nexo_plataforma_permisos_paso_cero`). Secciones 4–7 (esquema,
RPC, empresa activa, pantallas): **borrador, sin aplicar y sin código.**

Pedido del usuario (2026-10-22): "un panel administrativo dentro de Nexo, panel super admin,
para crear una empresa, asignar qué módulos puede ver esa empresa y cuántos usuarios tiene
permitido".

## 1. Decisiones del usuario (2026-10-22)

| # | Decisión |
|---|---|
| P1 | **Un usuario puede pertenecer a varias empresas.** Al iniciar sesión en el login único de Nexo, ve las empresas a las que tiene acceso y elige a cuál entrar. |
| P2 | **Cada empresa tiene sus propios roles y sus propias apps activas.** (El modelo de `plan/12` ya es por empresa: `core.roles`, `core.company_apps`, `core.company_memberships.rol_id`.) |
| P3 | **El super admin puede entrar a cualquier empresa** con los permisos de su dueño; cada entrada queda en la auditoría de esa empresa. |
| P4 | **Al crear la empresa se crea su primer administrador** (correo + contraseña temporal), como dueño (`owner`) de esa empresa. |
| P5 | **El cupo cuenta los usuarios activos**, incluido el administrador. Desactivar uno libera un cupo. Cupo vacío = sin límite. |

## 2. Estado real verificado en `nexo-core` (2026-10-22, solo lectura)

- `core.companies`: **1 empresa** (Materiales J Castillo), columnas `id, name, slug, tax_id, active`.
  No tiene cupo de usuarios.
- `core.company_memberships`: 4 filas (1 `owner`, 3 `member`), todas de esa empresa.
- `core.company_apps`: 7 apps habilitadas para esa empresa. `core.apps`: 10 apps (`erp` y
  `precios` inactivas).
- **No existe** ningún concepto de super admin en `core` (sí lo tenía Ruta360, `apps/flotilla`,
  en `public.platform_admins`: se reutiliza la idea).
- `core.has_permission` **no** revisa `companies.active`: desactivar una empresa hoy no le
  quita acceso a nadie.
- Las tablas de los módulos ya llevan `company_id` (solo `atencion.contadores` y dos tablas de
  límites del kiosco no lo llevan, y no lo necesitan). **La base ya es multiempresa; el código no.**
- **El código es de una sola empresa:** `packages/auth/empresa.ts` toma la empresa de la
  variable `NEXO_COMPANY_ID` de cada proyecto de Vercel. Una empresa nueva no funcionaría
  aunque exista en la base. Esto es lo más grande del trabajo (sección 6).
- Única función que deduce la empresa del usuario con `limit 1`:
  `public.update_platform_settings` (marca global del login). Con varias empresas por usuario
  quedaría ambigua → pasa a ser permiso de plataforma (sección 3).

## 3. Matriz de permisos de plataforma (Paso Cero)

Formato `[app].[modulo].[recurso].[accion]`. Dominio nuevo `plataforma` dentro de `nexo`.

| Código | Etiqueta | Para qué |
|---|---|---|
| `nexo.plataforma.empresas.ver` | Ver empresas | Lista de empresas con cupo, usuarios activos y apps |
| `nexo.plataforma.empresas.crear` | Crear empresas | Alta de empresa + su primer administrador |
| `nexo.plataforma.empresas.editar` | Editar empresas | Nombre, RUC y cupo de usuarios |
| `nexo.plataforma.empresas.desactivar` | Desactivar empresas | Bloquear o reactivar una empresa completa |
| `nexo.plataforma.empresas.entrar` | Entrar a empresas | Entrar a cualquier empresa como su dueño (auditado) |
| `nexo.plataforma.modulos.asignar` | Asignar módulos | Activar o quitar apps a una empresa |
| `nexo.plataforma.administradores.gestionar` | Gestionar super admins | Dar o quitar el acceso de super admin |
| `nexo.plataforma.auditoria.ver` | Ver auditoría de plataforma | Historial de cambios de plataforma |
| `nexo.plataforma.marca.editar` | Editar marca de la plataforma | Logo, fondo y textos del login (hoy `nexo.configuracion.editar`) |

**Cómo se evalúan (diferente de los permisos de empresa):**

- Los permisos de plataforma **no dependen de ninguna empresa**. Se evalúan con una función
  nueva `core.has_platform_permission(user_id, code)`: el código existe, es del dominio
  `plataforma` y el usuario está activo en `core.platform_admins`.
- Primera versión: **un solo rol, "Super administrador", con los 9 códigos.** Los códigos
  quedan separados para poder repartirlos después sin migrar.
- Los códigos `nexo.plataforma.*` **no aparecen** en el editor de roles de las empresas y
  `admin_guardar_rol` los rechaza: una empresa nunca puede otorgarse poder de plataforma.
- El primer super admin es la cuenta `owner` actual (la del usuario), sembrada en la
  migración del esquema. Los siguientes se dan desde el panel.
- `nexo.configuracion.editar` queda retirado al pasar la marca a plataforma (la marca es
  una sola para toda la suite; marca por empresa queda fuera de este alcance).

```sql
-- Paso Cero: solo catálogo. Precheck obligatorio antes de aplicar:
--   select code from core.permissions_catalog where code like 'nexo.plataforma.%';  -- 0 filas
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('nexo.plataforma.empresas.ver',              'nexo', 'plataforma', 'Ver empresas',                   'Ver la lista de empresas con su cupo, usuarios activos y apps.'),
  ('nexo.plataforma.empresas.crear',            'nexo', 'plataforma', 'Crear empresas',                 'Dar de alta una empresa y su primer administrador.'),
  ('nexo.plataforma.empresas.editar',           'nexo', 'plataforma', 'Editar empresas',                'Editar nombre, RUC y cupo de usuarios de una empresa.'),
  ('nexo.plataforma.empresas.desactivar',       'nexo', 'plataforma', 'Desactivar empresas',            'Bloquear o reactivar el acceso de una empresa completa.'),
  ('nexo.plataforma.empresas.entrar',           'nexo', 'plataforma', 'Entrar a empresas',              'Entrar a cualquier empresa con los permisos de su dueño. Queda auditado.'),
  ('nexo.plataforma.modulos.asignar',           'nexo', 'plataforma', 'Asignar módulos',                'Activar o quitar aplicaciones a una empresa.'),
  ('nexo.plataforma.administradores.gestionar', 'nexo', 'plataforma', 'Gestionar super administradores','Dar o quitar el acceso de super administrador.'),
  ('nexo.plataforma.auditoria.ver',             'nexo', 'plataforma', 'Ver auditoría de plataforma',    'Historial de cambios de empresas, módulos y super administradores.'),
  ('nexo.plataforma.marca.editar',              'nexo', 'plataforma', 'Editar marca de la plataforma',  'Editar logo, imagen de fondo y textos del login de toda la suite.');
```

## 4. Modelo de datos (borrador)

```text
core.platform_admins        super admins de la plataforma (fuera de toda empresa)
core.companies              + max_usuarios (null = sin límite)
core.company_memberships    sin cambios de columnas; trigger de cupo
core.audit_log              se reutiliza (company_id null = evento de plataforma)
```

```sql
create table core.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table core.platform_admins enable row level security;  -- sin policies: todo por RPC

alter table core.companies
  add column max_usuarios integer check (max_usuarios is null or max_usuarios > 0);

-- Cupo: trigger BEFORE INSERT / UPDATE OF activo, company_id en company_memberships.
-- Bloquea la fila de la empresa (select ... for update) para que dos altas simultáneas
-- no pasen el límite; cuenta las membresías activas y rechaza si se excede.
-- Bajar el cupo por debajo de los activos se permite (no expulsa a nadie), pero bloquea
-- nuevas altas y reactivaciones hasta volver a estar dentro del cupo.
```

**Cambios a `core.has_permission`** (las apps no cambian, siguen llamando a
`public.has_permission(companyId, code)`):

| Orden | Regla | Cambio |
|---|---|---|
| 1 | Código no registrado o del dominio `plataforma` → **no** | se agrega `plataforma` |
| 2 | **Empresa inactiva → no** | **nuevo** |
| 3 | Módulo no habilitado para la empresa → **no** | igual |
| 4 | **Super admin activo con `empresas.entrar` → sí** (como dueño) | **nuevo** (P3) |
| 5–8 | membresía activa, `user_permissions`, owner, rol | igual |

`core.fn_es_owner` también devuelve `true` para el super admin, así puede administrar
usuarios y roles dentro de la empresa a la que entró. El super admin que entra **no ocupa
cupo** (no tiene membresía).

## 5. Funciones (RPC)

Todas `security definer`, validan con `auth.uid()` y auditan. Reutilizables por Web y Mobile.

| Función | Permiso | Reglas |
|---|---|---|
| `mis_empresas()` | sesión | Empresas activas donde el usuario tiene membresía activa; para el super admin, todas (marcadas "como super admin") |
| `entrar_empresa(company)` | membresía activa o `empresas.entrar` | Valida y audita la entrada en la empresa (siempre para el super admin) |
| `plataforma_listar_empresas()` | `empresas.ver` | Con usuarios activos, cupo y apps habilitadas |
| `plataforma_guardar_empresa(id?, nombre, slug, ruc, max_usuarios)` | `empresas.crear` / `.editar` | Slug único; cupo ≥ 1 o vacío |
| `plataforma_completar_alta_empresa(company, user_id, perfil)` | `empresas.crear` | Crea la membresía `owner` y el perfil del primer administrador |
| `plataforma_cambiar_estado_empresa(company, activo)` | `empresas.desactivar` | Al desactivar, sus usuarios pierden el acceso (regla 2 de `has_permission`); al reactivar lo recuperan con sus roles intactos |
| `plataforma_asignar_modulos(company, slugs[])` | `modulos.asignar` | Solo apps activas en `core.apps`; respeta `core.apps.depends` (ej. Asistencia exige RRHH); `nexo` siempre habilitada |
| `plataforma_listar_admins()` / `plataforma_cambiar_admin(user, activo)` | `administradores.gestionar` | No puede quitarse a sí mismo ni dejar la plataforma sin super admins |
| `plataforma_listar_auditoria(filtros)` | `auditoria.ver` | Eventos de plataforma y entradas de super admin |
| `update_platform_settings(...)` | `marca.editar` | Reescrita: deja de deducir la empresa con `limit 1` |

**Server Action de alta de empresa** (`apps/nexo`, igual que el alta de usuarios de `plan/12`):
valida permiso → `plataforma_guardar_empresa` → si el correo ya existe en Auth se reutiliza
esa cuenta (P1: una persona en varias empresas); si no, `auth.admin.createUser` con
contraseña temporal → `plataforma_completar_alta_empresa`. Si algo falla, se revierte lo creado.

## 6. Empresa activa en el código (el cambio más grande)

Hoy: `getCompanyId()` = `NEXO_COMPANY_ID`. Nuevo:

1. Después del login, `apps/nexo` lleva a **`/empresas`**: tarjetas con las empresas de
   `mis_empresas()`. Si el usuario tiene **una sola** y no es super admin, entra directo.
2. Al elegir, `entrar_empresa` valida y se guarda la cookie `nexo_empresa` (httpOnly,
   `SameSite=Lax`, del dominio público: la leen todas las zonas por Multi-Zones).
3. `@nexo/auth` → `getCompanyId()` lee esa cookie. La cookie **no es confianza**: cualquier
   RPC vuelve a validar con `has_permission`, así que poner a mano el id de otra empresa no da
   acceso a nada.
4. El proxy de cada zona, sin cookie de empresa, manda a `${panel}/empresas?next=…`
   (mismo patrón que el login único).
5. Topbar (`NexoShell`): nombre de la empresa activa + "Cambiar empresa". Si es super admin
   sin membresía, aviso visible "Estás en X como super administrador".
6. Se retira `NEXO_COMPANY_ID` de los proyectos de Vercel (tras desplegar todo junto).
7. Alta de usuarios de cada empresa (`plan/12`): si el correo ya existe en otra empresa, se
   agrega la membresía en vez de fallar.

Pantallas fuera de sesión (kiosco de RRHH, pantalla de TV de Atención) **no cambian**: ya
resuelven su empresa por el dispositivo.

## 7. Pantallas del panel (`apps/nexo`, sección `/plataforma`)

Se diseñan con `ux-planner` → `ui-frontend` → `reviewer`. Menú desplegable según
`DESIGN_SYSTEM.md`:

- **Dashboard** (`/plataforma`): empresas activas, usuarios activos totales, empresas cerca
  del cupo.
- **Empresas**: lista (nombre, estado, usuarios activos / cupo, apps), nueva empresa (datos +
  cupo + apps + primer administrador), ficha con pestañas *Datos*, *Módulos* (casillas por
  app, con dependencias), *Usuarios* (solo lectura) y botón **Entrar**.
- **Super administradores** y **Auditoría**.
- **Configuración → Marca** (se mueve aquí desde `/configuracion/marca`).
- En el Launcher, mosaico **Plataforma** en "Administración", solo para super admins.

## 8. Orden de implementación

1. **Paso Cero** — aplicar la sección 3 (solo catálogo), tras tu aprobación.
2. **Esquema** — sección 4 + `has_permission` + RPC de la sección 5, ensayado en transacción
   revertida, con prechecks y postchecks de solo lectura.
3. **Empresa activa** — sección 6 en `packages/auth` y en el proxy de las 6 zonas, selector
   `/empresas` y topbar. Toca todas las apps: se despliega todo junto.
4. **Pantallas `/plataforma`** — sección 7.
5. **Pruebas** — PGlite (cupo con concurrencia lógica, empresa inactiva, dependencias de apps,
   un código `plataforma` en un rol de empresa rechazado, super admin entra y sale) + recorrido
   con sesión con una empresa `PRUEBA`.
6. **Documentación** — `PERMISSIONS.md`, `DATABASE.md`, `MIGRATION_LOG.md`, `ARCHITECTURE.md`
   (empresa activa), `IMPLEMENTATION_STATUS.md` + status-log.

## 9. Pendiente

- ~~Aprobación explícita del Paso Cero (sección 3)~~ — aprobado y aplicado el 2026-10-23
  (`20261024033541`): 9 códigos, 0 asignaciones.
- **Transitorio hasta la etapa 2:** `admin_catalogo_permisos` muestra los 9 códigos en el editor
  de roles y `admin_guardar_rol` los aceptaría; nada los evalúa todavía.
- Aprobación del modelo (secciones 4–6), en particular quitar `NEXO_COMPANY_ID`.
