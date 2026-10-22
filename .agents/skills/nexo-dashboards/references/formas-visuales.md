# Formas de visual, marcas y color

Primero la forma, luego el color. Ideas adaptadas de la skill integrada
`dataviz` y de la especificación de *bullet graph* de Stephen Few (ver
[../SOURCE.md](../SOURCE.md)), mapeadas a Tailwind de Nexo.

## ¿Qué forma?

| La pregunta es… | Forma | Referencia en el repo |
|---|---|---|
| El número que manda | **Hero**: valor grande + estado + contexto | `HeroMes` en `tablero.tsx` |
| Un valor con su comparación | **Stat tile** `MetricCard` (valor + `hint` con la comparación) | `equipo.tsx` |
| Un valor contra una meta en el tiempo | **Bullet**: barra de lo logrado, tramo claro de proyección, marca "hoy tocaba", marca de meta | `HeroMes` |
| Cómo se llegó hasta hoy | **Línea acumulada** vs. ritmo necesario vs. período anterior | `grafico-acumulado.tsx` |
| Quién va mejor contra su meta | **Ranking con barras** ordenado por valor, marca de meta por fila, % y `StatusBadge` | `RankingVendedores` |
| 12 meses contra presupuesto | **Columnas** con marca de meta por mes | `GraficoMensual` en `graficos.tsx` |
| Muchas columnas o categorías (> 7) | **Mini-tabla** o `DataTable`, `tabular-nums` | `PanelClientes`, detalle plegado |
| Pendientes que piden acción | **Lista con conteo** y enlace | "Para revisar" en Productos |

**Cuándo NO graficar:** un solo valor (es un número, no una barra solitaria);
dos porciones (es un porcentaje); valores muy parecidos (dona o anillo no
sirven: barra o número); menos de 3 puntos en el tiempo; datos sin fuente.
Nunca doble eje Y: dos medidas de escala distinta van en dos gráficos o
indexadas a una base común. Sin donas para comparar.

## Marcas

- Barras ≤ 24 px de grosor, que crecen desde una base; en barras de meta horizontales `h-3` (filas) o `h-5` (hero), `rounded-full`.
- Líneas 2–2.5 px, `strokeLinejoin`/`strokeLinecap="round"`; marcador final r ≥ 4 con anillo blanco (`stroke-white`, 2 px).
- Área bajo la serie principal: misma tonalidad al 10 % (`fill-blue-600/10`).
- Rejilla y ejes: línea sólida de 1 px `stroke-neutral-200`; texto de ejes `fill-neutral-500`, 11 px, valores redondos y compactos (`usdCompacto`).
- **Punteado solo para lo que no es real**: ritmo necesario (`strokeDasharray="5 4"`, `stroke-neutral-500`) y proyección (`"2 4"`, `stroke-blue-600`). Nunca rejilla punteada.
- Etiquetas directas selectivas: el último punto, la meta, la proyección. Nunca un número en cada punto.
- Texto con color de texto (`text-neutral-900/700/600/500`), nunca con el color de la serie; la identidad la da la muestra de color al lado.
- Cifras grandes sin `tabular-nums` (se ven sueltas); `tabular-nums` en tablas, ejes y columnas alineadas. Nota: `MetricCard` hoy aplica `tabular-nums` al valor; se respeta el componente.

## Bullet (barra contra meta)

Escala `max(1, valor, meta, proyección) × 1.02`, para que la marca de meta nunca toque el borde. Capas, de atrás hacia adelante:

| Capa | Clase | Significado |
|---|---|---|
| Pista | `bg-neutral-100` | 0 → escala |
| Proyección (solo período en curso) | `bg-blue-300` | a dónde llega al ritmo actual |
| Logrado | `bg-blue-600` | lo real |
| Hoy tocaba (solo en curso y con meta) | `bg-neutral-500` + `ring-2 ring-white`, 4 px | meta × fracción transcurrida |
| Meta | `bg-neutral-900`, 2–4 px, sobresale `-inset-y-1.5` | la meta |

Debajo, leyenda con muestra + texto + valor (`Vendido US$ …`), y un
`role="img"` con `aria-label` que dice las cuatro cifras. En filas de
ranking la barra es `aria-hidden` porque el valor y el % están en texto.

## Línea acumulada vs. ritmo

- Una sola escala (misma unidad para todas las series).
- Series: real (`stroke-blue-600`, área 10 %), ritmo necesario (punteada neutral), mismo período anterior (serie de contexto), proyección (tramo punteado del último real al cierre).
- El ritmo se reparte **por días hábiles**, no por días calendario (`serieAcumulada` en `acumulado.ts`).
- Crosshair vertical que se ajusta al día más cercano; tooltip con todas las series del día; valor en negrita y nombre de la serie en gris.
- `viewBox` con el ancho real medido (`ResizeObserver`) para que el texto mida 11 px también en celular; por debajo de ~480 px menos marcas en X y etiquetas de meta/proyección solo en la leyenda.

## Color

| Trabajo | Clases | Regla |
|---|---|---|
| Serie principal / énfasis | `blue-600` | lo que importa en el color de acento; el resto en gris o tono claro |
| Contexto / secundaria | `blue-300`/`blue-400` o `neutral-400` | ver contraste abajo |
| Magnitud (secuencial) | una sola tonalidad, `blue-100` → `blue-700` | nunca arcoíris |
| Estado | `emerald` (bien), `amber` (atención), `red` (mal), `neutral` (sin dato) vía `StatusBadge`/`MetricCard tone` | **siempre con texto**; nunca para identificar una serie |
| Referencia (meta, ritmo) | `neutral-900`, `neutral-500` | marcas, no relleno |

Contraste de marcas: objetivo ≥ 3:1 contra el blanco. Aproximación propia con
los valores publicados de Tailwind v4 (no medido en pantalla): `blue-300` ≈ 1.8:1,
`blue-400` ≈ 2.7:1, `blue-500` ≈ 3.7:1, `neutral-400` ≈ 2.6:1, `neutral-500` ≈ 4.7:1.
Una serie por debajo de 3:1 solo es aceptable si sus valores también están en
texto (leyenda con valor, etiqueta directa o tabla "Ver datos"). Texto: 4.5:1;
evitar `text-neutral-400` para texto que hay que leer.

Máximo 3–4 series distinguidas por color; más, se agrupan en "Otros" o se pasa
a tabla. El color sigue a la entidad, no a su posición en el ranking.

## Interacción y accesibilidad

- Tooltip con puntero, **toque** (el día tocado queda visible al soltar) y **teclado** (flechas, `Escape`); `tabIndex={0}` y foco visible en el SVG.
- `aria-label` del SVG con un resumen en una frase; anuncio `aria-live="polite"` solo al recorrer con teclado.
- Todo gráfico tiene su tabla en `<details>` "Ver datos". El tooltip mejora, nunca es la única vía.
- `touch-pan-y` para no bloquear el desplazamiento vertical en celular.
- Respetar `prefers-reduced-motion` (`motion-reduce:transition-none`).
