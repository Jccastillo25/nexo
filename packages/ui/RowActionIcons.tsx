"use client";

// Columna de acciones VISIBLE de una fila (reemplaza, donde corresponde, al
// menu "⋯" de RowActionsMenu — regla obligatoria 2026-09-08: las acciones
// principales de una fila no deben quedar ocultas dentro de un menu
// secundario, tienen que verse como iconos con tooltip/estado
// hover/foco accesible/aria-label). RowActionsMenu (⋯) se mantiene para
// acciones secundarias que sí conviene esconder; esta es la versión
// "siempre visible" para las 2-3 acciones principales de una fila
// (visualizar/editar/eliminar, ver contrato/editar, etc.).
//
// Puramente presentacional (mismo motivo que RowActionsMenu.tsx): recibe
// solo props serializables — `href` para navegacion (string, cruza la
// frontera Server→Client sin problema) u `onClick` (funcion — solo valido
// si quien arma este componente YA es un Client Component, mismo patron
// que EmpleadoRowMenu.tsx).
import Link from "next/link";

export type RowIconActionName = "eye" | "pencil" | "trash";

export interface RowIconAction {
  key: string;
  icon: RowIconActionName;
  /** Tambien se usa como tooltip (`title`) y `aria-label`. */
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Tooltip especifico cuando esta deshabilitado (ej. "tiene historial
   * contractual") — si no se pasa, se usa `label`. */
  disabledReason?: string;
  destructive?: boolean;
}

const ICONS: Record<RowIconActionName, React.ReactNode> = {
  eye: (
    <>
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.4" />
    </>
  ),
  pencil: (
    <>
      <path d="M13.5 3.5 16.5 6.5 6.5 16.5H3.5v-3L13.5 3.5Z" strokeLinejoin="round" />
      <path d="M11.8 5.2 14.8 8.2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6" strokeLinecap="round" />
      <path d="M5.5 6 6.2 16a1 1 0 0 0 1 1h5.6a1 1 0 0 0 1-1L14.5 6" strokeLinejoin="round" />
      <path d="M8.3 9v5M11.7 9v5" strokeLinecap="round" />
    </>
  ),
};

function IconGlyph({ name }: { name: RowIconActionName }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export function RowActionIcons({ actions }: { actions: RowIconAction[] }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map((action) => {
        const className = `group relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          action.disabled
            ? "cursor-not-allowed text-neutral-300"
            : action.destructive
              ? "text-red-500 hover:bg-red-50 hover:text-red-700"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        }`;
        const tooltip = action.disabled ? (action.disabledReason ?? action.label) : action.label;

        const content = <IconGlyph name={action.icon} />;

        if (action.href && !action.disabled) {
          return (
            <Link
              key={action.key}
              href={action.href}
              title={tooltip}
              aria-label={action.label}
              className={className}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={action.key}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            title={tooltip}
            aria-label={action.label}
            aria-disabled={action.disabled}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
