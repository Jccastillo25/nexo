import type { NexoNavItem } from "@nexo/ui";
import { veOrdenes, type Permisos } from "@/lib/permisos";

/**
 * Navegación interna del módulo, con la regla de menú de la suite
 * (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"): Dashboard suelto y
 * todo lo demás en grupos desplegables con icono. Cada entrada aparece solo
 * con su permiso; un hijo sin `href` se muestra como "Pronto" hasta que su
 * etapa del plan 22 exista (E3–E9). Un grupo sin hijos no se lista.
 */
export function flotillaNav(p: Permisos): NexoNavItem[] {
  const entregas: NexoNavItem[] = [
    ...(veOrdenes(p) ? [{ label: "Órdenes de entrega", icon: "list" as const }] : []),
    ...(p.ordenCrear ? [{ label: "Nueva orden", icon: "plus" as const }] : []),
    ...(p.incidenciaCrear || p.incidenciaGestionar ? [{ label: "Incidencias", icon: "alert" as const }] : []),
  ];
  const rutas: NexoNavItem[] = [
    ...(p.recorridoVer ? [{ label: "Planificador diario", icon: "calendar" as const }] : []),
    ...(p.recorridoVer ? [{ label: "Recorridos", icon: "truck" as const }] : []),
  ];
  const bodega: NexoNavItem[] = [
    ...(p.cargaPreparar || p.cargaValidar ? [{ label: "Carga y despacho", icon: "box" as const }] : []),
    ...(p.retornoConciliar || p.cobroConciliar ? [{ label: "Conciliación", icon: "check-circle" as const }] : []),
  ];
  const conductor: NexoNavItem[] = [
    ...(p.conductorOperar ? [{ label: "Mi recorrido", icon: "phone" as const }] : []),
  ];
  const analisis: NexoNavItem[] = [
    ...(p.reportesVer ? [{ label: "Reportes de entregas", icon: "chart" as const }] : []),
  ];
  const configuracion: NexoNavItem[] = [
    ...(p.vehiculoVer ? [{ label: "Vehículos", icon: "truck" as const }] : []),
    ...(p.conductoresVer ? [{ label: "Conductores", icon: "users" as const }] : []),
    ...(p.reglas ? [{ label: "Zonas y reglas de envío", icon: "sliders" as const }] : []),
  ];

  const grupos: NexoNavItem[] = [
    { label: "Entregas", icon: "receipt", children: entregas },
    { label: "Rutas", icon: "truck", children: rutas },
    { label: "Bodega", icon: "box", children: bodega },
    { label: "Conductor", icon: "phone", children: conductor },
    { label: "Análisis", icon: "chart", children: analisis },
    { label: "Configuración", icon: "settings", children: configuracion },
  ];

  return [
    ...(p.dashboard ? [{ label: "Dashboard", href: "/dashboard", icon: "grid" as const }] : []),
    ...grupos.filter((g) => (g.children?.length ?? 0) > 0),
  ];
}
