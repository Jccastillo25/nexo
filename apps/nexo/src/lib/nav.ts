import type { NexoNavItem } from "@nexo/ui";

/**
 * Arbol de navegacion del propio panel Nexo (apps/nexo) -- reconciliacion
 * de navegacion 2026-09-14, ajustado 2026-09-17 (ver docs/status-log/).
 * Antes este arbol tambien listaba RRHH/CRM/Transporte/Fabricacion como
 * items de sidebar, lo que lo convertia en un "sidebar global con las
 * apps" -- decision vigente del usuario: el sidebar de cada app (incluido
 * Nexo) navega unicamente DENTRO de esa app. Saltar a otra app es una
 * accion del Launcher (la grilla de "/", ver app/page.tsx -- desde
 * 2026-09-17 fuera del grupo (app), sin este sidebar/topbar), no un link
 * persistente de sidebar.
 *
 * Esta lista SOLO se usa dentro de (app)/layout.tsx. Agencia digital se
 * extrae a su propia app en el ticket #18 y se abre desde el Launcher;
 * /dashboard solo conserva una redirección a /agencia/dashboard.
 *
 * Mostrar un item en el sidebar NO autoriza la ruta: ocultarlo o mostrarlo
 * no cambia la proteccion, que vive en el servidor.
 */
export const NEXO_NAV_ITEMS: NexoNavItem[] = [
  { label: "Inicio", href: "/", icon: "grid" },
  { label: "Configuración", href: "/configuracion/marca", icon: "settings" },
];
