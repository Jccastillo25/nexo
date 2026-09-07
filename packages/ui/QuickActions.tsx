// Bloque "Acciones rápidas" de un dashboard — enlaces directos a las
// pantallas de creacion/gestion mas comunes del modulo.
import Link from "next/link";
import { NexoIcon, type NexoIconName } from "./nexo-icons";

export interface QuickAction {
  label: string;
  href: string;
  icon?: NexoIconName;
}

export interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

export function QuickActions({ title = "Acciones rápidas", actions }: QuickActionsProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 flex flex-col gap-1">
        {actions.length === 0 && (
          <p className="text-xs text-neutral-400">Sin acciones disponibles.</p>
        )}
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <NexoIcon name={a.icon} className="h-4 w-4 flex-shrink-0 text-neutral-400" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
