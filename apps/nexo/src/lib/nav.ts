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
 * Esta lista SOLO se usa dentro de (app)/layout.tsx. Tras el ticket #13
 * (etapa 3) el grupo (app) envuelve /dashboard y /configuracion/marca --
 * el item "Inicio" es la forma de volver a "/" desde ahi.
 *
 * OJO (documentacion desactualizada): el comentario historico de
 * (app)/layout.tsx afirma que "no hace falta un guard de permiso
 * adicional"; eso es cierto para /configuracion/marca, pero el
 * middleware solo AUTENTICA -- la ruta /dashboard exige ademas su propio
 * guard de autorizacion de servidor (hasPermission, fail-closed). Ver
 * docs/DASHBOARD_AGENCIA_IMPLEMENTACION.md.
 *
 * Mostrar un item en el sidebar NO autoriza la ruta: ocultarlo o mostrarlo
 * no cambia la proteccion, que vive en el servidor.
 */
export const NEXO_NAV_ITEMS: NexoNavItem[] = [
  { label: "Inicio", href: "/", icon: "grid" },
  { label: "Dashboard", href: "/dashboard", icon: "list" },
  {
    label: "Configuración",
    icon: "settings",
    children: [
      { label: "Marca", href: "/configuracion/marca", icon: "sliders" },
      { label: "Usuarios", href: "/configuracion/usuarios", icon: "users" },
      { label: "Roles", href: "/configuracion/roles", icon: "shield" },
      { label: "Auditoría", href: "/configuracion/auditoria", icon: "list" },
    ],
  },
];
