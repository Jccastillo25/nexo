# apps/web-corporativo — Sitio público

Estado: **no migrado.** Código fuente actual:
`Desktop/jcastillo/WEB Corporativo jcastillo/apps/web`
(repo `Jccastillo25/materiales-jcastillo`, "Fase 1", pendiente de construir
según el README original del monorepo).

Este NO es un módulo del panel — vive en el dominio raíz
`materialesjcastillo.com`, separado de `nexo.materialesjcastillo.com`.

Orden de migración: **primero** (sin datos transaccionales, menor riesgo,
sirve como piloto del patrón completo). Ver
[docs/planning/PLAN_UNIFICACION_NEXO.md](../../docs/planning/PLAN_UNIFICACION_NEXO.md)
sección 5 y 10.

## Pendiente

- [ ] Traer/terminar el código de `apps/web` a esta carpeta
- [ ] Configurar despliegue en `materialesjcastillo.com` (dominio raíz, sin
      basePath — no es zona de Multi-Zones de `nexo`)
