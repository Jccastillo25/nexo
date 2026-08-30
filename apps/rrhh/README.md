# apps/rrhh — RRHH (ex Gestor360)

Estado: **no migrado.** Código fuente actual:
`jcaatillo/marcacion-grupo-ct` (repo GitHub, no clonado localmente al
momento de crear este esqueleto).

Ruta de destino dentro de Nexo: `/rrhh` (vía Multi-Zones,
`basePath: "/rrhh"`).

Schema Supabase de destino: `rrhh` en el proyecto `nexo-core` (migrado
desde `ofeuzkwjhmfsazqfyutu`).

Orden de migración: **último** — es la app más crítica en producción y la
que tiene más trabajo de permisos en curso. Ver
[docs/planning/PLAN_UNIFICACION_NEXO.md](../../docs/planning/PLAN_UNIFICACION_NEXO.md)
sección 5 (orden de corte).

## Pendiente

- [ ] Traer el código de `marcacion-grupo-ct/web` a esta carpeta
- [ ] Configurar `basePath: "/rrhh"`
- [ ] Migrar datos de `ofeuzkwjhmfsazqfyutu` al schema `rrhh` de `nexo-core`
- [ ] Adaptar RLS para validar contra `core.user_permissions`
