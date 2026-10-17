import type { NexoNavItem } from "@nexo/ui";
import type { Permisos } from "@/lib/permisos";

/**
 * Navegación interna del módulo, en el orden del prototipo aprobado
 * (Productos / Configuración / Siguiente módulo). Cada entrada aparece solo
 * con su permiso (ver (app)/layout.tsx). Bajo el basePath /productos:
 * /catalogo es el listado (evita la ruta /productos/productos).
 */
export function productosNav(p: Permisos): NexoNavItem[] {
  const productos: NexoNavItem[] = [
    ...(p.dashboard ? [{ label: "Dashboard", href: "/dashboard", icon: "grid" as const }] : []),
    { label: "Productos", href: "/catalogo", icon: "box" },
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
    { ...productos[0], section: "Productos" },
    ...productos.slice(1),
    { ...configuracion[0], section: "Configuración" },
    ...configuracion.slice(1),
    // Sin href: NexoSidebar lo muestra deshabilitado con "Pronto".
    { label: "Listas de precios", icon: "price", section: "Siguiente módulo" },
  ];
}
