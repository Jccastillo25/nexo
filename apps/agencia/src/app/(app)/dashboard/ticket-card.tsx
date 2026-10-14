import { StatusBadge } from "@nexo/ui";
import type { StatusTone } from "@nexo/ui";
import { ProgressBar } from "./progress-bar";

export interface TicketCardStage {
  id: string;
  name: string;
  statusLabel: string;
  statusTone: StatusTone;
  progress: number;
}

/**
 * Tarjeta de ticket — presentación pura, solo lectura (ticket #13, etapa 3).
 * Muestra responsable, estado y avance por etapa. No incluye ninguna acción
 * de crear, asignar, editar, ejecutar ni cambiar estados.
 */
export function TicketCard({
  title,
  assigneeName,
  statusLabel,
  statusTone,
  stages,
}: {
  title: string;
  assigneeName: string;
  statusLabel: string;
  statusTone: StatusTone;
  stages: readonly TicketCardStage[];
}) {
  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold text-neutral-900">
          {title}
        </h3>
        <StatusBadge label={statusLabel} tone={statusTone} />
      </div>
      <p className="text-xs text-neutral-600">
        <span className="font-medium text-neutral-700">Responsable:</span> {assigneeName}
      </p>
      {stages.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {stages.map((stage) => (
            <li key={stage.id} className="min-w-0">
              <ProgressBar
                name={stage.name}
                statusLabel={stage.statusLabel}
                statusTone={stage.statusTone}
                progress={stage.progress}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">Este ticket todavía no tiene etapas.</p>
      )}
    </article>
  );
}
