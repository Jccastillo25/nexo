// Bloque "Actividad reciente" de un dashboard. Regla obligatoria (rediseño
// 2026-09-07): sin fuente real todavia, se pasa `items: []` y el
// `emptyLabel` explica por que (ej. "Pendiente de integración") — nunca se
// inventan filas.
export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
}

export interface ActivityFeedProps {
  title?: string;
  items: ActivityItem[];
  emptyLabel?: string;
}

export function ActivityFeed({
  title = "Actividad reciente",
  items,
  emptyLabel = "Sin actividad registrada todavía.",
}: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 border-l-2 border-blue-100 pl-3">
              <span className="text-sm text-neutral-800">{item.title}</span>
              {item.description && (
                <span className="text-xs text-neutral-500">{item.description}</span>
              )}
              {item.timestamp && (
                <span className="text-[11px] text-neutral-400">{item.timestamp}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
