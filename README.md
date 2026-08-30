# Nexo

Panel único y suite de módulos internos de Materiales J Castillo, al estilo
Odoo: un dominio, un login, módulos como rutas, permisos unificados.

Este repo es el destino de la migración descrita en
[`docs/planning/PLAN_UNIFICACION_NEXO.md`](docs/planning/PLAN_UNIFICACION_NEXO.md)
y [`docs/planning/PROPUESTA_MARCA_MODULOS.md`](docs/planning/PROPUESTA_MARCA_MODULOS.md).

Estado: el código de los 4 módulos (RRHH, Flotilla, CRM, Web Corporativo)
ya está importado en `apps/*` con su historial de git completo (ver
[`docs/MIGRATION_LOG.md`](docs/MIGRATION_LOG.md)) — **pero todavía sin
adaptar**: cada uno sigue apuntando a su proyecto Supabase original, sin
`basePath` de Multi-Zones, sin el panel `nexo` construido todavía.

## Estructura

```
nexo/
├── apps/
│   ├── nexo/             # Panel central (zona raíz de Multi-Zones): login + grilla de módulos
│   ├── rrhh/              # ex Gestor360 (marcacion-grupo-ct) — pendiente de migrar
│   ├── flotilla/           # ex Ruta360 (Desktop/Transporte) — pendiente de migrar
│   ├── crm/                 # ex materiales-jcastillo/apps/crm — pendiente de migrar
│   └── web-corporativo/      # ex materiales-jcastillo/apps/web — pendiente de migrar
├── packages/
│   ├── ui/                 # Design system compartido (StatCard, PageHeader, etc.)
│   ├── auth/                # Cliente Supabase Auth + hooks de sesión
│   ├── supabase/             # Clients tipados por schema, tipos generados
│   ├── permissions/            # Motor de permisos único (norma v3.0)
│   ├── config/                  # eslint, tsconfig, tailwind compartidos
│   └── types/                    # Tipos compartidos entre apps
├── supabase/
│   ├── migrations/            # Migraciones versionadas del proyecto `nexo-core`
│   └── seed/
└── docs/                        # Documentación viva (ver docs/README.md)
```

## Quick start

> Pendiente hasta que la app `nexo` (panel) tenga su primer `package.json`
> real de Next.js. Por ahora este repo es solo el esqueleto del monorepo.

```bash
pnpm install
pnpm dev
```

## Documentación

Ver [`docs/README.md`](docs/README.md) para el índice completo
(arquitectura, base de datos, catálogo de módulos, permisos, roadmap).
