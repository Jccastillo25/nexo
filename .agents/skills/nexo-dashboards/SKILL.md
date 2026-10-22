---
name: nexo-dashboards
description: Método para diseñar, construir y revisar Dashboards de KPIs en las apps de Nexo (pirámide número principal → KPIs → tendencia → desglose, KPIs con fórmula y comparación, ritmo contra días hábiles, bullet y línea acumulada en SVG propio, estados sin datos vs. error). Usar al planear, implementar o revisar un /dashboard, una tarjeta de KPI, una meta o un gráfico en apps/*.
---

# Nexo Dashboards — KPIs y visualización de la suite

Adaptación estable al proyecto. Fuente y licencia: [SOURCE.md](SOURCE.md). Es un
método: qué dashboard tocar, los archivos autorizados y las pruebas los da el
coordinador en el encargo.

Complementa, no repite:
- [nexo-ui](../nexo-ui/SKILL.md): kit `@nexo/ui`, clases, textos, menú.
- [nexo-ui-review](../nexo-ui-review/SKILL.md): accesibilidad general y formato de hallazgos.
- [nexo-react-next](../nexo-react-next/SKILL.md): `Promise.all`, RPC, `"use client"`.
- [nexo-security](../nexo-security/SKILL.md): permisos y RPC `security definer`.

## Cuándo se utiliza

- Planear (ux-planner), construir (ui-frontend) o revisar (reviewer) el `/dashboard` de una app, o cualquier tarjeta de KPI, barra de meta, ranking o gráfico.
- No aplica al App Launcher (`apps/nexo` en `/`): por decisión vigente es un selector de apps, **sin KPIs** (`docs/DESIGN_SYSTEM.md`).

## Contexto que debe consultar

1. `AGENTS.md`: Dashboard de KPIs obligatorio, cero datos mock, paleta única e Inter, permisos v3.0, lógica en RPC (Nexo Mobile).
2. `packages/ui/MetricCard.tsx`, `StatusBadge.tsx`, `EmptyState.tsx`, `PageHeader.tsx`, `DashboardHero.tsx`: props reales.
3. **Referencia aprobada** (Presupuesto, 2026-10-20): `apps/presupuesto/src/app/(app)/dashboard/equipo.tsx` y `page.tsx`, `src/components/metas/tablero.tsx`, `grafico-acumulado.tsx`, `graficos.tsx`, `avisos.tsx`, `src/lib/metas/ritmo.ts`, `acumulado.ts`, `formato.ts`. Copia su estructura antes de inventar otra.
4. La RPC o tabla que alimenta cada KPI (tipos en `src/lib/**/tipos.ts` o `database.types.ts` de la app).

## Procedimiento (en orden)

1. **Preguntas de negocio por rol.** Para cada rol que entra (p. ej. vendedor, gerente, supervisor), escribe las 1–3 preguntas que el dashboard responde en 5 segundos ("¿llego a la meta del mes?"). Un rol con preguntas distintas = otra vista o pestaña (patrón "Mi avance"/"Equipo"), no más tarjetas.
2. **Elegir KPIs.** Cada KPI con ficha completa: nombre de negocio, fórmula, fuente real (RPC/tabla y campo), permiso que lo habilita, comparación (vs. meta y/o vs. período anterior equivalente), umbral y acción que dispara. Sin fuente real → `tone="pending"` + "Pendiente de integración", nunca un número. Catálogo por dominio: [references/catalogo-kpis.md](references/catalogo-kpis.md).
3. **Jerarquía en pirámide.** Un número principal → 3–5 KPIs → tendencia → desglose/ranking → detalle plegado. 5–9 KPIs a la vista, nunca más de ~15 cifras sin plegar. Lo más importante arriba a la izquierda. Esqueleto: [references/plantilla-piramide.md](references/plantilla-piramide.md).
4. **Forma de cada visual.** Primero decide si es un número, una barra contra meta, una línea o una tabla; el color va al final. Reglas de marcas y clases: [references/formas-visuales.md](references/formas-visuales.md).
5. **Estados.** Cargando, vacío, sin datos del período, error de RPC (distinto de "sin datos"), período cerrado/en curso/futuro, sin meta, meta 0, sin permiso, sin vínculo. Ritmo con un solo umbral compartido: [references/estados-y-ritmo.md](references/estados-y-ritmo.md).
6. **Móvil y accesibilidad.** Una columna en celular; montos grandes sin partirse con sidebar a 1024 px; texto SVG a tamaño real; tooltip con puntero, toque y teclado; tabla "Ver datos" por gráfico; estado con texto, nunca solo color.
7. **Verificación.** [references/checklist-revision.md](references/checklist-revision.md) + typecheck/lint.

## Restricciones

- **Cero datos mock.** Ni números de ejemplo ni fixtures en producción. Un dashboard con datos de ejemplo debe decirlo en pantalla y es deuda, no un entregable.
- **Una fórmula, un lugar.** El cálculo (ritmo, cumplimiento, variación) vive en funciones puras de `src/lib/` o en la RPC; las vistas no lo reescriben. El umbral de estado es una sola constante por app (como `UMBRAL_RIESGO` en `formato.ts`).
- **Lógica para Mobile en RPC.** Agregaciones y conteos nuevos se piden como RPC `security definer` (Paso Cero si es función nueva); no se arman en una Server Action ni con consultas sueltas desde la vista.
- **Paleta y kit.** Solo clases Tailwind `neutral/blue/emerald/amber/red`; sin hex, sin fuentes, sin librerías de gráficos nuevas sin aprobación (los gráficos de la referencia son SVG propio).
- **Permisos.** Cada bloque se consulta y se muestra solo con su permiso; ocultar no basta, la RPC también valida. Forzar `?vista=` sin permiso no debe llamar a la RPC.
- **El Launcher no lleva KPIs.**

## Entregables por rol

- **ux-planner:** preguntas por rol; tabla de KPIs (nombre, fórmula, fuente, permiso, comparación, umbral, acción) marcando "verificado en repo" o "propuesta"; boceto de la pirámide; tabla de estados por bloque; textos clave.
- **ui-frontend:** código en los archivos autorizados; lista de KPIs implementados con su fuente; estados cubiertos; desviaciones de la plantilla justificadas; resultado de typecheck/lint; "móvil no comprobado visualmente" si no hubo navegador.
- **reviewer:** hallazgos con el formato de [checklist-revision.md](references/checklist-revision.md) y listas Comprobado / Pendiente.

## Comprobaciones

- `npx.cmd --yes pnpm@9.15.9 --filter <app> run typecheck` y `run lint` sin errores.
- Buscar en el diff: hex (`#[0-9a-fA-F]{3,8}`), `font-family`, `fixtures`/`DEMO`, `?? []` o `?? 0` sobre una respuesta de RPC sin revisar su `error`.
- Cada KPI visible tiene comparación o contexto en `hint`, o una razón escrita para no tenerla.

## Si falta información o una herramienta

- No hay RPC para un KPI: no lo calcules desde la UI; márcalo "pendiente de fuente" y repórtalo al coordinador (implica migración y Paso Cero).
- No está definida la meta, el umbral o qué cuenta como día hábil: pregúntalo; no lo supongas.
- Sin navegador: legibilidad en móvil, contraste real y tooltip táctil quedan **pendientes de prueba visual**.
