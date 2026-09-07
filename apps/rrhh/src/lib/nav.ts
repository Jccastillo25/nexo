import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion de RRHH — Nexo Enterprise UI (rediseño 2026-09-07).
 * Un item sin `href` (y sin `children`) se muestra deshabilitado
 * ("Próximamente") en NexoSidebar — ajuste obligatorio del rediseño: no se
 * crea una pagina placeholder por cada funcionalidad futura, solo se marca
 * en la navegacion. Documentos/Marcas/Incidencias/Justificaciones/Puestos/
 * Departamentos/Catálogos no tienen pantalla real todavia (F1.5+ o fuera
 * de alcance de este bloque — ver docs/RRHH_MVP.md). "Planillas" conserva
 * su placeholder historico (apps/rrhh/src/app/(app)/planillas/page.tsx).
 */
export const RRHH_NAV_ITEMS: NexoNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  {
    label: "Expedientes",
    icon: "folder",
    children: [
      { label: "Empleados", href: "/expedientes" },
      { label: "Documentos" },
    ],
  },
  {
    label: "Contratación",
    icon: "briefcase",
    children: [
      { label: "Contratos", href: "/contratacion/contratos" },
      { label: "Jornadas", href: "/jornadas" },
      { label: "Feriados", href: "/feriados" },
    ],
  },
  {
    label: "Asistencia",
    icon: "clock",
    children: [
      { label: "Marcas" },
      { label: "Incidencias" },
      { label: "Justificaciones" },
      { label: "Kioskos", href: "/kiosco" },
    ],
  },
  { label: "Planillas", href: "/planillas", icon: "cash" },
  {
    label: "Configuración",
    icon: "sliders",
    children: [{ label: "Puestos" }, { label: "Departamentos" }, { label: "Catálogos" }],
  },
];
