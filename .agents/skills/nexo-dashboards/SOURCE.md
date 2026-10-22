# Procedencia de nexo-dashboards

| Campo | Valor |
|---|---|
| Tipo | Creación propia (2026-10-20), a pedido del usuario: "un especialista en dashboards y KPIs para poder mejorar todos los dashboards del sistema" |
| Base principal | Dashboard del equipo de Presupuesto aprobado por el usuario el 2026-10-20 (`apps/presupuesto/src/app/(app)/dashboard/equipo.tsx`, `components/metas/tablero.tsx`, `grafico-acumulado.tsx`, `graficos.tsx`, `lib/metas/ritmo.ts`, `acumulado.ts`, `formato.ts`) y las lecciones de su revisión independiente |
| Fecha | 2026-10-20 |
| Archivos | `SKILL.md`, `references/catalogo-kpis.md`, `plantilla-piramide.md`, `formas-visuales.md`, `estados-y-ritmo.md`, `checklist-revision.md`. Sin scripts, sin `allowed-tools`, sin bloques de comandos, sin red |

## Fuentes externas (solo ideas, redactadas de nuevo; sin texto literal)

| Fuente | Qué se tomó | Licencia / condición |
|---|---|---|
| Skill integrada `dataviz` de Claude Code (paquete `bundled-skills/2.1.304`, archivos `SKILL.md` y `references/choosing-a-form.md`, `marks-and-anatomy.md`, `interaction.md`, `anti-patterns.md`, `color-formula.md`, `components.md`) | Elegir la forma antes del color; número/stat tile/meter cuando no hace falta gráfico; énfasis (una serie en acento, el resto en gris); un solo eje; marcas finas, rejilla sólida de 1 px, área al 10 %; etiquetas selectivas; texto en color de texto; tooltip que no es la única vía + tabla equivalente; filtros en una fila arriba; estado con texto | Los archivos no declaran licencia. Se usan solo ideas y se mapean a Tailwind de Nexo. **Descartado:** la paleta de referencia (`palette.md`, valores hex), el validador `scripts/validate_palette.js`/`.py` (no se copia ni se ejecuta), el sistema de 8 tonos categóricos y las texturas, porque Nexo tiene una sola paleta Tailwind y casi nunca más de 3–4 series |
| Stephen Few, *Bullet Graph Design Specification* (Perceptual Edge), citado por fuentes secundarias: [FusionCharts](https://www.fusioncharts.com/resources/chart-primers/bullet-graph), [Domo](https://domo-webflow.domo.com/learn/charts/bullet-graphs) | Partes de la barra bullet: medida principal, medida comparativa (meta), rangos cualitativos discretos | Concepto público; no se leyó el PDF original (la búsqueda no lo devolvió) |
| Artículos de buenas prácticas citados por el coordinador: domo.com/learn/article/kpi-dashboards, clearpointstrategy.com/blog/kpi-dashboard-best-practices, improvado.io/blog/sales-dashboard, salesscreen.com, visdum.com/term/daily-run-rate, phocassoftware.com (RFM) | 5–9 KPIs a la vista y ~15 como máximo; lectura en F; pirámide; todo número con contexto; ritmo diario (*run rate*); segmentación RFM como propuesta | Sin licencia de reutilización; solo hechos/ideas generales. **No los abrió el especialista en esta sesión**: los aporta el coordinador como ya consultados |

## Contenido de terceros con instrucciones al agente

Ninguno encontrado en lo inspeccionado.

## Evaluación

No se comparó contra otra skill ni se probó en una tarea delegada. La
adaptación se justifica por coincidir con la referencia aprobada y con los
componentes reales de `packages/ui` (props leídas en `MetricCard.tsx`,
`StatusBadge.tsx`, `EmptyState.tsx`, `PageHeader.tsx`, `DashboardHero.tsx`).
Las cifras de contraste de `formas-visuales.md` son una aproximación propia
con los valores publicados de Tailwind v4, no una medición en pantalla.
Pendiente: medirla en el primer rediseño de dashboard que se delegue (p. ej.
Asistencia o Atención) comparando el resultado contra la checklist.
