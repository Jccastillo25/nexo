# Fix de estabilización RRHH — expedientes, contratos, jornadas y navegación (2026-09-08)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.16 antes de la reestructuración de 2026-09-11.

Bloque pedido explícitamente por el usuario después de Nexo Enterprise UI
([entrada anterior](2026-09-07-nexo-enterprise-ui.md)), **sin iniciar F1.5**: "P0 bugs → P1 rendimiento → P2
UX/UI de Expedientes/Contratos/Jornadas". Sin migraciones — solo código de
`apps/rrhh` y `packages/ui`. Commit `5c1b0441511ae51125afb0b1bcccf77de59dd141`.

## Addendum — verificación real post-push (2026-09-08)

- `get_advisors(security)` sobre `nexo-core`: sin hallazgos nuevos —
  exactamente los mismos WARN/INFO ya documentados en sesiones previas
  (esperado, cero cambios de DB en este bloque).
- Los 3 proyectos Vercel que reconstruyen por el cambio en `packages/ui`
  quedaron `READY` con el commit exacto de este bloque
  (`githubCommitSha: 5c1b0441511ae51125afb0b1bcccf77de59dd141`):
  `nexo-rrhh` (`dpl_FnyeRcZe5x3WGf1JXk6ef88ka4Vi`), `nexocore`
  (`dpl_37X86B4BwMsACXk8PEbo9VnVmYdK`), `nexo-crm`
  (`dpl_DvyyaQAQCpZ7pnzfqKTXf9HDq2d9`).
- `get_runtime_errors` de `nexo-rrhh` (ventana 15 min post-deploy): sin
  errores nuevos — en particular, el error de `FormTabs` en
  `/expedientes/[id].rsc` (P0.1) no volvió a aparecer.
- Navegador real contra `https://nexo.materialesjcastillo.com/rrhh/expedientes`
  sin sesión: redirige correctamente al login del panel (Multi-Zones +
  middleware intactos), cero errores de consola. **No verificado**: el
  flujo autenticado completo (abrir un expediente real, click en
  contrato, editor de jornada) — `rrhh.empleados` sigue en 0 filas reales
  en el proyecto remoto y no hay credenciales de prueba en esta sesión,
  mismo límite ya documentado en F1.3/F1.4/Enterprise UI. La verificación del P0
  se sostiene en la causa raíz confirmada por logs reales (no una
  hipótesis) + la desaparición de esos errores en la ventana post-deploy.

## Lectura y verificación previa (protocolo `CLAUDE.md`/Plan Maestro §21)

Antes de tocar código: `CLAUDE.md`, Plan Maestro, `IMPLEMENTATION_STATUS.md`,
`DESIGN_SYSTEM.md`, `RRHH_MVP.md`, `DATABASE.md`, `PERMISSIONS.md`,
`MIGRATION_LOG.md`, `MODULES.md`, `ROADMAP.md`. Verificado `main` local
== `origin/main` (`c1d2399`, sin divergencia — `git fetch` limpio),
working tree limpio salvo `Grupo CT/` (ajena). Vercel `nexo-rrhh`
(`prj_6nP4PUDQZH5iq6Cp2t7ytxzrqerM`) consultado con `get_runtime_errors`
**antes** de escribir ningún fix — root cause real, no hipótesis (ver
abajo).

## P0.1/P0.2 — causa raíz real de `/expedientes/[id]` (500) y del click desde Contratos

`get_runtime_errors` (ventana 7 días) mostró, en el deployment de
producción vigente (`dpl_44Nc4ApmHJk7NV2Q5qvicjdbcitM`, commit `c1d2399`,
el HEAD real):

```text
Error: Functions cannot be passed directly to Client Components unless
you explicitly expose it by marking it with "use server". Or maybe you
meant to call this function rather than return it.
  {tabs: ..., children: function children}
count=8 users=2 routes=/expedientes/[id].rsc
first=2026-09-08T00:18:35.000Z last=2026-09-08T17:23:25.000Z
```

**Causa raíz confirmada**: `packages/ui/FormTabs.tsx` (`"use client"`)
recibía `children: (activeKey: string) => React.ReactNode` — una función —
desde `apps/rrhh/.../expedientes/[id]/page.tsx`, un Server Component. Next
rechaza en runtime pasar una función como prop de Server a Client
Component (no es serializable, a diferencia de JSX). Esto tumbaba **toda**
la página, siempre, para cualquier usuario — coincide exactamente con el
síntoma reportado ("This page couldn't load / A server error occurred").
El click en un empleado desde `/contratacion/contratos` no tenía una
causa distinta: solo navega a `/expedientes/[id]` (confirmado leyendo
`contratacion/contratos/page.tsx`), así que comparte la misma causa raíz
— **no era un bug separado**.

**Corrección**: `FormTabs` cambia su contrato — cada `FormTab` ahora lleva
`content: React.ReactNode` (ya resuelto como JSX por el padre, antes de
cruzar la frontera), no una función. `expedientes/[id]/page.tsx` adaptado.
Único otro consumidor de `FormTabs` en el monorepo (grep confirmado): esa
misma página.

**Aislamiento de errores** (pedido explícito, no solo el fix del bug): el
Expediente Laboral (contratos/compensación/credencial/jornada) de
`/expedientes/[id]` ahora se resuelve dentro de un `try/catch` — si falla,
se muestra un error contenido en esa sección (con el mensaje real, sin
ocultarlo) en vez de tumbar Perfil/Datos generales, que ya se resolvieron
arriba.

## P1 — rendimiento de navegación

**Diagnóstico** (medido por conteo estructural de round-trips —
sin credenciales de prueba para medir tiempos reales en un navegador
autenticado, mismo límite ya documentado en F1.3/F1.4/Enterprise UI):

- `/expedientes/[id]` hacía **hasta 7 round-trips secuenciales** a
  Postgres: 11 chequeos de permiso (ya en paralelo) → empleado → contratos
  → salarios → credencial (vía una Server Action que repetía su propio
  chequeo de permiso, un round-trip extra innecesario) → jornadas del
  catálogo → jornada vigente. Optimizado a: permisos + empleado en
  paralelo (independientes) → dentro de la sección de contratos, salarios
  + jornadas + jornada vigente + credencial (RPC directa, sin el
  round-trip duplicado) en paralelo.
- `(app)/layout.tsx` (se ejecuta en **cada** navegación dentro de RRHH,
  Server Component dinámico por las cookies de sesión — no cacheable)
  esperaba el permiso de módulo antes de pedir usuario/panelUrl/logo,
  round-trip innecesario en cada click del sidebar. Las 4 llamadas ahora
  van en paralelo.
- Confirmado (lectura de código, no opinión): `NexoSidebar`/`NexoShell` ya
  usaban `next/link` en todos los ítems (sin `<a>` planos salvo
  `BackToPanelLink`, que cruza de zona a propósito) — no hay full reload
  forzado por el shell. Multi-Zones no interviene en absoluto navegando
  dentro de `/rrhh/*` (todas esas rutas viven en el mismo proceso Next de
  `apps/rrhh`; el rewrite de Multi-Zones solo aplica al cruzar desde
  `apps/nexo`).
- `loading.tsx` agregado a `expedientes`, `expedientes/[id]`,
  `contratacion/contratos`, `contratacion/contratos/[id]`, `jornadas`,
  `feriados`, `dashboard` — Suspense boundary de Next.js para feedback
  inmediato al navegar. **No** reemplaza las optimizaciones de arriba —
  es la mejora de percepción que pide el bloque, no un parche para
  esconder latencia real.

**Deuda documentada, no resuelta en este bloque** (fuera de alcance de
"solo navegación/UX", requeriría una función SQL nueva): cada
`hasPermission(...)` es su propio round-trip RPC — un `has_permission`
batch (un solo RPC que reciba varios códigos y devuelva un mapa) reduciría
los 11 round-trips de permisos de `/expedientes/[id]` a 1, pero es una
migración de rendimiento con su propio diseño, no un cambio de
navegación/UI. Tampoco se investigó (ni se intentó forzar) Partial
Prerendering de Next.js — cambio de versión/arquitectura fuera de alcance.

## P2 — Expedientes

- Columna **Acciones** con iconos SIEMPRE visibles (👁 Visualizar / ✎
  Editar / 🗑 Eliminar) reemplaza el menú "⋯" — componente nuevo
  compartido `packages/ui/RowActionIcons.tsx` (tooltip vía `title`,
  `aria-label`, estado hover, foco accesible vía
  `focus-visible:outline`).
- Columna **Estado** (ya existía, visible, no oculta) ahora distingue
  Activo/Contrato en borrador/Finalizado/Sin contrato (antes solo
  binario activo/no-activo).
- **Visualizar** → `/expedientes/[id]` (ya funcionaba una vez corregido
  P0.1).
- **Editar**: navega al mismo `/expedientes/[id]` — **hallazgo, no
  decisión de diseño**: no existe ningún RPC/formulario de edición del
  Expediente General (F1.1 solo construyó el alta). Construir edición real
  necesita su propia decisión de campos + RPC, fuera de alcance de este
  bloque (solo navegación/visualización) — documentado como deuda en
  `RRHH_MVP.md` §16, no inventado.
- **Eliminar**: el backend (`rrhh.fn_eliminar_empleado`,
  `20260907224007`/`20260907224240`, ver [Nexo Enterprise UI](2026-09-07-nexo-enterprise-ui.md))
  ya rechazaba correctamente cualquier empleado con ≥1 contrato (cualquier
  estado) — verificado leyendo la función real en remoto antes de tocar nada, sin
  cambios de DB en este bloque. Se agregó la señal preventiva en la UI:
  el listado ahora trae qué empleados tienen algún contrato (no solo
  activo) y la papelera se deshabilita con tooltip explicando por qué,
  en vez de depender solo del mensaje de error después del click.

## P2 — Contratación → Contratos

- Columna **Acciones**: 👁 Ver contrato (siempre, si hay permiso de ver) /
  ✎ Editar (deshabilitado con tooltip fuera de `borrador`, o sin permiso
  `contratos.editar`).
- **Nueva ruta mínima** `/rrhh/contratacion/contratos/[id]` (ficha de un
  contrato): separa explícitamente "ver/editar un contrato puntual" de
  "ir al expediente del empleado" (click en el nombre, sin cambios).
  Reutiliza las mismas Server Actions/RPC que ya existían
  (`editarContrato`/`asignarJornada` de `expedientes/[id]/actions.ts`,
  importadas — no duplicadas) — permite editar los datos base de un
  contrato en borrador y asignar su jornada. El ciclo de vida completo
  (crear/activar/finalizar/regenerar PIN) sigue viviendo únicamente en el
  expediente del empleado (`contratos-panel.tsx`), **sin cambios** — no se
  tocó ninguna regla de negocio de contratos.
- Cada mutación de contrato ahora revalida también las rutas de
  Contratación (antes solo revalidaba `/expedientes/[empleadoId]`), para
  que la ficha/listado nuevos no queden con datos obsoletos tras editar
  desde el expediente.

## P2 — Jornadas

- Botón **Cancelar** explícito junto a "Guardar días" dentro del editor —
  reutiliza el mismo flujo de descarte-y-cierre que ya existía en el
  toggle "Ocultar días" (si hay cambios sin guardar, abre el mismo
  `ConfirmDialog` ya construido en Enterprise UI; si no hay cambios,
  cierra directo sin mutación).
- El flujo idle→loading→success/error de "Guardar días" y el
  `ConfirmDialog` de cambios sin guardar **ya existían** desde Enterprise
  UI (ver entrada anterior) — verificado por lectura de código, no se tocó su
  lógica, solo se agregó el botón visible.
- Texto de `/jornadas` corregido (ya no dice "se hace desde el expediente
  del empleado" — dejó de ser exacto una vez que la ficha de contrato
  también permite asignar jornada).

## Sidebar

- Estado activo por URL: ya funcionaba correctamente en mount/refresh/deep
  link (`isNavItemActive`/`isLeafActive` se recalculan en cada render a
  partir de `pathname`, sin depender de estado). **Bug real encontrado**:
  el acordeón (`expanded`, qué grupo se ve desplegado) solo se calculaba
  una vez al montar `NexoSidebar` — como el shell correctamente NO se
  remonta entre navegaciones dentro del módulo (bueno para rendimiento),
  navegar a una hoja de un grupo distinto sin pasar por el toggle del
  sidebar (ej. Contratos → click en un empleado, o un breadcrumb) dejaba
  el ítem activo resaltado pero el acordeón que lo contiene colapsado —
  escondido. Corregido con un `useEffect` que sincroniza el grupo activo
  en cada cambio de `pathname`, sin tocar los grupos que el usuario ya
  abrió/cerró a mano.
- "Sidebar solo navega dentro de RRHH" + "Volver a Nexo" siempre
  visible: ya cumplía (`RRHH_NAV_ITEMS` no tiene ningún ítem fuera de
  RRHH; `BackToPanelLink` vive fuera del área con scroll del `<nav>`,
  pegado al fondo del `<aside>` de altura fija) — verificado por lectura
  de código, sin cambios.

## Topbar — logo dinámico

`NexoTopbar`/`NexoShell` (`packages/ui`) reciben un `logoUrl` opcional
(`core.platform_settings.logo_url`) — sin configurar, cae al wordmark
"Nexo" por defecto. `apps/rrhh` lo resuelve con un `lib/platform-settings.ts`
nuevo (mismo patrón duplicado a propósito que `getCopyrightText` de
`apps/crm` — cada zona de Multi-Zones es independiente). `apps/nexo`/
`apps/crm` no se tocaron (fuera del alcance "solo RRHH" de este bloque);
el prop queda disponible para que lo adopten después sin trabajo extra.

## Verificación técnica

- **Local**: mismo bloqueo de entorno ya documentado (Windows/OneDrive) —
  esta vez ni siquiera hay `node_modules/` materializado (`npx tsc`
  resuelve un paquete `tsc` de npm ajeno al monorepo, no el TypeScript
  real del proyecto). Sin cambios de dependencias en este bloque (no hace
  falta `pnpm install`/tocar el lockfile).
- **Remoto**: sin migraciones — no aplica `get_advisors`/`list_migrations`
  para este bloque (regla `DATABASE.md`/`MIGRATION_LOG.md` "solo si hubo
  cambios reales de DB").
- **Vercel**: verificado post-push — ver el addendum de esta misma
  entrada, más arriba.
- **Permisos**: cero permisos nuevos — todo el bloque reutiliza códigos ya
  existentes en `core.permissions_catalog` (`rrhh.expedientes.contratos.*`,
  `.credenciales.*`, `.empleados.*`, `rrhh.asistencia.turnos.ver`). Sin
  Paso Cero nuevo, porque no hace falta.

## Deuda/pendiente explícito de este bloque

1. No existe edición real del Expediente General (solo alta) — el ícono
   "Editar" de Expedientes hoy lleva a la misma vista de solo lectura.
2. `/rrhh/dashboard` mostró 3 veces en 4 días (`get_runtime_errors`,
   última 2026-09-08T16:51 UTC) un error con `.message` vacío —
   intermitente, no reproducible a demanda, sin causa raíz establecida con
   la evidencia disponible. Se mejoró la observabilidad (ya no se pierde
   el detalle si el error viene sin mensaje) para diagnosticarlo la
   próxima vez.
3. Un RPC batch de permisos (reducir 11 round-trips a 1 en
   `/expedientes/[id]`) queda como candidato de rendimiento aparte — no
   se construyó en este bloque (requiere una función SQL nueva, fuera de
   "solo navegación/UX").
4. No verificado en navegador autenticado real (sin credenciales de
   prueba en esta sesión, mismo límite que F1.3/F1.4/Enterprise UI) — verificación
   sustituida por: causa raíz confirmada con logs reales de producción,
   lectura exhaustiva del código afectado, y build/runtime errors de
   Vercel post-push.
