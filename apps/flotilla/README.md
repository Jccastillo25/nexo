# apps/flotilla — Flotilla (ex Ruta360)

Estado: **no migrado.** Código fuente actual:
`C:\Users\Gerencia\Desktop\Transporte` (repo `Jccastillo25/transporte-saas`).

Ruta de destino dentro de Nexo: `/flotilla` (vía Multi-Zones,
`basePath: "/flotilla"`).

Schema Supabase de destino: `flotilla` en el proyecto `nexo-core`.

Orden de migración: tercero (después de `web-corporativo` y `crm`, antes de
`rrhh`). Ver
[docs/planning/PLAN_UNIFICACION_NEXO.md](../../docs/planning/PLAN_UNIFICACION_NEXO.md)
sección 5.

## Pendiente

- [ ] Traer el código de `Desktop/Transporte` a esta carpeta
- [ ] Configurar `basePath: "/flotilla"`
- [ ] Migrar datos del proyecto Supabase actual de Ruta360 al schema
      `flotilla` de `nexo-core`
- [ ] Adaptar RLS para validar contra `core.user_permissions`
