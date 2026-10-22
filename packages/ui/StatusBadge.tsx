// Badge de estado — reemplaza los "pill" de estado que cada pantalla armaba
// a mano (ej. "Contrato activo" en expedientes/page.tsx). Un solo lugar
// para la paleta semantica (verde=positivo, ambar=atencion, rojo=negativo,
// azul=informativo, neutral=sin dato), tema claro (Nexo Enterprise UI).
//
// v2 (2026-10-20): fondo tono-50, texto tono-700 y un punto tono-500 delante
// (el color nunca es la unica señal: la etiqueta dice el estado). El neutral
// usa fondo neutral-100 porque neutral-50 no se distingue sobre blanco.
// Misma API (label, tone); `dot={false}` quita el punto.
export type StatusTone = "neutral" | "positive" | "warning" | "negative" | "info";

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  /** Punto de color antes de la etiqueta. Por defecto, si. */
  dot?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-neutral-100 text-neutral-700 ring-neutral-500/15", dot: "bg-neutral-500" },
  positive: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  warning: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  negative: { badge: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500" },
  info: { badge: "bg-blue-50 text-blue-700 ring-blue-600/15", dot: "bg-blue-500" },
};

export function StatusBadge({ label, tone = "neutral", dot = true, className }: StatusBadgeProps) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${t.badge} ${className ?? ""}`}
    >
      {dot ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${t.dot}`} /> : null}
      {label}
    </span>
  );
}
