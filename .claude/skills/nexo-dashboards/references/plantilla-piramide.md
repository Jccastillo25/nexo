# Plantilla de pirámide

Generalización de `apps/presupuesto/src/app/(app)/dashboard/equipo.tsx`
(aprobado por el usuario el 2026-10-20). Niveles en orden de lectura (F:
arriba a la izquierda lo más importante):

| Nivel | Contenido | Cantidad | Componente |
|---|---|---|---|
| 0 | `PageHeader` (título, período, frescura de datos) + selector de período en `actions`; pestañas por rol si aplica | 1 | `PageHeader` |
| 0b | Banners de siguiente paso (sin datos importados, sin meta) y errores de complementos | 0–2 | `Banner`/`ErrorCarga` de la app |
| 1 | **Número principal** con estado, barra contra meta y 2–3 cifras de ritmo | exactamente 1 | tarjeta propia tipo `HeroMes` |
| 2 | KPIs de segundo nivel, cada uno con comparación en `hint` | 3–5 (4 es el estándar) | `MetricCard` |
| 3 | Tendencia (acumulado vs. ritmo) + panel lateral de contexto | 1 + 1 | gráfico SVG + `section` |
| 4 | Desglose / ranking contra meta | 1 | lista con barras o `DataTable` |
| 5 | Año, metodología, detalle | plegado | `<details>` |

Total a la vista sin desplegar: 5–9 KPIs, nunca más de ~15 cifras.

## Esqueleto (ilustrativo: nombres y textos de ejemplo, no datos de producción)

```tsx
// page.tsx (Server Component): permisos y RPC en paralelo; ver nexo-react-next.
<div className="flex max-w-6xl flex-col gap-6">
  <PageHeader
    title="Avance del equipo"
    description={`${periodo} · ${frescura}`}          // "Facturas importadas hasta el dd/mm/aaaa"
    actions={<SelectorPeriodo /* periodo en la URL */ />}
  />

  {/* 1. Número principal */}
  <section className="flex flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
           aria-labelledby="hero">
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="hero" className="text-sm font-semibold text-neutral-600">{titulo}</h2>
        <StatusBadge label={estado.label} tone={estado.tone} />
      </div>
      <p className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">{valor}</p>
      <p className="text-sm text-neutral-600">{contexto /* "85 % de la meta de …" */}</p>
    </div>
    {/* barra bullet: ver formas-visuales.md */}
    <dl className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-3">{/* ritmo */}</dl>
  </section>

  {/* 2. KPIs: 1 col en celular, 2 en sm, 4 solo en xl */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard label="Vs. mismo período anterior" value={pctSigno(v)} tone={tono(v)} hint={`Mismo período: ${usd(base)}`} />
    {/* … 3 más */}
  </div>

  {/* 3. Tendencia + contexto */}
  <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm xl:col-span-2"
             aria-labelledby="tendencia">
      <h2 id="tendencia" className="text-sm font-semibold text-neutral-900">…</h2>
      <p className="text-xs text-neutral-500">Cómo leer el gráfico en una frase.</p>
      {serie ? <GraficoAcumulado /* … */ /> : <ErrorCarga mensaje={…} />}
    </section>
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">{/* panel lateral */}</section>
  </div>

  {/* 4. Desglose */}
  <section className="rounded-xl border border-neutral-200 bg-white shadow-sm" aria-labelledby="ranking">…</section>

  {/* 5. Detalle plegado */}
  <details className="group rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
    <summary className="cursor-pointer list-none rounded-sm text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">…</summary>
  </details>
</div>
```

## Reglas del layout

- **Breakpoints.** El sidebar ocupa ancho: a 1024 px (`lg`) el contenido mide bastante menos. Las 4 tarjetas pasan a 4 columnas solo en `xl`; con `lg:grid-cols-4` un monto como `US$ 1,234,567.89` en `text-3xl` se parte o desborda. Tendencia + panel lateral también en `xl`.
- **Ancho máximo** `max-w-6xl` (referencia). No estirar a pantalla completa: las barras largas pierden comparación.
- **Número principal** `text-4xl sm:text-5xl`, uno solo por vista; en `MetricCard`, `text-3xl` lo da el componente.
- **Encabezados**: un `h1` (lo da `PageHeader`); cada bloque `section` con `aria-labelledby` y su `h2`.
- **Período y frescura** siempre visibles arriba: "Datos hasta …". El período va en la URL (`searchParams`), no en estado local.
- **Filtros**: una sola fila arriba que afecta a todo lo de abajo; nunca filtros dentro de una tarjeta.
- **Vistas por rol**: pestañas con `next/link` y `aria-current="page"`, como en `presupuesto/.../dashboard/page.tsx`.
- **Acciones**: el KPI que pide acción enlaza a su pantalla (`next/link`) solo si el usuario tiene el permiso de esa pantalla.
