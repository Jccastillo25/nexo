// Registro de iconos por nombre (no por referencia a componente) para
// NexoSidebar — mismo motivo que el registro original de Sidebar.tsx (ahora
// retirado): los items normalmente se arman en un Server Component (el
// (app)/layout.tsx de cada modulo, donde vive el chequeo de permisos), y
// Next.js no permite pasar una referencia a funcion/componente como prop de
// Server a Client Component. Con una clave de texto el dato sigue siendo
// serializable; NexoSidebar (client) resuelve el icono real aca adentro.
//
// Set aditivo respecto al de Sidebar.tsx (grid/users/folder/settings/chat/
// clock/cash/calendar se mantienen con el mismo trazo) mas los nuevos que
// necesita el arbol de navegacion de Nexo Enterprise UI.
const ICONS = {
  grid: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1.3" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" />
    </>
  ),
  users: (
    <>
      <circle cx="7" cy="7" r="2.4" />
      <path d="M2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" />
      <circle cx="14.3" cy="7.7" r="2" />
      <path d="M12.7 16c.1-2.1 1.7-3.7 4.1-3.7" />
    </>
  ),
  folder: <path d="M3 5.5h4.5l1.5 2H17v8.5H3V5.5Z" />,
  settings: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.7v2.1M10 15.2v2.1M17.3 10h-2.1M4.8 10H2.7M15 5l-1.5 1.5M6.5 13.5 5 15M15 15l-1.5-1.5M6.5 6.5 5 5" />
    </>
  ),
  chat: <path d="M3 4.5h14v9H8l-3.5 3v-3H3v-9Z" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.8 2.2" strokeLinecap="round" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="15" height="9" rx="1.5" />
      <circle cx="10" cy="10.5" r="2.2" />
      <path d="M5.5 8v0M14.5 13v0" strokeLinecap="round" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M6.5 2.8v3M13.5 2.8v3" strokeLinecap="round" />
    </>
  ),
  // Nuevos para el arbol de Nexo Enterprise UI (2026-09-07).
  file: (
    <>
      <path d="M5 2.8h6l4 4v9.4H5V2.8Z" />
      <path d="M11 2.8v4h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2.5" y="6.5" width="15" height="9.5" rx="1.5" />
      <path d="M7 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 5v1.5" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3.2 2.8 16h14.4L10 3.2Z" strokeLinejoin="round" />
      <path d="M10 8.2v3.4" strokeLinecap="round" />
      <path d="M10 14v0" strokeLinecap="round" />
    </>
  ),
  shield: (
    <path d="M10 2.5 16 5v4.5c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8V5l6-2.5Z" strokeLinejoin="round" />
  ),
  receipt: (
    <>
      <path d="M5 3h10v14l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3L7 15.7 5 17V3Z" strokeLinejoin="round" />
      <path d="M7.5 7h5M7.5 10h5" strokeLinecap="round" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
      <circle cx="8" cy="5" r="1.6" />
      <circle cx="13" cy="10" r="1.6" />
      <circle cx="6.5" cy="15" r="1.6" />
    </>
  ),
  list: <path d="M4 5.5h12M4 10h12M4 14.5h12" strokeLinecap="round" />,
  truck: (
    <>
      <rect x="2.5" y="6" width="9" height="7" rx="1" />
      <path d="M11.5 8.5H15l2.5 2.5V13h-6V8.5Z" strokeLinejoin="round" />
      <circle cx="6" cy="14.5" r="1.4" />
      <circle cx="14.3" cy="14.5" r="1.4" />
    </>
  ),
  factory: (
    <>
      <path d="M3 16.5V9l4 2.3V9l4 2.3V7.5h6v9H3Z" strokeLinejoin="round" />
      <path d="M13 4.5v2M15.5 4.5v2" strokeLinecap="round" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2.8" width="8" height="14.2" rx="0.8" />
      <path d="M6.3 5.5h1M9.7 5.5h1M6.3 8.5h1M9.7 8.5h1M6.3 11.5h1M9.7 11.5h1" strokeLinecap="round" />
    </>
  ),
} as const;

export type NexoIconName = keyof typeof ICONS;

export function NexoIcon({
  name,
  className = "h-5 w-5",
}: {
  name?: NexoIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name ?? "grid"]}
    </svg>
  );
}
