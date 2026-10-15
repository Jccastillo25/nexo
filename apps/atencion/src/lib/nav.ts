import type { NexoNavItem } from "@nexo/ui";

/**
 * Navegación interna del módulo. Métricas, Reportes y Configuración solo
 * aparecen con su permiso (ver (app)/layout.tsx).
 */
export function atencionNav({
  puedeConfigurar,
  puedeMisMetricas,
  puedeReportes,
}: {
  puedeConfigurar: boolean;
  puedeMisMetricas: boolean;
  puedeReportes: boolean;
}): NexoNavItem[] {
  return [
    { label: "Inicio", href: "/dashboard", icon: "grid" },
    { label: "Atender", href: "/atender", icon: "users" },
    ...(puedeMisMetricas || puedeReportes ? [{ label: "Mis métricas", href: "/metricas", icon: "clock" as const }] : []),
    ...(puedeReportes ? [{ label: "Reportes", href: "/reportes", icon: "list" as const }] : []),
    ...(puedeConfigurar ? [{ label: "Configuración", href: "/configuracion", icon: "settings" as const }] : []),
  ];
}
