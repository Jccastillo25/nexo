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
