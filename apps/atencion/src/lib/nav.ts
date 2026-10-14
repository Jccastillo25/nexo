import type { NexoNavItem } from "@nexo/ui";

/** Navegación interna del módulo. Configuración solo aparece con permiso (ver (app)/layout.tsx). */
export function atencionNav(puedeConfigurar: boolean): NexoNavItem[] {
  return [
    { label: "Inicio", href: "/dashboard", icon: "grid" },
    { label: "Atender", href: "/atender", icon: "users" },
    ...(puedeConfigurar ? [{ label: "Configuración", href: "/configuracion", icon: "settings" as const }] : []),
  ];
}
