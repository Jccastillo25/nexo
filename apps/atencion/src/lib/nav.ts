import type { NexoNavItem } from "@nexo/ui";

/**
 * Navegación interna del módulo, con la regla de menú de la suite
 * (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"): Inicio suelto y el
 * resto en grupos desplegables con icono. Métricas, Reportes y
 * Configuración solo aparecen con su permiso (ver (app)/layout.tsx).
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
  const analisis: NexoNavItem[] = [
    ...(puedeMisMetricas || puedeReportes ? [{ label: "Mis métricas", href: "/metricas", icon: "clock" as const }] : []),
    ...(puedeReportes ? [{ label: "Reportes", href: "/reportes", icon: "list" as const }] : []),
  ];
  return [
    { label: "Inicio", href: "/dashboard", icon: "grid" },
    { label: "Atención", icon: "users", children: [{ label: "Atender", href: "/atender", icon: "chat" }] },
    ...(analisis.length ? [{ label: "Análisis", icon: "chart" as const, children: analisis }] : []),
    ...(puedeConfigurar
      ? [
          {
            label: "Configuración",
            icon: "settings" as const,
            children: [{ label: "Puestos y pantallas", href: "/configuracion", icon: "monitor" as const }],
          },
        ]
      : []),
  ];
}
