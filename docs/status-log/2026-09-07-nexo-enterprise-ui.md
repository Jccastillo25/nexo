# Nexo Enterprise UI — rediseño visual transversal (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.15 antes de la reestructuración de 2026-09-11.

Rediseño aprobado explícitamente por el usuario (con 10 ajustes
obligatorios sobre la propuesta inicial) — sidebar azul persistente,
topbar con breadcrumb automático, tema claro por defecto (**reversión
explícita** de la regla "dark mode por defecto" de 2026-09-02, ver
`docs/DESIGN_SYSTEM.md` y `CLAUDE.md` actualizados). Alcance: `packages/ui`
+ `apps/nexo` + `apps/rrhh` + `apps/crm`. Deliberadamente **no** tocó
lógica de contratos/PIN/jornadas/asistencia/planillas (ajuste obligatorio
#9) — solo UI/navegación + la migración mínima de Marca.

## Kit compartido (`packages/ui`)

Nuevos: `NexoShell`, `NexoSidebar`, `NexoTopbar`, `nexo-nav.ts`
(breadcrumb automático + estado activo, dado el árbol de navegación de
cada app), `nexo-icons.tsx`, `Breadcrumb`, `PageHeader`, `DashboardHero`,
`MetricCard`, `ActivityFeed`, `QuickActions`, `DataTable` +
`RowActionsMenu`, `FilterBar`, `StatusBadge`, `FormTabs`, `FormSection`,
`EmptyState`, `ConfirmDialog`, `Toast`/`useToast`. Retirados (verificado
por grep de `"@nexo/ui"` en todo el monorepo, incluida `apps/flotilla`,
antes de borrar — cero consumidores fuera de las 3 apps migradas en este
mismo commit): `AppShell`, `ShellBar`, `Sidebar`, `StatCard`.

**Hallazgo corregido durante la implementación**: `Toast`/`useToast` NO
son un sistema nuevo desde cero — `sonner` ya era una dependencia real y
en uso en `apps/crm` (`ClienteForm.tsx`, `DeleteClienteButton.tsx`) y
`apps/rrhh` tenía su propio `<Toaster>` en el layout raíz. Construir un
context/estado propio hubiera duplicado un sistema que ya funcionaba
(regla "no dupliques") — `packages/ui/Toast.tsx` envuelve `sonner`
(único archivo de la suite que lo importa directo); los `<Toaster>`
sueltos de los layouts raíz de RRHH/CRM se retiraron a favor del que
monta `NexoShell`. `sonner` se agregó como dependencia real de
`packages/ui` y de `apps/nexo` (no la tenía).

## `apps/nexo`

- Nuevo route group `(app)` con `layout.tsx` (monta `NexoShell`,
  `NEXO_NAV_ITEMS`: Dashboard/RRHH/CRM/Transporte/Fabricación/
  Configuración — Transporte/Fabricación sin `href`, Multi-Zones no las
  sirve todavía).
- `/` (ahora `(app)/page.tsx`) es el dashboard "Torre de Control":
  bienvenida, KPI real de módulos habilitados (`get_visible_apps`),
  "Empleados"/"Clientes" con `tone="pending"` (regla "cero datos mock" —
  agregar esas RPC cruzadas queda documentado como pendiente en
  `RRHH_MVP.md` §15, no se construyó), grid de módulos existente
  reubicado como sección "Módulos", `ActivityFeed` vacío explícito.
- `Configuración → Marca` (`(app)/configuracion/marca`): reutiliza la
  lógica de subida de `platform-assets` de siempre (Server Action movida,
  no reescrita) + campo de favicon nuevo. `/ajustes` queda como
  `redirect()` por compatibilidad.
- Favicon dinámico: `generateMetadata()` en el layout raíz lee
  `core.platform_settings.favicon_url` — sin archivo configurado, cae al
  favicon por defecto de Next.

## `apps/rrhh`

- `(app)/layout.tsx` reconstruido sobre `NexoShell` con el árbol completo
  de 4 niveles pedido (`lib/nav.ts`) — hojas sin pantalla real
  (Documentos, Marcas, Incidencias, Justificaciones, Puestos,
  Departamentos, Catálogos) se muestran deshabilitadas/"Próximamente" en
  vez de crear una página placeholder por cada una (ajuste obligatorio
  #1); `planillas/page.tsx` (placeholder histórico de F1.4) se conservó
  tal cual, solo restyle de color.
- `/feriados` nueva ruta (separada de `/jornadas`, mismo componente
  `feriados-panel.tsx` reutilizado, cero cambios de lógica/DB) y
  `/contratacion/contratos` nueva (listado global de solo lectura de
  `rrhh.contratos`, mismo permiso `contratos.ver` ya existente).
- `/expedientes`: `DataTable` + `StatusBadge` + menú "⋯" (`EmpleadoRowMenu`,
  Client Component dedicado — ver nota de arquitectura abajo). **Eliminar
  empleado agregado** (hueco de UI de §1.8; permiso + política RLS
  `DELETE` ya existían desde F1.1): nuevo RPC
  `rrhh.fn_eliminar_empleado`/`public.eliminar_empleado`
  (`20260907224007`, corregido en `20260907224240` — ver advisors abajo)
  que valida **explícitamente** contra `rrhh.contratos` (cualquier
  estado) antes de eliminar — no depende de la violación de la FK como
  mecanismo (ajuste obligatorio #3).
- `/expedientes/[id]`: `FormTabs` — "Datos personales" con los campos
  reales de hoy; Dirección/Información complementaria/Cuentas
  bancarias/Beneficiario/Documentos deshabilitadas con `EmptyState`
  explicando que requieren un modelo de datos nuevo (ver `RRHH_MVP.md`
  §15) — **perfil ampliado 100% fuera de este commit** (ajuste #6).
  `ContratosPanel` se mantiene como sección aparte (no una pestaña más) —
  perfil y contrato siguen siendo procesos separados.
- Feedback idle→loading→success/error (`useToast`) en: crear empleado,
  eliminar empleado, guardar jornada, crear/eliminar feriado,
  configuración de marca. `/jornadas`: al cerrar el editor de días con
  cambios sin guardar, `ConfirmDialog` ("Descartar cambios"/"Seguir
  editando") — si el guardado falla, el editor NO se cierra y los datos
  ingresados se conservan (§1.11).

## `apps/crm`

`AppSidebar.tsx`/`Header.tsx` locales retirados (duplicaban `NexoShell`);
`(app)/layout.tsx` reconstruido sobre `NexoShell`; dashboard migrado de su
`StatCard` local a `MetricCard` compartido (era el último de los 3 que
quedaban sin unificar, ver `DESIGN_SYSTEM.md`). Sin cambios a
datos/lógica de clientes.

## Nota de arquitectura — por qué `DataTable` no tiene una prop `rowActions`

Se descartó ese diseño durante la implementación: un menú "⋯" con
`onClick` closures (confirmar, mostrar un toast, llamar una server
action) no puede pasarse como función desde un Server Component (la
página) a través de una prop genérica de `DataTable` — React no permite
pasar funciones de Server a Client Component. La solución correcta (y la
usada acá) es que cada página defina su propia columna "acciones" cuyo
`render` monta un pequeño Client Component dedicado con props
serializables (ids/booleans), que internamente usa `RowActionsMenu`. Ver
`apps/rrhh/.../expedientes/empleado-row-menu.tsx`.

## Migraciones (aplicadas y verificadas con RPC real, no solo esquema)

- `20260907223910_nexo_enterprise_ui_favicon`: `favicon_url` en
  `core.platform_settings` (aditiva); `get_platform_settings`/
  `update_platform_settings` recreadas (DROP + CREATE — `RETURNS TABLE`
  cambia el tipo fila compuesto, `create or replace` no alcanza). Probado
  con sesión `authenticated` real: `update_platform_settings(p_favicon_url
  => ...)` → `get_platform_settings()` devuelve el valor esperado.
- `20260907224007_nexo_enterprise_ui_eliminar_empleado` +
  `20260907224240_fix_eliminar_empleado_anon_grant`: `eliminar_empleado`.
  **Verificado con RPC real** (sesión `authenticated`, empleados de
  prueba, 0 filas residuales al final): (a) empleado sin contratos → se
  elimina; (b) empleado con un contrato `borrador` → rechazado con
  mensaje de dominio explícito ("tiene 1 contrato(s) registrado(s)...");
  (c) usuario sin el permiso → rechazado ("Permiso denegado:
  rrhh.expedientes.empleados.eliminar"). `get_advisors(security)`:
  detectó que `public.eliminar_empleado` quedaba ejecutable por `anon`
  (default privileges de Postgres en el schema `public`, mismo patrón ya
  documentado para `crear_empleado`/`crear_contrato`) — corregido en la
  migración de fix, reverificado con `has_function_privilege` (`anon` →
  `false`, `authenticated` → `true`).

## Verificación técnica

`pnpm install` local bloqueado por el mismo tipo de `EPERM` de entorno ya
documentado (Windows/OneDrive) — esta vez no en `tsc` sino en los
binarios nativos de `turbo` al materializar `node_modules`
(`ERR_PNPM_EPERM` sobre `turbo`, luego sobre `@turbo/windows-64`,
reproducido en 3 intentos distintos, incluso tras matar el proceso
`pnpm install` huérfano que sostenía el lock). Resuelto sin recurrir a la
contingencia de Vercel: `pnpm install --no-frozen-lockfile
--lockfile-only` regenera `pnpm-lock.yaml` sin materializar
`node_modules` (evita por completo la escritura de binarios nativos) —
terminó limpio, `pnpm-lock.yaml` incluye `sonner` en las 4 ubicaciones
correctas (`apps/rrhh`, `apps/crm` ya lo tenían; `apps/nexo` y
`packages/ui` se agregaron). `next build`/`tsc` reales: build de Vercel
post-push — no ejecutados localmente, mismo motivo documentado en
F1.3/F1.4.

**Addendum post-push (commit `1890a37`)**: los 3 proyectos reconstruyeron
y quedaron `READY` — `nexocore` (`dpl_5ECpViH6d4XfX8zVUEDzxocaBsPa`),
`nexo-rrhh` (`dpl_CdKRZc3tVKrwya8yR1ZycAsFNbkA`), `nexo-crm`
(`dpl_Ffw8DHFXpFdgPFVTcbaospWRjMEE`), los tres con
`githubCommitSha: 1890a371de3038fe3ef9c9bc4c494906eb048613` exacto.
`get_runtime_errors` (ventana 1h post-deploy) de los 3: sin errores
nuevos. Confirma que el fix de `pnpm-lock.yaml` (`--lockfile-only`)
resolvió el `frozen-lockfile` install de Vercel — si no lo hubiera
resuelto, los 3 builds habrían fallado con `ERR_PNPM_OUTDATED_LOCKFILE`
igual que localmente.

**Verificación en navegador real (más allá de compilar/desplegar,
primera vez que esto se hace en esta serie de sesiones)**: se navegó a
`https://nexo.materialesjcastillo.com/login` (dominio de producción real,
no el alias `*.vercel.app` — ese quedó detrás de Vercel Deployment
Protection y redirige al login de Vercel, no de Nexo) — login renderiza
correctamente (logo, bullets, formulario), cero errores de consola,
confirma que `get_platform_settings()` respondió con datos reales. Se
navegó también a `/rrhh/dashboard` sin sesión — el proxy/middleware de
RRHH + el rewrite de Multi-Zones redirigieron correctamente al login del
panel, 28 requests estáticos, todos `200`. **No verificado**: el shell
autenticado (`NexoShell`/sidebar/topbar) en un navegador real — no hay
credenciales de prueba disponibles en esta sesión (mismo límite ya
documentado en F1.3/F1.4, diferido a F1.9); prohibido además intentar
loguearse con credenciales reales sin que el usuario lo pida.
