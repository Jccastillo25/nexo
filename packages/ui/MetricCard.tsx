// Tile de KPI — sustituye a StatCard (tema oscuro/glass, retirado con el
// rediseño Nexo Enterprise UI de 2026-09-07). Mismo rol ("KPI tile" de
// Fiori/Odoo, ver docs/planning/DISENO_UX_UI.md), tema claro. Unifica lo
// que hasta esta fecha existia por separado en RRHH (StatCard), CRM
// (StatCard local del dashboard) y Flotilla (StatCard local propio, fuera
// de alcance de este rediseño por no estar todavia en Multi-Zones/
// @nexo/ui).
//
// No es "use client": sin estado ni interactividad, usable directo desde
// un Server Component (dashboards de Nexo/RRHH/CRM).
export interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** Tono semantico opcional para el valor — default neutral (texto
   * oscuro). "pending" es el que corresponde a un KPI que todavia no tiene
   * fuente de datos real (ver regla "cero datos mock" del rediseño). */
  tone?: "neutral" | "positive" | "warning" | "negative" | "pending";
  icon?: React.ReactNode;
}

const VALUE_TONE: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "text-neutral-900",
  positive: "text-emerald-600",
  warning: "text-amber-600",
  negative: "text-red-600",
  pending: "text-neutral-400",
};

export function MetricCard({ label, value, hint, tone = "neutral", icon }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        {icon && <span className="text-neutral-300">{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${VALUE_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
