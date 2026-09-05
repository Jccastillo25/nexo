# Roadmap

Ver el detalle completo de fases y cronograma en
[planning/PLAN_UNIFICACION_NEXO.md](planning/PLAN_UNIFICACION_NEXO.md)
sección 8, y el catálogo progresivo de módulos en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 4.

Esta tabla separa dos cosas que se venían confundiendo: que la
**infraestructura** de un módulo esté desplegada (código en producción,
schema aplicado, permisos y RLS correctos) no significa que su **MVP
operativo** esté validado (alguien recorrió el flujo completo con datos
reales y funcionó). RRHH es el caso concreto: infraestructura completa,
MVP sin recorrer todavía — ver [RRHH_MVP.md](RRHH_MVP.md).

## Infraestructura implementada

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Confirmar decisiones (nombre de la suite, dominio, naming de módulos) | ✅ Hecho — suite "Nexo", sin subdominios, Multi-Zones |
| 1 | Crear repo monorepo, Turborepo, packages compartidos | ✅ Hecho (2026-08-29) |
| 1.5 | Importar el código de los 4 productos existentes a `apps/*` (con historial, vía `git subtree`) | ✅ Hecho (2026-08-29) — ver [MIGRATION_LOG.md](MIGRATION_LOG.md) |
| 2 | Provisionar `nexo-core`, tabla `core.*`, permisos v3.0 | ✅ Hecho (2026-08-30) — ver [DATABASE.md](DATABASE.md) y [PERMISSIONS.md](PERMISSIONS.md) |
| 3 | Adaptar `web-corporativo` + `crm` (basePath, Supabase → `nexo-core`) | ✅ Hecho (2026-08-30) — schema `crm` expuesto, RLS real |
| 4 | Construir el panel `nexo` funcional sobre los módulos ya adaptados | ✅ Hecho y verificado en vivo (2026-08-30) |
| 6a | Adaptar `rrhh` — schema, permisos (37 códigos), RLS, `GRANT`, proyecto Vercel `nexo-rrhh`, rewrite de Multi-Zones, UI de expedientes y kiosco | ✅ Hecho y desplegado (2026-09-02 a 2026-09-04) — ver [MIGRATION_LOG.md](MIGRATION_LOG.md) y [DATABASE.md](DATABASE.md) |
| 5 | Adaptar `flotilla` (app + datos → `nexo-core`) | ⏳ Pendiente — código ya está en el repo, falta adaptar |
| 7 | Apagar proyectos Supabase/repos viejos (pausar, no borrar) | ⏳ Pendiente |
| 8 | Documentación final + módulos de Fase 2 (Inventario, Compras, Ventas, Contabilidad) | ⏳ Pendiente |

## MVP operativo validado

Un módulo pasa a esta lista solo cuando alguien ejecutó su recorrido
completo (no solo un componente aislado) contra datos reales o de
prueba realistas, con los tres roles relevantes (admin, operador,
usuario sin permiso), y quedó documentado. **RRHH no se marca como
"Hecho" en la sección de arriba en ningún nivel de recorrido completo
hasta que pase por aquí.**

| Módulo | Recorrido probado | Estado |
|---|---|---|
| Nexo (panel) | Login, grilla de módulos por permiso, navegación a CRM y RRHH | ✅ Validado en vivo (2026-08-30, 2026-09-04) |
| CRM | Alta/edición/baja de cliente con RLS real | ✅ Validado en vivo (2026-08-30) |
| RRHH | Alta de empleado → marca en kiosco → consolidación de horas → planilla de prueba → reporte por empleado | ❌ **No ejecutado.** Bloqueado por: (1) motor de consolidación de horas y generación de planilla no construido (`/rrhh/planillas` es un placeholder), (2) cero empleados/marcas reales cargados, (3) prueba de acceso con los 3 roles (admin/operador/sin permiso) no ejecutada. Ver [RRHH_MVP.md](RRHH_MVP.md) para el criterio de aceptación exacto y el checklist de pruebas manuales |
| Flotilla | — | No aplica todavía (módulo sin adaptar) |

## Próximo hito concreto

Completar el motor de consolidación de marcas → horas trabajadas y el
generador de planilla de prueba (ver "Exclusiones y próximos pasos" en
[RRHH_MVP.md](RRHH_MVP.md)), cargar datos de prueba, y ejecutar el
checklist de pruebas manuales de ese mismo documento antes de declarar
RRHH con MVP validado.
