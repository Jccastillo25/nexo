# Arquitectura de Nexo

Estado: vigente desde 2026-08-29. Ver la discusión completa y las
alternativas descartadas en
[planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md).

## Resumen

- **Monorepo**: Turborepo + pnpm workspaces. Una app por módulo en `apps/*`,
  paquetes compartidos en `packages/*`.
- **Un solo dominio de app**, como Odoo: `nexo.materialesjcastillo.com`.
  Nada de subdominio por módulo — cada módulo es una **ruta**
  (`/rrhh`, `/flotilla`, `/crm`, ...).
- **Mecanismo**: [Next.js Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones).
  La app `nexo` es la zona raíz: define un `rewrite` por módulo hacia el
  deploy real de ese módulo. Cada módulo fija su propio `basePath`.
  Cada módulo sigue siendo un proyecto Vercel independiente (deploys y
  rollback aislados).
- **Base de datos**: un solo proyecto Supabase (`nexo-core`), `auth.users`
  compartido (SSO real), un schema Postgres por módulo (`rrhh`, `flotilla`,
  `crm`, ...) más un schema `core` con compañías, catálogo de apps y
  permisos unificados. Ver [DATABASE.md](DATABASE.md).
- **Sesión**: al vivir todo bajo un solo host, la cookie de Supabase Auth es
  nativa de ese dominio — no se necesita compartir cookies entre
  subdominios.
- **Permisos**: norma DENY-BY-DEFAULT (heredada de Gestor360, ver
  [PERMISSIONS.md](PERMISSIONS.md)), extendida con un dominio "Módulos" que
  controla qué apps ve cada usuario en el panel.

## Configuración efectiva de Multi-Zones (verificado en producción, 2026-09-04)

Tres proyectos Vercel independientes, un solo dominio público:

| Proyecto Vercel | App | Root Directory | Dominios asignados |
|---|---|---|---|
| `nexocore` (`prj_CnPDGH9SLMpe4WgU74QysVthoGNp`) | `apps/nexo` (zona raíz) | `apps/nexo` | `nexo.materialesjcastillo.com` (producción), `nexocore-*.vercel.app` |
| `nexo-crm` (`prj_ZkuHO3l8cZxe6tDF0RUeBfnJYib6`) | `apps/crm` | `apps/crm` | `nexo-crm-*.vercel.app` (solo se accede vía rewrite, nunca directo) |
| `nexo-rrhh` (`prj_6nP4PUDQZH5iq6Cp2t7ytxzrqerM`) | `apps/rrhh` | `apps/rrhh` | `nexo-rrhh-*.vercel.app` (solo se accede vía rewrite, nunca directo) |

Los tres viven en el mismo team de Vercel (`team_4u6S79ER0UN7KtureMhHMiUZ`)
pero son proyectos separados a propósito (deploys y rollback aislados,
ver la regla crítica en [`CLAUDE.md`](../CLAUDE.md)) — **cada uno tiene
sus propias Environment Variables**, no se comparten entre sí aunque
compartan nombre.

### Contrato de rutas (`apps/nexo/next.config.ts`)

```
source: "/crm"        → destination: `${CRM_APP_URL}/crm`
source: "/crm/:path*"  → destination: `${CRM_APP_URL}/crm/:path*`
source: "/rrhh"         → destination: `${RRHH_APP_URL}/rrhh`
source: "/rrhh/:path*"   → destination: `${RRHH_APP_URL}/rrhh/:path*`
```

`CRM_APP_URL`/`RRHH_APP_URL` son las URLs reales del deployment de cada
módulo (`https://nexo-crm-*.vercel.app`, `https://nexo-rrhh-*.vercel.app`),
inyectadas como Environment Variable del proyecto `nexocore` — **nunca**
hardcodeadas y **nunca** puestas como `route` en `core.apps` (esa columna
siempre es la ruta relativa `/crm`/`/rrhh`, ver la regla de SSO). Ambas
variables deben estar además en el allowlist `tasks.build.env` de
`turbo.json` — si falta una, Turborepo la descarta en build silenciosamente
y el rewrite cae a un default de `localhost`, lo que produce
`DNS_HOSTNAME_RESOLVED_PRIVATE` en producción (bug real, ya visto y
corregido para RRHH el 2026-09-04, ver [MIGRATION_LOG.md](MIGRATION_LOG.md)).

Cada módulo fija su propio `basePath` (`/crm`, `/rrhh`) en su propio
`next.config.ts` — así todas sus rutas internas y assets viven bajo ese
prefijo sin que el módulo necesite saber que está detrás de un rewrite.
Única excepción documentada: `/rrhh/kiosco` está explícitamente excluido
del guard de sesión de Supabase Auth en `apps/rrhh/src/proxy.ts` (el
kiosco físico se autentica por PIN, no por sesión) — sigue sirviéndose
bajo el mismo `basePath` y el mismo rewrite, solo cambia el chequeo de
auth.

## Por qué no un monolito único

Fusionar RRHH, Flotilla y CRM en una sola app Next.js exigiría reescribir
dos productos en producción (Gestor360, Ruta360) desde cero. Multi-Zones da
la misma experiencia de usuario (un dominio, sin re-login) sin ese riesgo:
cada módulo se migra de forma incremental (*strangler fig*), un módulo a la
vez.

## Escalabilidad, RBAC de 2 capas, atomicidad inter-módulo, playbook de app nueva

Extensión de staff-architect sobre esta misma arquitectura (no la
cambia): particionamiento nativo, Supavisor, read replicas, rol por app,
la función cross-schema que garantiza atomicidad entre módulos (ej.
aprobar planilla en RRHH → asiento en Contabilidad, sin datos huérfanos
si algo falla), y el checklist único para dar de alta un módulo. Ver
[planning/ARQUITECTURA_MVP_ESCALABLE.md](planning/ARQUITECTURA_MVP_ESCALABLE.md).

## Pendiente de documentar aquí a medida que se implementa

- [x] Configuración exacta de `next.config.ts` de la zona raíz
      (`apps/nexo`) — ver "Configuración efectiva de Multi-Zones" arriba
- [x] `basePath` de cada módulo (`/crm`, `/rrhh`) — ver arriba
- [ ] `assetPrefix` explícito por módulo (hoy funciona sin fijarlo aparte
      de `basePath`; revisar si hace falta cuando se sirvan assets desde
      un CDN separado)
- [ ] Pipeline de CI/CD por app en Vercel (`turbo-ignore`)
- [ ] Estrategia de versionado de `packages/ui` entre zonas
