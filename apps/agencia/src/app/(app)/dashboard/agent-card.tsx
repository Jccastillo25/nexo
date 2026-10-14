import { StatusBadge } from "@nexo/ui";
import type { StatusTone } from "@nexo/ui";

/**
 * Tarjeta de agente de IA — presentación pura, sin acciones (ticket #13,
 * etapa 3). Muestra el estado actual y los tickets asignados. Si no tiene
 * tickets, muestra un texto explícito de estado vacío.
 */
export function AgentCard({
  name,
  role,
  statusLabel,
  statusTone,
  assignedTitles,
}: {
  name: string;
  role: string;
  statusLabel: string;
  statusTone: StatusTone;
  assignedTitles: readonly string[];
}) {
  return (
    <article className="flex h-full min-w-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold text-neutral-900">
          {name}
        </h3>
        <StatusBadge label={statusLabel} tone={statusTone} />
      </div>
      <p className="text-xs text-neutral-600">{role}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Tickets asignados
      </p>
      {assignedTitles.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {assignedTitles.map((title) => (
            <li key={title} className="break-words text-sm text-neutral-800">
              {title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500">Sin tickets asignados.</p>
      )}
    </article>
  );
}
