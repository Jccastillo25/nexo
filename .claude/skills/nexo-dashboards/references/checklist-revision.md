# Checklist de revisión de dashboards

Para `reviewer` (y autoverificación de `ui-frontend`). Se suma a
[nexo-ui-review](../../nexo-ui-review/SKILL.md), que cubre la accesibilidad
general; aquí solo lo propio de KPIs y gráficos. Cada punto incluye un error
real ya visto en la suite cuando lo hay.

## Formato de hallazgo

```
## apps/<app>/src/app/(app)/dashboard/page.tsx
- page.tsx:38 — [Alta] `cola = colaRes.data ?? []` sin revisar `colaRes.error`: una falla se ve como "0 en espera" → revisar error, registrar con contexto y mostrar "No disponible".
✓ archivo-sin-hallazgos.tsx
```

Gravedades: **Bloqueante** (regla de `CLAUDE.md`: datos mock, permiso
ausente, paleta/hex) · **Alta** (número engañoso o error oculto) · **Media**
(contexto, accesibilidad de gráfico, móvil) · **Baja** (estilo, texto).
Cierra con **Comprobado** (comando o línea) y **Pendiente / no comprobado**.

## Datos y verdad (Bloqueante / Alta)

- [ ] Ningún valor sale de fixtures, constantes o `Math.random`; lo que no tiene fuente dice "Pendiente de integración" con `tone="pending"`.
- [ ] Cada `rpc()`/`from()` revisa `error` antes de usar `data`/`count`; el error se registra en el servidor con contexto (nombre de la RPC) y se muestra distinto de "sin datos".
- [ ] Error de la RPC principal → pantalla de error; error de un complemento → solo ese bloque.
- [ ] Ningún complemento que falla se descarta en silencio (aunque su bloque se oculte, se registra).
- [ ] Las comparaciones usan el mismo período (vs. año anterior a la fecha, acumulado hasta el corte), nunca acumulado contra meta completa de otro período.
- [ ] Insignias y colores coinciden con el ritmo: en período en curso se compara contra lo esperado a la fecha, no contra la meta total.
- [ ] Un solo umbral compartido para la misma medida en todas las vistas de la app.
- [ ] Sin meta y meta 0 no producen `Infinity`, `NaN`, "0 %" ni rojo.
- [ ] El cálculo vive en una función pura o en la RPC, no duplicado en cada vista.

## Permisos (Bloqueante)

- [ ] Cada bloque se consulta solo con su permiso (no basta ocultarlo); forzar parámetros de URL no llama a RPC no permitidas.
- [ ] Enlaces de acción solo con el permiso de destino.
- [ ] KPI nuevo con RPC nueva: tiene código en `core.permissions_catalog` (si no, reportar Paso Cero pendiente).

## Jerarquía (Media)

- [ ] Un solo número principal; 5–9 KPIs a la vista; nada de KPIs duplicados (la misma cifra en hero y en tarjeta).
- [ ] Cada KPI tiene contexto: comparación, meta o explicación en `hint`.
- [ ] Período y frescura del dato visibles arriba; período en la URL.
- [ ] Orden: número principal → KPIs → tendencia → desglose → detalle plegado.

## Gráficos (Media)

- [ ] La forma corresponde a la pregunta (ver [formas-visuales.md](formas-visuales.md)); sin doble eje, sin dona para comparar, sin barra solitaria.
- [ ] Una sola escala por gráfico; marca de meta visible; escala con margen (× 1.02).
- [ ] Leyenda con 2 o más series; texto en color de texto, no de serie.
- [ ] Series secundarias ≥ 3:1 o con sus valores también en texto/tabla (error real: `blue-200` en la serie del año anterior).
- [ ] Tooltip con puntero, toque y teclado; no es la única vía: tabla "Ver datos".
- [ ] SVG con nombre accesible (`role="img"` + `aria-label` con resumen) y foco visible si es interactivo.
- [ ] Estado nunca solo por color: `StatusBadge` con texto.

## Móvil (Media)

- [ ] Texto del SVG legible en celular: `viewBox` con ancho medido, o `min-w-*` + `overflow-x-auto` (error real: `viewBox` fijo de 640 escalaba el texto a ~5 px).
- [ ] Montos grandes no se parten a 1024 px con sidebar (4 columnas solo en `xl`).
- [ ] Sin desplazamiento horizontal de la página; `touch-pan-y` en gráficos táctiles.

## Kit y suite (Bloqueante)

- [ ] `PageHeader`, `MetricCard`, `StatusBadge`, `EmptyState` del kit; sin tarjetas KPI propias que dupliquen `MetricCard`.
- [ ] Solo clases `neutral/blue/emerald/amber/red`; sin hex ni `font-family`; sin librería de gráficos nueva.
- [ ] `next/link` para navegación interna.

## Comandos que puede correr el revisor

```bash
npx.cmd --yes pnpm@9.15.9 --filter <app> run typecheck
npx.cmd --yes pnpm@9.15.9 --filter <app> run lint
```

Y búsquedas con Grep en los archivos del diff: `#[0-9a-fA-F]{3,8}`,
`\?\? \[\]`, `\?\? 0`, `DEMO|fixtures`, `lg:grid-cols-4`.
