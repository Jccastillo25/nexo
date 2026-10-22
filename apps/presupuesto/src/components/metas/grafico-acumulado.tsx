"use client";

// Venta acumulada del mes (SVG propio, sin librería): lo vendido, el ritmo
// necesario para la meta, el mismo mes del año anterior y la proyección.
// Una sola escala en US$. Crosshair con tooltip al pasar el puntero, al tocar
// o con las flechas del teclado; los mismos datos están en "Ver datos".
// El viewBox usa el ancho real del contenedor (ResizeObserver): así el texto
// mide 11 px de verdad también en un celular, en vez de escalarse a ~5 px.
import { useEffect, useId, useRef, useState } from "react";
import { usd, usdCompacto } from "@/lib/metas/formato";
import type { PuntoAcumulado } from "@/lib/metas/acumulado";

/** Ancho antes de medir (servidor y primer render). */
const ANCHO_BASE = 640;
const ANCHO_MIN = 280;
/** Por debajo de este ancho: menos marcas en el eje X y Meta/Proyección solo en la leyenda. */
const ANCHO_ESTRECHO = 480;
const IZQ = 64;
const ARRIBA = 16;
const ABAJO = 28;

function pasoRedondo(max: number): number {
  const bruto = max / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / magnitud;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitud;
}

export function GraficoAcumulado({
  serie,
  meta,
  proyeccion,
  anioAnterior,
  nombreMes,
}: {
  serie: PuntoAcumulado[];
  meta: number | null;
  proyeccion: number | null;
  anioAnterior: number;
  nombreMes: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  // Solo se anuncia lo que se recorre con el teclado; el puntero no llena el lector de pantalla.
  const [anuncio, setAnuncio] = useState("");
  const [ancho, setAncho] = useState(ANCHO_BASE);
  const contenedor = useRef<HTMLDivElement>(null);
  const idAyuda = useId();

  useEffect(() => {
    const el = contenedor.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => {
      const w = Math.round(entrada.contentRect.width);
      if (w > 0) setAncho(Math.max(w, ANCHO_MIN));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const W = ancho;
  const estrecho = W < ANCHO_ESTRECHO;
  const H = estrecho ? 220 : 260;
  const DER = estrecho ? 16 : 84;

  const n = serie.length;
  const ultimoReal = [...serie].reverse().find((p) => p.real !== null) ?? null;
  const conProyeccion = proyeccion !== null && ultimoReal !== null && ultimoReal.dia < n;

  const maximo = Math.max(
    1,
    meta ?? 0,
    proyeccion ?? 0,
    ...serie.map((p) => Math.max(p.real ?? 0, p.anterior)),
  );
  const paso = pasoRedondo(maximo);
  const tope = Math.ceil(maximo / paso) * paso;
  const anchoPlot = W - IZQ - DER;
  const altoPlot = H - ARRIBA - ABAJO;
  const x = (dia: number) => IZQ + (n <= 1 ? 0 : ((dia - 1) / (n - 1)) * anchoPlot);
  const y = (v: number) => ARRIBA + altoPlot - (v / tope) * altoPlot;
  const lineas: number[] = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) lineas.push(v);

  const camino = (puntos: [number, number][]) => puntos.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const reales = serie.filter((p) => p.real !== null).map((p) => [x(p.dia), y(p.real!)] as [number, number]);
  const esperados = serie.filter((p) => p.esperado !== null).map((p) => [x(p.dia), y(p.esperado!)] as [number, number]);
  const anteriores = serie.map((p) => [x(p.dia), y(p.anterior)] as [number, number]);
  const area = reales.length > 1 ? `${camino(reales)}L${reales[reales.length - 1][0].toFixed(1)},${y(0)}L${reales[0][0].toFixed(1)},${y(0)}Z` : null;

  const marcasX = (estrecho ? [1, 10, 20, n] : [1, 5, 10, 15, 20, 25, n]).filter(
    (d, i, a) => d <= n && a.indexOf(d) === i && !((d === 25 || d === 20) && n - d < 3),
  );
  const p = activo === null ? null : serie[activo - 1];
  const resumen = `Venta acumulada de ${nombreMes}: ${ultimoReal ? `${usd(ultimoReal.real)} al día ${ultimoReal.dia}` : "sin ventas todavía"}${
    meta !== null ? `; meta ${usd(meta)}` : ""
  }${proyeccion !== null ? `; proyección al cierre ${usd(proyeccion)}` : ""}.`;

  const textoDia = (d: PuntoAcumulado) =>
    `Día ${d.dia} de ${nombreMes}: vendido ${d.real === null ? "sin datos" : usd(d.real)}${
      d.esperado !== null ? `; ritmo para la meta ${usd(d.esperado)}` : ""
    }; ${anioAnterior}: ${usd(d.anterior)}.`;

  const elegir = (clientX: number, rect: DOMRect) => {
    if (n === 0 || rect.width === 0) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const dia = Math.round(((px - IZQ) / anchoPlot) * (n - 1)) + 1;
    setActivo(Math.min(Math.max(dia, 1), n));
  };

  const leyenda: { clase: string; texto: string; valor?: string; trazo?: boolean }[] = [
    { clase: "bg-blue-600", texto: "Vendido" },
    ...(meta !== null
      ? [{ clase: "border-t-2 border-dashed border-neutral-500", texto: "Ritmo para la meta", valor: estrecho ? `meta ${usdCompacto(meta)}` : undefined, trazo: true }]
      : []),
    { clase: "bg-blue-300", texto: `${nombreMes} ${anioAnterior}` },
    ...(conProyeccion
      ? [{ clase: "border-t-2 border-dotted border-blue-600", texto: "Proyección", valor: estrecho ? usdCompacto(proyeccion!) : undefined, trazo: true }]
      : []),
  ];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
        {leyenda.map((l) => (
          <span key={l.texto} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={l.trazo ? `inline-block w-4 ${l.clase}` : `inline-block h-0.5 w-4 rounded ${l.clase}`} />
            {l.texto}
            {l.valor ? <span className="font-semibold tabular-nums text-neutral-800">{l.valor}</span> : null}
          </span>
        ))}
      </figcaption>
      <div ref={contenedor} className="relative">
        <span id={idAyuda} className="sr-only">
          Usa las flechas izquierda y derecha para recorrer los días.
        </span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={resumen}
          aria-describedby={idAyuda}
          tabIndex={0}
          className="h-auto w-full touch-pan-y rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onPointerDown={(e) => elegir(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerMove={(e) => elegir(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={(e) => {
            // Con el dedo, pointerleave llega al soltar: el día tocado queda a la vista.
            if (e.pointerType !== "touch") setActivo(null);
          }}
          onBlur={() => setActivo(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              if (n === 0) return;
              const base = activo ?? (ultimoReal?.dia || 1);
              const dia = Math.min(Math.max(base + (e.key === "ArrowRight" ? 1 : -1), 1), n);
              setActivo(dia);
              setAnuncio(textoDia(serie[dia - 1]));
            } else if (e.key === "Escape") {
              setActivo(null);
              setAnuncio("");
            }
          }}
        >
          {lineas.map((v) => (
            <g key={v}>
              <line x1={IZQ} x2={W - DER} y1={y(v)} y2={y(v)} className="stroke-neutral-200" strokeWidth={1} />
              <text x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-neutral-500 tabular-nums">
                {v === 0 ? "0" : usdCompacto(v)}
              </text>
            </g>
          ))}
          {marcasX.map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize={11} className="fill-neutral-500 tabular-nums">
              {d}
            </text>
          ))}

          <path d={camino(anteriores)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-blue-300" />
          {esperados.length > 1 ? (
            <path d={camino(esperados)} fill="none" strokeWidth={1.5} strokeDasharray="5 4" className="stroke-neutral-500" />
          ) : null}
          {area ? <path d={area} className="fill-blue-600/10" /> : null}
          {reales.length > 1 ? (
            <path d={camino(reales)} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-blue-600" />
          ) : null}
          {conProyeccion ? (
            <path
              d={camino([[x(ultimoReal!.dia), y(ultimoReal!.real!)], [x(n), y(proyeccion!)]])}
              fill="none"
              strokeWidth={2}
              strokeDasharray="2 4"
              strokeLinecap="round"
              className="stroke-blue-600"
            />
          ) : null}

          {meta !== null && !estrecho ? (
            <text x={W - DER + 8} y={y(meta) - 2} fontSize={11} className="fill-neutral-700">
              <tspan x={W - DER + 8} className="font-semibold">Meta</tspan>
              <tspan x={W - DER + 8} dy={13}>{usdCompacto(meta)}</tspan>
            </text>
          ) : null}
          {conProyeccion && !estrecho && (meta === null || Math.abs(y(proyeccion!) - y(meta)) > 30) ? (
            <text x={W - DER + 8} y={y(proyeccion!) - 2} fontSize={11} className="fill-blue-700">
              <tspan x={W - DER + 8} className="font-semibold">Proyección</tspan>
              <tspan x={W - DER + 8} dy={13}>{usdCompacto(proyeccion!)}</tspan>
            </text>
          ) : null}
          {ultimoReal ? (
            <circle cx={x(ultimoReal.dia)} cy={y(ultimoReal.real!)} r={5} strokeWidth={2} className="fill-blue-600 stroke-white" />
          ) : null}

          {p ? (
            <g aria-hidden="true">
              <line x1={x(p.dia)} x2={x(p.dia)} y1={ARRIBA} y2={y(0)} strokeWidth={1} className="stroke-neutral-400" />
              {p.real !== null ? <circle cx={x(p.dia)} cy={y(p.real)} r={4} strokeWidth={2} className="fill-blue-600 stroke-white" /> : null}
            </g>
          ) : null}
        </svg>

        {/* Visual: el lector de pantalla recibe lo mismo por la región de abajo (teclado) o en "Ver datos". */}
        {p ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-2 z-10 min-w-44 max-w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md ${
              estrecho ? "left-1/2 -translate-x-1/2" : ""
            }`}
            style={
              estrecho
                ? undefined
                : x(p.dia) > W / 2
                  ? { right: `${((W - x(p.dia)) / W) * 100 + 2}%` }
                  : { left: `${(x(p.dia) / W) * 100 + 2}%` }
            }
          >
            <p className="font-semibold text-neutral-900">
              Día {p.dia} de {nombreMes}
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-neutral-500">Vendido</dt>
              <dd className="text-right font-semibold tabular-nums text-neutral-900">{p.real === null ? "Sin datos" : usd(p.real)}</dd>
              {p.esperado !== null ? (
                <>
                  <dt className="text-neutral-500">Ritmo para la meta</dt>
                  <dd className="text-right tabular-nums text-neutral-700">{usd(p.esperado)}</dd>
                </>
              ) : null}
              <dt className="text-neutral-500">{anioAnterior}</dt>
              <dd className="text-right tabular-nums text-neutral-700">{usd(p.anterior)}</dd>
            </dl>
          </div>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {anuncio}
        </p>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm text-xs font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Ver datos
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className="px-2 py-1.5">Día</th>
                <th scope="col" className="px-2 py-1.5 text-right">Vendido acumulado</th>
                <th scope="col" className="px-2 py-1.5 text-right">Ritmo para la meta</th>
                <th scope="col" className="px-2 py-1.5 text-right">{anioAnterior}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 tabular-nums">
              {serie.map((d) => (
                <tr key={d.dia}>
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">{d.dia}</th>
                  <td className="px-2 py-1.5 text-right">{d.real === null ? "—" : usd(d.real)}</td>
                  <td className="px-2 py-1.5 text-right">{d.esperado === null ? "—" : usd(d.esperado)}</td>
                  <td className="px-2 py-1.5 text-right">{usd(d.anterior)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
