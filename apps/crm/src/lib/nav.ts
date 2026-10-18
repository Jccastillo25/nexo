import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion del CRM, con la regla de menú de la suite
 * (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"). Leads,
 * Oportunidades, Actividades y Cotizaciones son el alcance del CRM MVP
 * (plan 06) sin pantalla todavía: sin href, NexoSidebar los muestra con
 * "Pronto".
 */
export const CRM_NAV_ITEMS: NexoNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  {
    label: "Ventas",
    icon: "briefcase",
    children: [
      { label: "Clientes", href: "/clientes", icon: "users" },
      { label: "Leads", icon: "target" },
      { label: "Oportunidades", icon: "chart" },
      { label: "Actividades", icon: "calendar" },
      { label: "Cotizaciones", icon: "receipt" },
    ],
  },
];
