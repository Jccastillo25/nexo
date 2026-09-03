# Nexo — instrucciones para Claude Code

Monorepo de la suite Nexo (panel único estilo Odoo para Grupo CT /
Materiales J Castillo). Contexto completo en [`docs/`](docs/README.md),
plan original en [`docs/planning/`](docs/planning/).

## REGLA CRÍTICA: monorepo, pnpm y despliegues en Vercel

1. **Aislamiento de proyectos (1 app = 1 proyecto).** Este repositorio es
   un monorepo. Cada directorio dentro de `apps/` (ej. `apps/crm`,
   `apps/rrhh`) es una aplicación independiente. Al crear un módulo nuevo,
   **hace falta crear un proyecto nuevo y dedicado en Vercel**,
   estableciendo su *Root Directory* hacia esa subcarpeta específica.
   Nunca asumas que una app nueva se despliega bajo un proyecto unificado
   existente — verificá primero qué proyectos de Vercel existen
   realmente (vía el MCP de Vercel o pidiéndole al usuario que confirme)
   en vez de asumirlo a partir de la documentación local.
2. **Sincronización estricta del lockfile (evitar caídas de CI/CD).** Al
   crear una app nueva o modificar las dependencias del workspace (ej.
   integrar `@nexo/ui` o `@nexo/permissions`), el `package.json` cambia.
   Vercel usa instalación estricta (`frozen-lockfile`) y falla en
   segundos con `ERR_PNPM_OUTDATED_LOCKFILE` si `pnpm-lock.yaml` en la
   raíz no coincide.
3. **Paso obligatorio antes del push.** Antes de ejecutar o pedir un push
   a la rama principal que involucre dependencias nuevas o modificadas,
   hay que actualizar el lockfile localmente (`pnpm install`) e incluirlo
   en el mismo commit. Si no hay Node/pnpm disponible en el entorno para
   correrlo, decirlo explícitamente y ofrecer como contingencia configurar
   el *Install Command* del proyecto en Vercel como
   `npx pnpm install --no-frozen-lockfile`.

## Regla obligatoria: permisos (norma v3.0)

**Esta regla aplica siempre que se crea o modifica una server action, route
handler, botón, checkbox, toggle, o cualquier acción del usuario en
cualquier `apps/<módulo>`. No es opcional y no depende de que el usuario lo
pida explícitamente en el prompt — se cumple siempre.**

Antes de dar por terminada una función nueva que hace algo (no solo lee),
verificá:

1. ¿Tiene un código de permiso `<modulo>.<dominio>.<recurso>.<verbo>`
   definido?
2. ¿Ese código está insertado en `core.permissions_catalog` vía una
   migración en `supabase/migrations/`?
3. ¿La función llama a `requirePermission(ctx, codigo)` de
   `@nexo/permissions` **antes** de ejecutar su lógica?
4. ¿La UI oculta/deshabilita el control correspondiente cuando
   `hasPermission(...)` es `false`?

Si falta el paso 2, la función queda denegada para todo el mundo por
diseño (fail-closed) — ver [`packages/permissions/index.ts`](packages/permissions/index.ts).
Guía completa, ejemplos y la tabla de dominios por módulo:
[`docs/PERMISSIONS.md`](docs/PERMISSIONS.md).

Al registrar un **módulo nuevo** en `core.apps` no hace falta hacer nada
extra para el permiso de visibilidad — un trigger de Postgres
(`trg_seed_module_permission`) lo crea solo. Eso es lo único automático a
nivel de base de datos; todo lo demás (permisos de funciones dentro del
módulo) sigue el checklist de arriba.

## Regla obligatoria: login único (SSO), ningún módulo tiene su propio

**Ningún `apps/<módulo>` implementa su propio formulario de login.** El
login vive solo en `apps/nexo` (el panel). Al crear o adaptar un módulo:

1. El middleware/proxy del módulo, sin sesión válida, redirige a
   `${NEXO_PANEL_URL:-origin}/login?next=<ruta-con-basePath>` — nunca a un
   `/login` propio del módulo. Ver
   [`apps/crm/src/lib/supabase/middleware.ts`](apps/crm/src/lib/supabase/middleware.ts)
   como referencia.
2. `NEXO_PANEL_URL` es un override opcional (dev local con puertos
   distintos, o acceso directo al deployment `*.vercel.app` del módulo sin
   pasar por el rewrite) — en producción no hace falta configurarlo porque
   Multi-Zones sirve todo bajo el mismo dominio público.
3. Esto funciona sin nada especial porque las cookies de sesión de
   Supabase son del dominio público compartido, no de cada deploy — un
   solo login vale para toda la suite.

## Regla obligatoria: `ShellBar` es la barra superior, ningún módulo la reemplaza

**Ningún `apps/<módulo>` construye su propio header de navegación.**
`ShellBar` de `@nexo/ui` es la barra superior persistente de toda la
suite — se usa tal cual, con `backHref` resuelto por un helper
`getPanelUrl()` propio del módulo (mismo patrón que la regla de SSO de
arriba). La identidad visual del módulo va en el contenido, debajo de la
barra, nunca reemplazándola. Guía completa, ejemplo del bug real que esto
corrigió, y checklist: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: navegación interna con `next/link`, nunca `<a>` plano

**Todo link que se queda dentro del mismo módulo usa `next/link`, nunca
un `<a href>` nativo** — el `basePath` (`/crm`, `/rrhh`, `/flotilla`) se
aplica solo a `next/link`/`router.push`, no a un `<a>` nativo. Un
`<a href="/clientes">` navega a `dominio.com/clientes` (404 real en
producción) en vez de `dominio.com/crm/clientes`. Bug real que esto
corrigió: [`packages/ui/Sidebar.tsx`](packages/ui/Sidebar.tsx) usaba `<a>`
en sus ítems. Única excepción a propósito:
[`BackToPanelLink`](packages/ui/BackToPanelLink.tsx), que cruza de zona en
Multi-Zones y por eso sí necesita un `<a>` plano. Detalle completo:
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: todo módulo aterriza en su Dashboard de KPIs

**La raíz de cada módulo (`/`, bajo su propio `basePath`) redirige
siempre a un `/dashboard` propio, con las métricas principales de esa
área — nunca a una lista de contenido ni a una página en blanco.** No
alcanza con "no dejarlo en blanco": tiene que ser una vista de KPIs (2-3
tarjetas con datos reales del módulo como mínimo). Ver
[`apps/crm/src/app/(app)/dashboard/page.tsx`](apps/crm/src/app/(app)/dashboard/page.tsx)
como referencia y el checklist completo en
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Regla obligatoria: Paso Cero — matriz de permisos antes que tablas o UI

**Prohibido generar código de frontend o crear tablas de datos para una
app/módulo nuevo (o una función nueva dentro de uno existente) sin antes
haber diseñado, presentado como Markdown + SQL, y hecho aprobar
explícitamente por el usuario su Matriz de Permisos y Roles** —
`[app].[modulo].[recurso].[accion]`, 4 segmentos estrictos, sin
excepción para código nuevo — **e insertado esa matriz en el catálogo**
(`core.permissions_catalog` + `core.app_roles` + `core.app_role_permissions`)
antes de que exista una tabla de datos del módulo. Precedente: la matriz
de RRHH (2026-09-02). Detalle:
[`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) y
[`docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §6`](docs/planning/ARQUITECTURA_MVP_ESCALABLE.md#6-playbook-para-agregar-una-nueva-app).

**Verificación Remota Obligatoria**: antes de escribir un `insert` hacia
`core.permissions_catalog`/`core.app_roles`, consultar el estado real del
proyecto remoto (`core.apps`, `core.permissions_catalog`, `core.app_roles`
filtrados por `module_slug`, vía el MCP de Supabase) — nunca asumir el
estado a partir de la documentación local, que puede estar desactualizada.

## Regla obligatoria: dark mode por defecto + glassmorphism (reemplaza "negro solo en login")

**Desde 2026-09-02, toda la suite usa tema oscuro por defecto** (no solo
el login) **con paneles `glassmorphism`** (`.nexo-glass`: fondo
semitransparente + `backdrop-filter: blur` + borde de 1px sutil) **y
dashboards compactos de alta densidad**. `darkMode: "class"` fijo, nunca
`prefers-color-scheme`. Tokens CSS y config de Tailwind:
[`docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §4`](docs/planning/ARQUITECTURA_MVP_ESCALABLE.md#4-estándares-de-uiux-y-frontend).
`ShellBar`/`Sidebar`/CRM siguen en paleta clara (deuda técnica reconocida,
no se reescriben solos por esto) — un módulo o página **nueva** usa los
tokens dark/glass desde el día uno, no copia la paleta clara vieja.

## Regla obligatoria: toda tabla de hechos nace particionada

**Al crear una tabla nueva que registra un evento de negocio que se sigue
insertando sin límite (transacciones, históricos, marcas, logs,
auditoría), la migración la crea particionada por `RANGE` mensual desde
el primer `create table`** — nunca se agrega el particionamiento después.
Catálogos/dimensiones (clientes, empleados, `permissions_catalog`) no se
particionan. Plantilla SQL, índices obligatorios (B-Tree en toda FK,
`(company_id, fecha)` compuesto, GIN en JSONB) y el mecanismo de
particiones futuras vía `pg_cron`:
[`docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §2`](docs/planning/ARQUITECTURA_MVP_ESCALABLE.md#2-estrategia-de-escalabilidad-extrema).

## Regla obligatoria: Vercel Speed Insights + Analytics

**Toda app en `apps/*` que se despliegue en Vercel debe incluir
`@vercel/speed-insights` y `@vercel/analytics`** (pedido explícito del
usuario — "recuerda siempre agregar esto"). Al crear o adaptar un módulo
nuevo:

```tsx
// layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
// ...
<body>
  {children}
  <SpeedInsights />
  <Analytics />
</body>
```

Ya está en `apps/nexo`, `apps/crm` y `apps/web-corporativo`. Falta agregarlo
a `apps/rrhh` y `apps/flotilla` cuando se adapten en sus fases.

## Arquitectura (resumen — detalle en `docs/ARCHITECTURE.md`)

- Monorepo Turborepo + pnpm. Un módulo = una app en `apps/*`, desplegable
  de forma independiente.
- Un solo dominio para toda la app (`nexo.materialesjcastillo.com`), los
  módulos son **rutas** (`/rrhh`, `/flotilla`, `/crm`), no subdominios —
  mecanismo: [Next.js Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones).
  El sitio público (`materialesjcastillo.com`) es un dominio aparte.
- Un solo proyecto Supabase, `nexo-core` (ref `yrbjlmiqhkyxtlcerowh`,
  `us-east-1`), con un schema Postgres por módulo (`rrhh`, `flotilla`,
  `crm`) más el schema `core` (compañías, catálogo de apps, permisos).
- Cada `apps/<módulo>` importado desde su repo original vía `git subtree`
  (historial preservado) — hoy sigue apuntando a su Supabase original hasta
  que se adapte en su fase correspondiente (ver `docs/ROADMAP.md`).

## Estado actual

Ver [`docs/MODULES.md`](docs/MODULES.md) y [`docs/ROADMAP.md`](docs/ROADMAP.md)
para qué fase está en curso. No asumas que un módulo ya está adaptado a
Multi-Zones o a `nexo-core` solo porque su código ya vive en `apps/`.
