// Tile de KPI — sustituye a StatCard (tema oscuro/glass, retirado con el
// rediseño Nexo Enterprise UI de 2026-09-07). Mismo rol ("KPI tile" de
// Fiori/Odoo, ver docs/planning/DISENO_UX_UI.md), tema claro. Unifica lo
// que hasta esta fecha existia por separado en RRHH (StatCard), CRM
// (StatCard local del dashboard) y Flotilla (StatCard local propio, fuera
// de alcance de este rediseño por no estar todavia en Multi-Zones/
// @nexo/ui).
//
// v2 (2026-10-20), compatible con la API anterior (label, value, hint, tone,
// icon siguen igual):
//   - el valor siempre en neutral-900 (28px; 36px con size="hero"); `tone`
//     ya no pinta el numero entero, pinta un punto junto a la etiqueta (con
//     texto para lectores de pantalla);
//   - `delta`: comparacion con flecha y color (vs. mes anterior, vs. meta);
//   - `unit`: unidad pequeña junto al valor ("%", "días");
//   - `href`: toda la tarjeta es un enlace (next/link) con foco visible;
//   - `loading`: esqueleto en lugar del valor;
//   - tone="pending" (KPI sin fuente real, regla "cero datos mock"): "—" en
//     gris claro y "Pendiente de integración" si no se pasa `hint`.
//
// No es "use client": sin estado ni interactividad, usable directo desde
// un Server Component (dashboards de Nexo/RRHH/CRM).
import Link from "next/link";
import type { ReactNode } from "react";
import { NexoIcon, type NexoIconName } from "./nexo-icons";
import { Skeleton } from "./Skeleton";

export interface MetricCardDelta {
  /** Texto ya formateado: "12.4 %", "US$ 3,200", "+5". */
  value: string;
  direction: "up" | "down" | "flat";
  /** Por defecto: up = positive, down = negative, flat = neutral. Pasa
   * "positive" con direction "down" cuando bajar es bueno (costos, tiempos). */
  tone?: "positive" | "negative" | "neutral";
  /** Contexto de la comparacion: "vs. mes anterior", "de la meta". */
  label?: string;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: ReactNode;
  /** Tono semantico opcional — default neutral (sin punto). "pending" es el
   * que corresponde a un KPI que todavia no tiene fuente de datos real (ver
   * regla "cero datos mock" del rediseño). */
  tone?: "neutral" | "positive" | "warning" | "negative" | "pending";
  icon?: ReactNode;
  delta?: MetricCardDelta;
  unit?: string;
  /** Ruta dentro del modulo (next/link): toda la tarjeta se vuelve enlace. */
  href?: string;
  loading?: boolean;
  /** "hero" para el numero principal del dashboard. */
  size?: "md" | "hero";
}

const DOT: Partial<Record<NonNullable<MetricCardProps["tone"]>, { dot: string; text: string }>> = {
  positive: { dot: "bg-emerald-500", text: "Favorable" },
  warning: { dot: "bg-amber-500", text: "Requiere atención" },
  negative: { dot: "bg-red-500", text: "Desfavorable" },
};

const DELTA_TONE: Record<NonNullable<MetricCardDelta["tone"]>, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  negative: "bg-red-50 text-red-700",
  neutral: "bg-neutral-100 text-neutral-600",
};

const DELTA_ICON: Record<MetricCardDelta["direction"], { icon: NexoIconName; text: string }> = {
  up: { icon: "trend-up", text: "Sube" },
  down: { icon: "trend-down", text: "Baja" },
  flat: { icon: "minus", text: "Sin cambio" },
};

const CARD = "flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-white shadow-xs";

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  delta,
  unit,
  href,
  loading = false,
  size = "md",
}: MetricCardProps) {
  const dot = DOT[tone];
  const pending = tone === "pending";
  const placeholder = value === "—" || value === "";
  const hintText = hint ?? (pending ? "Pendiente de integración" : undefined);
  const valueSize = size === "hero" ? "text-4xl leading-10" : "text-[28px] leading-9";
  // Un "—" de relleno va casi invisible (el texto de abajo explica por que);
  // un texto real con tono pendiente ("Sin meta") se mantiene legible.
  const valueColor = pending ? (placeholder ? "text-neutral-300" : "text-neutral-500") : "text-neutral-900";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[13px] leading-5 font-medium text-neutral-600">
          {dot ? (
            <>
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot.dot}`} />
              <span className="sr-only">{dot.text}:</span>
            </>
          ) : null}
          <span className="min-w-0">{label}</span>
        </p>
        {icon ? (
          <span aria-hidden="true" className="shrink-0 text-neutral-400 [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
      </div>

      {loading ? (
        <>
          <Skeleton className={`mt-2 w-32 ${size === "hero" ? "h-10" : "h-9"}`} />
          <span className="sr-only">Cargando</span>
        </>
      ) : (
        <p className={`mt-2 font-semibold tracking-tight tabular-nums break-words ${valueSize} ${valueColor}`}>
          {placeholder ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">Sin dato</span>
            </>
          ) : (
            value
          )}
          {unit && !placeholder ? (
            <span className="ml-1 text-base font-medium tracking-normal text-neutral-500">{unit}</span>
          ) : null}
        </p>
      )}

      {delta && !loading ? <Delta delta={delta} /> : null}
      {hintText ? <p className="mt-1 text-xs text-neutral-500">{hintText}</p> : null}
    </>
  );

  const padding = size === "hero" ? "px-6 py-5" : "px-5 py-4";

  if (href) {
    return (
      <Link
        href={href}
        className={`${CARD} ${padding} transition-colors hover:border-neutral-300 hover:bg-neutral-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}
      >
        {body}
      </Link>
    );
  }
  return <div className={`${CARD} ${padding}`}>{body}</div>;
}

function Delta({ delta }: { delta: MetricCardDelta }) {
  const tone = delta.tone ?? (delta.direction === "up" ? "positive" : delta.direction === "down" ? "negative" : "neutral");
  const dir = DELTA_ICON[delta.direction];
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums ${DELTA_TONE[tone]}`}
      >
        <NexoIcon name={dir.icon} className="size-3.5" />
        <span className="sr-only">{dir.text}</span>
        {delta.value}
      </span>
      {delta.label ? <span className="text-neutral-500">{delta.label}</span> : null}
    </p>
  );
}
