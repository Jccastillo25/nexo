# Procedencia de nexo-planilla-flujos

| Campo | Valor |
|---|---|
| Tipo | Creación propia (2026-10-21), a pedido del coordinador para PL4–PL6 de Planilla |
| Base principal | `docs/plan/20-planilla.md` §1.1–§1.3 (funciones y menú de AG recorrido en solo lectura), §6, §8, §9; `docs/PERMISSIONS.md` (Planilla) |
| Patrones del repo verificados | `apps/rrhh/src/lib/nav.ts`, `asistencia-nav.ts`, `permisos-asistencia.ts`, `apps/rrhh/src/app/(app)/planillas/page.tsx`, `apps/rrhh/src/app/sin-acceso/page.tsx`, `packages/ui/index.ts`, `nexo-icons.tsx`, `EmptyState.tsx`, `StatusBadge.tsx`, `Alert.tsx`, `formato.ts` (`moneda`); `CLAUDE.md` (menú desplegable, Dashboard de KPIs, cero datos mock) |
| Archivos | `SKILL.md`, `references/navegacion.md`, `flujos.md`, `pantallas.md`, `dashboard-kpis.md`. Sin scripts, sin `allowed-tools`, sin red |
| Licencia | Contenido propio. De AG Planilla (propietario) solo se toma el funcionamiento descrito en el plan 20; ningún texto, marca ni pantalla |

## Contenido de terceros con instrucciones al agente

Ninguno.

## Evaluación

No se probó en una tarea delegada. Los iconos, variantes de `EmptyState`,
tonos de `StatusBadge` y `Alert`, y el patrón de app separada se comprobaron
leyendo los archivos citados el 2026-10-21. No se hizo prueba visual.
Pendiente: medirla en la primera especificación de PL4 (ux-planner) contra la
checklist de nexo-ui-review.
