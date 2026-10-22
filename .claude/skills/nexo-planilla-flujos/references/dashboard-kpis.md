# Dashboard de Planilla: ficha de KPIs

Método, pirámide, estados y formas: [nexo-dashboards](../../nexo-dashboards/SKILL.md).
Aquí, el catálogo del dominio. **Todos son propuesta**: ninguna RPC existe al
2026-10-21; cada uno necesita su RPC `security definer` (Mobile) y se muestra
"Pendiente de integración" mientras no exista.

## Preguntas por rol

| Rol | Preguntas en 5 segundos |
|---|---|
| Admin / gerencia | ¿Cuánto me cuesta la planilla este mes y cuánto cambió? ¿Qué está pendiente de aprobar o pagar? ¿Cuánto debo en prestaciones? |
| Especialista de planillas | ¿Qué período toca, qué falta para calcular y qué avisos hay? |
| Supervisor de asistencia | ¿Cuántas solicitudes de vacaciones esperan mi aprobación? |

## KPIs

| KPI | Fórmula | Comparación | Permiso | Acción |
|---|---|---|---|---|
| **Costo de la planilla del mes** (número principal) | Σ devengado + aporte patronal + INATEC + provisiones, planillas no anuladas del mes | vs. mes anterior | `planilla.ver` | Ver comparativo |
| Neto pagado | Σ neto de planillas `pagada` del mes | vs. aprobado del mes | `planilla.ver` | Ver pagos |
| Aporte patronal | Σ INSS patronal + INATEC | vs. mes anterior | `planilla.ver` | — |
| Pendientes | conteo `calculada` sin aprobar y `aprobada` sin pagar | — | `planilla.ver` | Ir a la planilla |
| Pasivo laboral | Σ provisiones acumuladas (vacaciones, aguinaldo, indemnización) | vs. mes anterior | `planilla.ver` | Ver por persona |
| Horas extra | Σ horas extra del mes | vs. meta (a definir) | `planilla.ver` | — (fuente PL3) |
| Rotación | bajas del mes / plantilla promedio | vs. promedio 12 meses | `planilla.ver` | — (fuente de bajas por fecha pendiente) |
| Vacaciones por aprobar | conteo de solicitudes | — | `vacaciones.aprobar` | Ir a Vacaciones |
| Diferencia por régimen | costo laboral − costo actual de contratos en servicios profesionales | — | `regimen.ver` | Ir al simulador |

Reglas:
- "Mes" = planillas cuyo `periodo_fin` cae en el mes (dos quincenas).
- Sin planillas en el mes: "Sin planillas en este mes", no C$0.
- Montos con `moneda()`; el pasivo laboral con aviso si usa el método de indemnización todavía no decidido (1/12 de AG o tabla del art. 45).
- No mezclar con el Launcher: los KPIs viven en el `/dashboard` de la app (opción A) o en el de RRHH (opción B).
