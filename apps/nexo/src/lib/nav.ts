import type { NexoNavItem } from "@nexo/ui";
import type { Permisos } from "@/lib/permisos";

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
 * Desde 2026-10-20 cada hijo de Configuración se lista solo con su permiso
 * (regla del menú lateral en CLAUDE.md): sin ninguno, el grupo queda con
 * `children: []` y NexoSidebar no lo muestra. Mostrar u ocultar un item NO
 * autoriza la ruta: la proteccion vive en el servidor.
 */
export function nexoNav(p: Permisos): NexoNavItem[] {
  const configuracion: NexoNavItem[] = [];
  if (p.marcaEditar) configuracion.push({ label: "Marca", href: "/configuracion/marca", icon: "sliders" });
  if (p.usuariosVer) configuracion.push({ label: "Usuarios", href: "/configuracion/usuarios", icon: "users" });
  if (p.rolesVer) configuracion.push({ label: "Roles", href: "/configuracion/roles", icon: "shield" });
  if (p.sucursalesVer) configuracion.push({ label: "Sucursales", href: "/configuracion/sucursales", icon: "building" });
  if (p.auditoriaVer) configuracion.push({ label: "Auditoría", href: "/configuracion/auditoria", icon: "list" });

  return [
    { label: "Inicio", href: "/", icon: "grid" },
    { label: "Configuración", icon: "settings", children: configuracion },
  ];
}
