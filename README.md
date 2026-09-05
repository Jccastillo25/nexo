# Nexo

Panel único y suite de módulos internos de Materiales J Castillo, al estilo
Odoo: un dominio, un login, módulos como rutas, permisos unificados.

Este repo es el destino de la migración descrita en
[`docs/planning/PLAN_UNIFICACION_NEXO.md`](docs/planning/PLAN_UNIFICACION_NEXO.md)
y [`docs/planning/PROPUESTA_MARCA_MODULOS.md`](docs/planning/PROPUESTA_MARCA_MODULOS.md).

Estado (2026-09-04, verificado contra Supabase `nexo-core` y Vercel, no
contra la documentación de planeación): el panel (`apps/nexo`) y el CRM
(`apps/crm`) están **operativos en producción**, bajo un solo dominio
(`nexo.materialesjcastillo.com`) vía Next.js Multi-Zones. RRHH
(`apps/rrhh`) tiene su infraestructura completa desplegada y verificada
(schema, permisos, RLS, kiosco, alta de empleados) pero su **MVP
operativo todavía no se probó de punta a punta con datos reales** — ver
[`docs/RRHH_MVP.md`](docs/RRHH_MVP.md) para el alcance exacto y lo que
falta. Flotilla sigue sin adaptar. Detalle completo por módulo en
[`docs/MODULES.md`](docs/MODULES.md) y por fase en
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estructura

```
nexo/
├── apps/
│   ├── nexo/             # Panel central (zona raíz de Multi-Zones): login + grilla de módulos — en producción
│   ├── rrhh/              # ex Gestor360 (marcacion-grupo-ct) — infraestructura lista, MVP sin validar end-to-end
│   ├── flotilla/           # ex Ruta360 (Desktop/Transporte) — pendiente de adaptar
│   ├── crm/                 # ex materiales-jcastillo/apps/crm — en producción
│   └── web-corporativo/      # ex materiales-jcastillo/apps/web — dominio aparte, no requirió adaptación
├── packages/
│   ├── ui/                 # Design system compartido (ShellBar, tokens de color/tipografía, StatCard, etc.)
│   ├── auth/                # Cliente Supabase Auth + hooks de sesión
│   ├── supabase/             # Clients tipados por schema, tipos generados
│   ├── permissions/            # Motor de permisos único (norma v3.0)
│   ├── config/                  # eslint, tsconfig, tailwind compartidos
│   └── types/                    # Tipos compartidos entre apps
├── supabase/
│   ├── migrations/            # Migraciones versionadas del proyecto `nexo-core` (24 aplicadas al remoto)
│   └── seed/
└── docs/                        # Documentación viva (ver docs/README.md)
```

## Módulos y su despliegue en Vercel

Cada `apps/<módulo>` es un proyecto Vercel independiente (Root Directory
propio, Environment Variables propias — **no se comparten entre
proyectos**, ver la regla crítica en [`CLAUDE.md`](CLAUDE.md)), cosidos
bajo un solo dominio público vía rewrites de Multi-Zones en `apps/nexo`.
Detalle de la configuración efectiva (dominios, rewrites, contrato de
rutas) en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Proyecto Vercel | App | Ruta pública |
|---|---|---|
| `nexocore` | `apps/nexo` | `nexo.materialesjcastillo.com/` (zona raíz) |
| `nexo-crm` | `apps/crm` | `nexo.materialesjcastillo.com/crm` |
| `nexo-rrhh` | `apps/rrhh` | `nexo.materialesjcastillo.com/rrhh` |

## Quick start

```bash
pnpm install
pnpm dev
```

`pnpm dev` corre todas las apps vía Turborepo (cada una en su propio
puerto). Para levantar un módulo específico: `pnpm --filter <app> dev`.

## Documentación

Ver [`docs/README.md`](docs/README.md) para el índice completo
(arquitectura, base de datos, catálogo de módulos, permisos, roadmap,
MVP de RRHH).
