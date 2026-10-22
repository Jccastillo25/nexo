// Gráficos del módulo en SVG/CSS propios (sin librería): barras de 12 meses
// con marca de meta, anillo de cumplimiento y barras con marca de meta.
// Colores de la escala de la suite (blue/neutral/emerald/amber/red); cada
// gráfico tiene nombre accesible y una tabla equivalente en "Ver datos".
// Sin estado: sirven en Server Components.
import { cumplimiento, estadoCumplimiento, pct, usd, usdCompacto } from "@/lib/metas/formato";
import { capitalizar, mesCorto, nombreMes } from "@/lib/metas/periodo";
import type { SerieMes } from "@/lib/metas/tipos";
import type { StatusTone } from "@nexo/ui";

const TRAZO: Record<StatusTone, string> = {
  positive: "stroke-emerald-500",
  warning: "stroke-amber-500",
  negative: "stroke-red-500",
  neutral: "stroke-neutral-300",
  info: "stroke-blue-500",
};

const RELLENO: Record<StatusTone, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  negative: "bg-red-500",
  neutral: "bg-neutral-300",
  info: "bg-blue-500",
};

function pasoRedondo(max: number): number {
  const bruto = max / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / magnitud;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitud;
}

/** Barras de lo vendido por mes con una marca horizontal en la meta de cada mes. */
export function GraficoMensual({
  titulo,
  serie,
  etiquetaMeta = "Meta",
  mesResaltado,
}: {
  titulo: string;
  serie: SerieMes[];
  etiquetaMeta?: string;
  mesResaltado?: number;
}) {
  const W = 640;
  const H = 240;
  const izq = 72;
  const der = 8;
  const arriba = 12;
  const abajo = 28;
  const anchoPlot = W - izq - der;
  const altoPlot = H - arriba - abajo;
  const ranura = anchoPlot / 12;
  const anchoBarra = ranura * 0.55;

  const maximo = Math.max(1, ...serie.map((s) => Math.max(Number(s.vendido_usd) || 0, Number(s.meta_usd) || 0)));
  const paso = pasoRedondo(maximo);
  const tope = Math.ceil(maximo / paso) * paso;
  const y = (v: number) => arriba + altoPlot - (v / tope) * altoPlot;
  const lineas: number[] = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) lineas.push(v);

  const totalVendido = serie.reduce((a, s) => a + (Number(s.vendido_usd) || 0), 0);
  const conMeta = serie.filter((s) => s.meta_usd !== null);
  const totalMeta = conMeta.reduce((a, s) => a + Number(s.meta_usd), 0);
  const resumen = `${titulo}. Vendido en el año: ${usd(totalVendido)}${conMeta.length ? `; ${etiquetaMeta.toLowerCase()} del año: ${usd(totalMeta)}` : `; sin ${etiquetaMeta.toLowerCase()}`}.`;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900">{titulo}</span>
        <span className="flex items-center gap-4 text-xs text-neutral-500" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Vendido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-neutral-900" /> {etiquetaMeta}
          </span>
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumen} className="h-auto w-full min-w-[480px]">
          {lineas.map((v) => (
            <g key={v}>
              <line x1={izq} x2={W - der} y1={y(v)} y2={y(v)} className="stroke-neutral-200" strokeWidth={1} />
              <text x={izq - 8} y={y(v) + 4} textAnchor="end" fontSize={11} className="fill-neutral-500">
                {v === 0 ? "0" : usdCompacto(v)}
              </text>
            </g>
          ))}
          {serie.map((s, i) => {
            const vendido = Number(s.vendido_usd) || 0;
            const x = izq + i * ranura + (ranura - anchoBarra) / 2;
            const alto = (vendido / tope) * altoPlot;
            return (
              <g key={s.mes}>
                <rect
                  x={x}
                  y={y(vendido)}
                  width={anchoBarra}
                  height={Math.max(0, alto)}
                  rx={2}
                  className={s.mes === mesResaltado ? "fill-blue-600" : "fill-blue-400"}
                />
                {s.meta_usd !== null ? (
                  <line
                    x1={x - ranura * 0.12}
                    x2={x + anchoBarra + ranura * 0.12}
                    y1={y(Number(s.meta_usd))}
                    y2={y(Number(s.meta_usd))}
                    className="stroke-neutral-900"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                ) : null}
                <text
                  x={izq + i * ranura + ranura / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  className={s.mes === mesResaltado ? "fill-neutral-900 font-semibold" : "fill-neutral-500"}
                >
                  {mesCorto(s.mes)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm text-xs font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Ver datos
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className="px-2 py-1.5">Mes</th>
                <th scope="col" className="px-2 py-1.5 text-right">Vendido</th>
                <th scope="col" className="px-2 py-1.5 text-right">{etiquetaMeta}</th>
                <th scope="col" className="px-2 py-1.5 text-right">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 tabular-nums">
              {serie.map((s) => (
                <tr key={s.mes}>
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">{capitalizar(nombreMes(s.mes))}</th>
                  <td className="px-2 py-1.5 text-right">{usd(s.vendido_usd)}</td>
                  <td className="px-2 py-1.5 text-right">{s.meta_usd === null ? "—" : usd(s.meta_usd)}</td>
                  <td className="px-2 py-1.5 text-right">{pct(cumplimiento(Number(s.vendido_usd), s.meta_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Anillo de cumplimiento (vendido / meta). El arco se llena hasta el 100 %; el texto muestra el valor real. */
export function Anillo({ fraccion, etiqueta }: { fraccion: number | null; etiqueta: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const lleno = Math.min(Math.max(fraccion ?? 0, 0), 1);
  const { tone, label } = estadoCumplimiento(fraccion);
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${etiqueta}: ${pct(fraccion)} (${label})`} className="h-36 w-36 shrink-0">
      <circle cx={60} cy={60} r={r} fill="none" strokeWidth={12} className="stroke-neutral-200" />
      <circle
        cx={60}
        cy={60}
        r={r}
        fill="none"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${c * lleno} ${c}`}
        transform="rotate(-90 60 60)"
        className={TRAZO[tone]}
      />
      <text x={60} y={64} textAnchor="middle" fontSize={22} className="fill-neutral-900 font-semibold tabular-nums">
        {pct(fraccion)}
      </text>
      <text x={60} y={82} textAnchor="middle" fontSize={10} className="fill-neutral-500">
        de la meta
      </text>
    </svg>
  );
}

/** Barra de lo vendido con una marca vertical en la meta. */
export function BarraMeta({ vendido, meta, etiqueta }: { vendido: number; meta: number; etiqueta: string }) {
  const escala = Math.max(meta, vendido, 1);
  const fraccion = cumplimiento(vendido, meta);
  const { tone } = estadoCumplimiento(fraccion);
  const diferencia = meta - vendido;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={Math.round(escala)}
        aria-valuenow={Math.round(vendido)}
        aria-valuetext={`${usd(vendido)} de ${usd(meta)} (${pct(fraccion)})`}
        className="relative h-3 w-full rounded-full bg-neutral-200"
      >
        <div className={`h-3 rounded-full ${RELLENO[tone]}`} style={{ width: `${(Math.max(vendido, 0) / escala) * 100}%` }} />
        <div
          aria-hidden="true"
          className="absolute -top-1 h-5 w-0.5 rounded bg-neutral-900"
          style={{ left: `calc(${(meta / escala) * 100}% - 1px)` }}
        />
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
        <span className="tabular-nums">
          {usd(vendido)} de {usd(meta)}
        </span>
        <span className="tabular-nums">
          {diferencia > 0 ? `Faltan ${usd(diferencia)}` : `Meta superada por ${usd(-diferencia)}`}
        </span>
      </p>
    </div>
  );
}

/** Barra pequeña para tablas: escala hasta 125 % con marca en el 100 %. Decorativa (el % va en su columna). */
export function MiniBarra({ fraccion }: { fraccion: number | null }) {
  if (fraccion === null) return <span className="text-xs text-neutral-500">—</span>;
  const { tone } = estadoCumplimiento(fraccion);
  return (
    <div aria-hidden="true" className="relative h-2 w-28 rounded-full bg-neutral-200">
      <div className={`h-2 rounded-full ${RELLENO[tone]}`} style={{ width: `${(Math.min(Math.max(fraccion, 0), 1.25) / 1.25) * 100}%` }} />
      <div className="absolute -top-0.5 h-3 w-0.5 bg-neutral-900" style={{ left: "80%" }} />
    </div>
  );
}
