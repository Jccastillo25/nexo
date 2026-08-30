# Roadmap

Ver el detalle completo de fases y cronograma en
[planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md)
sección 8, y el catálogo progresivo de módulos en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 4.

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Confirmar decisiones (nombre de la suite, dominio, naming de módulos) | ✅ Hecho — suite "Nexo", sin subdominios, Multi-Zones |
| 1 | Crear repo monorepo, Turborepo, packages compartidos vacíos | ✅ Esqueleto creado (2026-08-29) |
| 1.5 | Importar el código de los 4 productos existentes a `apps/*` (con historial, vía `git subtree`) | ✅ Hecho (2026-08-29) — ver [MIGRATION_LOG.md](MIGRATION_LOG.md) |
| 2 | Provisionar `nexo-core`, tabla `core.*`, permisos v3.0 | ✅ Hecho (2026-08-30) — ver [DATABASE.md](DATABASE.md) y [PERMISSIONS.md](PERMISSIONS.md) |
| 3 | Adaptar `web-corporativo` + `crm` (basePath, Supabase → `nexo-core`) | ✅ Hecho (2026-08-30) — schema `crm` ya expuesto, sin datos que migrar |
| 4 | Construir el panel `nexo` funcional sobre los módulos ya adaptados | ✅ Hecho y verificado en vivo (2026-08-30) — ver [MIGRATION_LOG.md](MIGRATION_LOG.md) |
| 5 | Adaptar `flotilla` (app + datos → `nexo-core`) | ⏳ Pendiente — código ya está en el repo, falta adaptar |
| 6 | Adaptar `rrhh` (app + datos → `nexo-core`) | ⏳ Pendiente — código ya está en el repo, falta adaptar |
| 7 | Apagar proyectos Supabase/repos viejos (pausar, no borrar) | ⏳ Pendiente |
| 8 | Documentación final + módulos de Fase 2 (Inventario, Compras, Ventas, Contabilidad) | ⏳ Pendiente |
