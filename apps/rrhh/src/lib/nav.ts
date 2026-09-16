import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion de RRHH — Nexo Enterprise UI (rediseño 2026-09-07).
 * Un item sin `href` (y sin `children`) se muestra deshabilitado
 * ("Próximamente") en NexoSidebar — ajuste obligatorio del rediseño: no se
 * crea una pagina placeholder por cada funcionalidad futura, solo se marca
 * en la navegacion. Documentos/Marcas/Incidencias/Justificaciones no
 * tienen pantalla real todavia (Documentos llega en Fase 4 del bloque
 * pre-F1.5 — Storage privado; Marcas/Incidencias/Justificaciones son
 * F1.5+, ver docs/RRHH_MVP.md). "Planillas" conserva su placeholder
 * historico (apps/rrhh/src/app/(app)/planillas/page.tsx).
 *
 * Fase 2 (2026-09-16, bloque pre-F1.5): "Puestos"/"Departamentos"/
 * "Catálogos" vivian como placeholders sueltos bajo "Configuración" (sin
 * href, sin pantalla) — se reubican con pantalla real bajo Contratación →
 * Catálogos (ver contratacion/catalogos/{puestos,departamentos,plantillas}),
 * que es donde el usuario los espera segun el plan aprobado. El grupo
 * "Configuración" se retira: no le quedaba ningun otro item.
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
      {
        label: "Catálogos",
        children: [
          { label: "Puestos", href: "/contratacion/catalogos/puestos" },
          { label: "Departamentos", href: "/contratacion/catalogos/departamentos" },
          { label: "Plantillas de contrato", href: "/contratacion/catalogos/plantillas" },
        ],
      },
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
];
