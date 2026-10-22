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
// necesita el arbol de navegacion de Nexo Enterprise UI. Los componentes del
// kit (Alert, EmptyState, MetricCard, Pagination...) tambien sacan sus iconos
// de aca: un solo trazo para toda la suite.
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
  // Productos (2026-10-16): catálogo, importación y catálogos de configuración.
  box: (
    <>
      <path d="M17 6.5 10 2.8 3 6.5v7l7 3.7 7-3.7v-7Z" />
      <path d="m3 6.5 7 3.7 7-3.7M10 10.2v7" />
    </>
  ),
  upload: <path d="M10 12.5V3m0 0L6 7m4-4 4 4M3.5 12.5v2.7A1.8 1.8 0 0 0 5.3 17h9.4a1.8 1.8 0 0 0 1.8-1.8v-2.7" />,
  tree: (
    <>
      <rect x="2.8" y="2.8" width="5" height="5" rx="1" />
      <rect x="12.2" y="7.5" width="5" height="4.5" rx="1" />
      <rect x="12.2" y="14" width="5" height="3.2" rx="0.8" />
      <path d="M5.3 7.8v7.6a1.6 1.6 0 0 0 1.6 1.6h5.3M5.3 9.8h6.9" />
    </>
  ),
  tag: (
    <>
      <path d="M16.9 11.1 11.1 16.9a1.6 1.6 0 0 1-2.3 0L2.8 10.9V2.8h8.1l6 6a1.6 1.6 0 0 1 0 2.3Z" />
      <circle cx="6.6" cy="6.6" r="1.2" />
    </>
  ),
  ruler: (
    <>
      <path d="M2.8 14.2 14.2 2.8l3 3L5.8 17.2l-3-3Z" />
      <path d="m6.2 10.8 1.6 1.6M9 8l1.6 1.6M11.8 5.2l1.6 1.6" />
    </>
  ),
  book: (
    <>
      <path d="M3.5 3.5h9.3a3.2 3.2 0 0 1 3.2 3.2v9.8H6.7a3.2 3.2 0 0 1-3.2-3.2V3.5Z" />
      <path d="M6.8 7h6M6.8 10.2h4.6" />
    </>
  ),
  price: <path d="M10 2.5v15M14 5.3H8.3a2.7 2.7 0 0 0 0 5.4h3.4a2.7 2.7 0 0 1 0 5.4H5.6" />,
  // Menú desplegable en todas las apps (2026-10-17): análisis, metas y kioscos.
  chart: (
    <>
      <path d="M3 3v14h14" />
      <path d="M6.5 13.5V10M10 13.5V6.5M13.5 13.5V9" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.6" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.8" y="3.5" width="14.4" height="10" rx="1.3" />
      <path d="M7 17h6M10 13.5V17" />
    </>
  ),
  // Embudo comercial del CRM (2026-10-20): oportunidades y tipos de actividad.
  funnel: <path d="M3 3.5h14l-5.3 6.6v5.6l-3.4 1.8v-7.4L3 3.5Z" />,
  phone: (
    <path d="M6.6 3H4.4A1.4 1.4 0 0 0 3 4.5C3.3 11 9 16.7 15.5 17a1.4 1.4 0 0 0 1.5-1.4v-2.2a1 1 0 0 0-.8-1l-2.6-.6a1 1 0 0 0-1 .3l-1.1 1.2a10.6 10.6 0 0 1-4.8-4.8l1.2-1.1a1 1 0 0 0 .3-1l-.6-2.6a1 1 0 0 0-1-.8Z" />
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="m3 5.5 7 5.5 7-5.5" />
    </>
  ),
  // Nexo Enterprise UI v2 (2026-10-20): estados (Alert, Field, EmptyState),
  // navegación (PageHeader, Pagination, sidebar) y variación de KPIs.
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.5M10 6.6v0" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10.2 2 2 4-4.4" />
    </>
  ),
  "x-circle": (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m7.8 7.8 4.4 4.4M12.2 7.8l-4.4 4.4" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.4v4.4M10 13.6v0" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 11.5 5 4.5h10l2 7v4H3v-4Z" />
      <path d="M3 11.5h4l1 2h4l1-2h4" />
    </>
  ),
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m17 17-4-4" />
    </>
  ),
  x: <path d="M5 5l10 10M15 5 5 15" />,
  "chevron-left": <path d="M12.5 4.5 7 10l5.5 5.5" />,
  "chevron-right": <path d="M7.5 4.5 13 10l-5.5 5.5" />,
  "chevron-down": <path d="M4.5 7.5 10 13l5.5-5.5" />,
  "arrow-left": <path d="M16 10H4m0 0 5-5m-5 5 5 5" />,
  "trend-up": <path d="m3 14 5-5 3 3 6-6M12.5 6H17v4.5" />,
  "trend-down": <path d="m3 6 5 5 3-3 6 6M12.5 14H17V9.5" />,
  minus: <path d="M5 10h10" />,
  refresh: (
    <>
      <path d="M16.5 10A6.5 6.5 0 1 1 14.6 5.4" />
      <path d="M16.5 3.5v3.8h-3.8" />
    </>
  ),
  // 2026-10-20: pedidos por los ejecutores de la Fase 3 (botones "Nuevo …",
  // descargas, editar en filas y campos bloqueados).
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  download: <path d="M10 3v9.5m0 0-4-4m4 4 4-4M3.5 12.5v2.7A1.8 1.8 0 0 0 5.3 17h9.4a1.8 1.8 0 0 0 1.8-1.8v-2.7" />,
  pencil: <path d="M12.8 4.2 15.8 7.2 7.5 15.5H4.5v-3l8.3-8.3ZM11 6l3 3" />,
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.6" />
      <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
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
