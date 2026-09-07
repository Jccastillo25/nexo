import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion del panel Nexo — Nexo Enterprise UI (rediseño
 * 2026-09-07). Transporte/Fabricación quedan sin `href` (deshabilitados,
 * "Próximamente") porque todavia no tienen rewrite de Multi-Zones en
 * next.config.ts — agregar el link antes de que exista el rewrite
 * produce un 404 real, no una demora cosmetica (ver CLAUDE.md, regla de
 * checklist de módulo nuevo).
 */
export const NEXO_NAV_ITEMS: NexoNavItem[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "RRHH", href: "/rrhh", icon: "users" },
  { label: "CRM", href: "/crm", icon: "briefcase" },
  { label: "Transporte", icon: "truck" },
  { label: "Fabricación", icon: "factory" },
  { label: "Configuración", href: "/configuracion/marca", icon: "settings" },
];
