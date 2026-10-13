import { StatusBadge } from "@nexo/ui";
import type { StatusTone } from "@nexo/ui";

/**
 * Barra de progreso de etapa — HTML/CSS propios, sin librerías (ticket #13,
 * etapa 3). El porcentaje se acompaña de una etiqueta textual explícita
 * ("75%") además del ancho de la barra, para no depender solo del color ni
 * de la longitud visual.
 */
export function ProgressBar({
  name,
  statusLabel,
  statusTone,
  progress,
}: {
  name: string;
  statusLabel: string;
  statusTone: StatusTone;
  progress: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words text-sm text-neutral-800">{name}</span>
        <StatusBadge label={statusLabel} tone={statusTone} />
        <span className="text-xs tabular-nums text-neutral-600">{`${pct}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Avance de la etapa ${name}`}
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-neutral-800"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
