---
name: nexo-planilla-flujos
description: UX del módulo de Planilla y prestaciones de RRHH en Nexo, adaptado de AG Planilla (unas 120 opciones) a un menú desplegable simple. Cubre navegación con iconos y permisos, flujos (abrir período, novedades, calcular, comparar con el período anterior, aprobar, pagar, colillas, vacaciones, préstamos, liquidación, declaraciones INSS/DGI, simulador de régimen), estados de pantalla y Dashboard de KPIs. Usar al especificar, construir o revisar pantallas de planilla, vacaciones, préstamos o liquidaciones.
---

# Nexo Planilla — flujos y pantallas

Adaptación estable al proyecto. Fuente: [SOURCE.md](SOURCE.md). Dice **qué**
pantallas y flujos hay y con qué permiso; **cómo** se construyen lo dicen
[nexo-ui](../nexo-ui/SKILL.md), [nexo-ui-review](../nexo-ui-review/SKILL.md),
[nexo-dashboards](../nexo-dashboards/SKILL.md) y
[nexo-react-next](../nexo-react-next/SKILL.md). Reglas de cálculo:
[nexo-planilla-legal](../nexo-planilla-legal/SKILL.md). RPC y estados:
[nexo-planilla-motor](../nexo-planilla-motor/SKILL.md). La pantalla concreta,
los archivos autorizados y las pruebas los da el coordinador.

## Cuándo se utiliza

- ux-planner: especificación de una pantalla o flujo de planilla (tareas, permisos, estados, criterios de aceptación).
- ui-frontend: construir esas pantallas en `apps/rrhh` cuando existan las RPC.
- reviewer: comprobar permisos por control, estados y textos.

## Contexto que debe consultar

1. `docs/plan/20-planilla.md` §1.2 (menú de AG), §6 (optimizaciones), §8 (permisos), §9 decisión 5 (dónde vive).
2. `apps/rrhh/src/lib/nav.ts` (grupo "Nómina" con "Planillas") y, como modelo de app separada, `apps/rrhh/src/lib/asistencia-nav.ts` + `permisos-asistencia.ts`.
3. `apps/rrhh/src/app/(app)/planillas/page.tsx`: hoy es un `EmptyState variant="pending"`; se reemplaza.
4. `packages/ui/index.ts` y `nexo-icons.tsx` (iconos disponibles).

## Reglas estables

1. **Menú** según `CLAUDE.md`: Dashboard suelto (icono `grid`); todo lo demás en grupos desplegables; cada ítem con icono existente; orden operativo → análisis → configuración (`settings`); un hijo sin permiso no se lista; función futura = hijo sin `href` ("Pronto"), sin página placeholder. Propuesta en [references/navegacion.md](references/navegacion.md).
2. **Dónde vive está pendiente** (decisión 5): app propia "Planilla" en `/rrhh/planilla` como Asistencia, o dentro del menú de RRHH. La skill da los dos árboles; no elijas por tu cuenta.
3. **Cada control con su permiso** de los 25 reales ([references/pantallas.md](references/pantallas.md)): la UI oculta o deshabilita con `hasPermission`, la Server Action llama `requirePermission` y la RPC vuelve a validar.
4. **Separación de funciones visible**: si quien mira la planilla la calculó, el botón "Aprobar" se deshabilita con el motivo "La aprobación la hace otra persona"; no se oculta sin explicación.
5. **Planilla aprobada = solo lectura** con la explicación "Para corregirla, anúlala y genera otra".
6. **Cero datos de ejemplo**. Sin RPC: `EmptyState variant="pending"` o "Pendiente de integración". Valores "verificar": `Alert tone="info"` "Valor pendiente de confirmar con el contador".
7. **Montos** con `moneda()` de `@nexo/ui` (C$, 2 decimales), alineados a la derecha, con cifras tabulares; nunca se recalculan en la vista: se muestran los de la RPC.
8. **Lenguaje del negocio** en español neutro: "Planilla", "Colilla", "Novedades", "Aguinaldo", "Liquidación", "Préstamos y adelantos"; sin voseo.

## Procedimiento (ux-planner)

1. Elige el flujo en [references/flujos.md](references/flujos.md) y escribe usuarios, tareas y reglas.
2. Para cada pantalla, toma de pantallas.md el permiso de ver, el de cada acción y los estados.
3. Si toca el Dashboard, arma la ficha de KPIs con [references/dashboard-kpis.md](references/dashboard-kpis.md) y el método de nexo-dashboards.
4. Criterios de aceptación verificables, incluidos los de permisos, separación de funciones, período cerrado y textos de error.
5. Lista lo que depende de una decisión abierta o de una RPC que aún no existe.

## Restricciones

- No reproducir las ~120 opciones de AG: primero lo que la empresa usa (plan 20 §1.3 y §6).
- No construir header, sidebar ni componentes que ya existen en `@nexo/ui`; no agregar librerías.
- Sin cálculos de planilla en el cliente ni en Server Actions.
- Sin nombres ni cifras de personas reales en textos, capturas o pruebas.

## Si falta información

Falta una decisión (dónde vive, IR quincenal, permiso para pagar una liquidación, formato de declaraciones): no la inventes; escríbela como pregunta para el coordinador dentro de la especificación.
