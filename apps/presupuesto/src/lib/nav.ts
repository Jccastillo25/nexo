import type { NexoNavItem } from "@nexo/ui";
import { puedeVerPresupuesto, type Permisos } from "@/lib/metas/permisos";

/**
 * Árbol de navegación de Presupuesto, con la regla de menú de la suite
 * (docs/DESIGN_SYSTEM.md, "Menú lateral desplegable"): Dashboard suelto,
 * después los grupos operativos (Metas, Ventas), Análisis y Configuración.
 * Ver docs/plan/19-presupuesto.md §6. Cada entrada aparece solo con su
 * permiso y un grupo sin hijos no se muestra. Ocultar no protege la ruta:
 * cada página y cada RPC vuelven a validar.
 */
export function presupuestoNav(p: Permisos): NexoNavItem[] {
  // El avance (propio o del equipo) es el Dashboard: no se repite aquí.
  const metas: NexoNavItem[] = [
    ...(p.metasVend ? [{ label: "Metas por vendedor", href: "/metas/por-vendedor", icon: "target" as const }] : []),
    ...(puedeVerPresupuesto(p) ? [{ label: "Presupuesto anual", href: "/anual", icon: "calendar" as const }] : []),
  ];
  const ventas: NexoNavItem[] = [
    ...(p.facturas
      ? [{ label: "Facturas", href: "/facturas", icon: "file" as const }]
      : p.misFacturas
        ? [{ label: "Mis facturas", href: "/facturas", icon: "file" as const }]
        : []),
    // Clientes (todos) o Mis clientes (solo los del vendedor vinculado).
    ...(p.facturas
      ? [{ label: "Clientes", href: "/clientes", icon: "building" as const }]
      : p.misFacturas
        ? [{ label: "Mis clientes", href: "/clientes", icon: "building" as const }]
        : []),
    ...(p.importar ? [{ label: "Importar de AG Negocio", href: "/importar", icon: "upload" as const }] : []),
  ];
  // Sin href: el sidebar lo muestra como "Pronto" (no hay página placeholder).
  const analisis: NexoNavItem[] = p.equipo
    ? [
        { label: "Histórico", icon: "clock" },
        { label: "Presupuesto contra lo real", icon: "chart" },
      ]
    : [];
  const configuracion: NexoNavItem[] = p.vendedores
    ? [{ label: "Vendedores y usuarios", href: "/configuracion/vendedores", icon: "users" }]
    : [];

  return [
    { label: "Dashboard", href: "/dashboard", icon: "grid" },
    { label: "Metas", icon: "target", children: metas },
    { label: "Ventas", icon: "briefcase", children: ventas },
    { label: "Análisis", icon: "chart", children: analisis },
    { label: "Configuración", icon: "settings", children: configuracion },
  ];
}
