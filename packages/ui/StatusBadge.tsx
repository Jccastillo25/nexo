// Badge de estado — reemplaza los "pill" de estado que cada pantalla armaba
// a mano (ej. "Contrato activo" en expedientes/page.tsx). Un solo lugar
// para la paleta semantica (verde=positivo, ambar=atencion, rojo=negativo,
// neutral=informativo/sin dato), tema claro (Nexo Enterprise UI).
export type StatusTone = "neutral" | "positive" | "warning" | "negative" | "info";

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-neutral-100 text-neutral-600",
  positive: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  negative: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
