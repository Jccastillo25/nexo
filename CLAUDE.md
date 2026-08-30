# Nexo — instrucciones para Claude Code

Monorepo de la suite Nexo (panel único estilo Odoo para Grupo CT /
Materiales J Castillo). Contexto completo en [`docs/`](docs/README.md),
plan original en [`docs/planning/`](docs/planning/).

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

## Regla obligatoria: todo módulo aterriza en su Dashboard de KPIs

**La raíz de cada módulo (`/`, bajo su propio `basePath`) redirige
siempre a un `/dashboard` propio, con las métricas principales de esa
área — nunca a una lista de contenido ni a una página en blanco.** No
alcanza con "no dejarlo en blanco": tiene que ser una vista de KPIs (2-3
tarjetas con datos reales del módulo como mínimo). Ver
[`apps/crm/src/app/(app)/dashboard/page.tsx`](apps/crm/src/app/(app)/dashboard/page.tsx)
como referencia y el checklist completo en
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

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
