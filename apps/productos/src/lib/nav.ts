import type { NexoNavItem } from "@nexo/ui";
import type { Permisos } from "@/lib/permisos";

/**
 * Navegación interna del módulo, con la regla de menú de la suite
 * (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"): Dashboard suelto y
 * todo lo demás en grupos desplegables con icono, cada subítem con el suyo.
 * Cada entrada aparece solo con su permiso (ver (app)/layout.tsx). Bajo el
 * basePath /productos: /catalogo es el listado (evita /productos/productos).
 */
export function productosNav(p: Permisos): NexoNavItem[] {
  const catalogo: NexoNavItem[] = [
    { label: "Productos", href: "/catalogo", icon: "list" },
    ...(p.importar || p.exportar ? [{ label: "Importar y exportar", href: "/importar", icon: "upload" as const }] : []),
  ];
  const configuracion: NexoNavItem[] = [
    { label: "Clasificación", href: "/clasificacion", icon: "tree" },
    ...(p.marca ? [{ label: "Marcas", href: "/configuracion/marcas", icon: "tag" as const }] : []),
    ...(p.unidad ? [{ label: "Unidades de medida", href: "/configuracion/unidades", icon: "ruler" as const }] : []),
    ...(p.proveedor ? [{ label: "Proveedores", href: "/configuracion/proveedores", icon: "truck" as const }] : []),
    ...(p.caracteristica ? [{ label: "Características", href: "/configuracion/caracteristicas", icon: "sliders" as const }] : []),
    ...(p.contable ? [{ label: "Cuentas contables", href: "/configuracion/cuentas", icon: "book" as const }] : []),
  ];
  return [
    ...(p.dashboard ? [{ label: "Dashboard", href: "/dashboard", icon: "grid" as const }] : []),
    { label: "Catálogo", icon: "box", children: catalogo },
    // Siguiente módulo: sin href, NexoSidebar lo muestra con "Pronto". Va
    // antes de Configuración (orden de la suite: operativos → Análisis →
    // Configuración al final).
    { label: "Precios", icon: "price", children: [{ label: "Listas de precios", icon: "receipt" }] },
    { label: "Configuración", icon: "settings", children: configuracion },
  ];
}
