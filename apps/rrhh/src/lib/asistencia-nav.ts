import type { NexoNavItem } from "@nexo/ui";
import type { PermisosAsistencia } from "@/lib/permisos-asistencia";

/**
 * Navegación de la app Asistencia (2026-10-17), con la regla de menú de la
 * suite (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"): Dashboard
 * suelto y todo lo demás en grupos desplegables, cada ítem con su icono.
 * Un hijo sin `href` se muestra como "Pronto". Un hijo sin permiso no se
 * lista y un grupo que queda sin hijos se omite (ocultar no protege la
 * ruta: cada página y acción vuelve a validar en el servidor).
 *
 * La terminal pública /kiosco NO va en este menú: es la pantalla de
 * marcación, no una pantalla administrativa.
 */
export function asistenciaNav(p: PermisosAsistencia): NexoNavItem[] {
  const marcaciones: NexoNavItem[] = [
    ...(p.marcasVer ? [{ label: "Marcas", href: "/asistencia/marcas", icon: "list" as const }] : []),
    ...(p.justificacionesVer ? [{ label: "Justificaciones", icon: "file" as const }] : []),
  ];
  // Reportes (2026-10-18): las incidencias y el resumen ya existen como
  // reportes, por eso salieron los "Pronto" equivalentes.
  const reportes: NexoNavItem[] = p.reportesVer
    ? [
        { label: "Asistencia diaria", href: "/asistencia/reportes/diaria", icon: "calendar" },
        { label: "Resumen por persona", href: "/asistencia/reportes/resumen", icon: "users" },
        { label: "Tardanzas y salidas", href: "/asistencia/reportes/tardanzas", icon: "clock" },
        { label: "Incidencias", href: "/asistencia/reportes/incidencias", icon: "alert" },
        { label: "Tarjeta individual", href: "/asistencia/reportes/tarjeta", icon: "file" },
      ]
    : [];
  const analisis: NexoNavItem[] = [
    ...reportes,
    ...(p.kioskosVer ? [{ label: "Envíos del kiosco", icon: "receipt" as const }] : []),
  ];
  const configuracion: NexoNavItem[] = [
    ...(p.kioskosVer ? [{ label: "Dispositivos", href: "/asistencia/dispositivos", icon: "monitor" as const }] : []),
  ];

  return [
    { label: "Dashboard", href: "/asistencia/dashboard", icon: "grid" },
    ...(marcaciones.length > 0 ? [{ label: "Marcaciones", icon: "clock" as const, children: marcaciones }] : []),
    ...(analisis.length > 0 ? [{ label: "Análisis", icon: "chart" as const, children: analisis }] : []),
    ...(configuracion.length > 0
      ? [{ label: "Configuración", icon: "settings" as const, children: configuracion }]
      : []),
  ];
}
