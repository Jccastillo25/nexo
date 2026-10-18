import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion de RRHH — Nexo Enterprise UI (rediseño 2026-09-07),
 * con la regla de menú de la suite (docs/DESIGN_SYSTEM.md, "Menú lateral
 * desplegable", 2026-10-17): Dashboard suelto, todo lo demás en grupos
 * desplegables y cada subítem con su propio icono. Un item sin `href` (y
 * sin `children`) se muestra deshabilitado ("Pronto") en NexoSidebar: no se
 * crea una pagina placeholder por cada funcionalidad futura. Documentos no
 * tiene pantalla real todavia. "Planillas" conserva su placeholder
 * historico (apps/rrhh/src/app/(app)/planillas/page.tsx).
 *
 * Fase 2 (2026-09-16, bloque pre-F1.5): Puestos/Departamentos/Plantillas
 * viven con pantalla real bajo Contratación → Catálogos.
 *
 * 2026-10-17: Asistencia es una app propia (core.apps slug `asistencia`,
 * mismo deploy bajo /rrhh/asistencia, con su menú en lib/asistencia-nav.ts).
 * El grupo "Asistencia" (Marcas, Incidencias, Justificaciones y el enlace a
 * la terminal /kiosco) salió de este menú. Jornadas y Feriados se quedan
 * en Contratación porque son parte del contrato.
 */
export const RRHH_NAV_ITEMS: NexoNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  {
    label: "Expedientes",
    icon: "folder",
    children: [
      { label: "Empleados", href: "/expedientes", icon: "users" },
      { label: "Documentos", icon: "file" },
    ],
  },
  {
    label: "Contratación",
    icon: "briefcase",
    children: [
      { label: "Contratos", href: "/contratacion/contratos", icon: "file" },
      { label: "Jornadas", href: "/jornadas", icon: "clock" },
      { label: "Feriados", href: "/feriados", icon: "calendar" },
      {
        label: "Catálogos",
        icon: "list",
        children: [
          { label: "Puestos", href: "/contratacion/catalogos/puestos", icon: "briefcase" },
          { label: "Departamentos", href: "/contratacion/catalogos/departamentos", icon: "building" },
          { label: "Plantillas de contrato", href: "/contratacion/catalogos/plantillas", icon: "file" },
        ],
      },
    ],
  },
  {
    label: "Nómina",
    icon: "cash",
    children: [{ label: "Planillas", href: "/planillas", icon: "receipt" }],
  },
];
