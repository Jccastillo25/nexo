import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion del propio panel Nexo (apps/nexo) — reconciliacion
 * de navegacion 2026-09-14 (ver docs/status-log/). Antes este arbol
 * tambien listaba RRHH/CRM/Transporte/Fabricacion como items de sidebar,
 * lo que lo convertia en un "sidebar global con las apps" — decision
 * vigente del usuario: el sidebar de cada app (incluido Nexo) navega
 * unicamente DENTRO de esa app. Saltar a otra app es una accion del
 * Launcher (la grilla de "/", ver (app)/page.tsx), no un link persistente
 * de sidebar — por eso este arbol ahora solo tiene las paginas propias de
 * apps/nexo: el Launcher mismo y su Configuracion.
 */
export const NEXO_NAV_ITEMS: NexoNavItem[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "Configuración", href: "/configuracion/marca", icon: "settings" },
];
