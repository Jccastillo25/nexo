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

- [ ] Configuración exacta de `next.config.js` de la zona raíz (`apps/nexo`)
- [ ] `basePath` y `assetPrefix` de cada módulo
- [ ] Pipeline de CI/CD por app en Vercel (`turbo-ignore`)
- [ ] Estrategia de versionado de `packages/ui` entre zonas
