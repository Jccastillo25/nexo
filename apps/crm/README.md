# apps/crm — CRM

Estado: **no migrado.** Código fuente actual:
`Desktop/jcastillo/WEB Corporativo jcastillo/apps/crm`
(repo `Jccastillo25/materiales-jcastillo`).

Ruta de destino dentro de Nexo: `/crm` (vía Multi-Zones,
`basePath: "/crm"`).

Schema Supabase de destino: `crm` en el proyecto `nexo-core` (migrado desde
`arzadwxsifnaolvfcvqk`).

Orden de migración: segundo (bajo riesgo, tráfico bajo). Ver
[docs/planning/PLAN_UNIFICACION_NEXO.md](../../docs/planning/PLAN_UNIFICACION_NEXO.md)
sección 5.

## Pendiente

- [ ] Traer el código de `apps/crm` a esta carpeta
- [ ] Configurar `basePath: "/crm"`
- [ ] Migrar datos de `arzadwxsifnaolvfcvqk` al schema `crm` de `nexo-core`
