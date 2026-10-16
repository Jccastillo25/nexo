import { hasPermission } from "@nexo/permissions";
import type { createClient } from "@/lib/supabase/server";

/** Códigos del Paso Cero (20261016203638). */
export const P = {
  modulo: "productos.ver_modulo",
  dashboard: "productos.dashboard.resumen.ver",
  ver: "productos.catalogo.producto.ver",
  crear: "productos.catalogo.producto.crear",
  editar: "productos.catalogo.producto.editar",
  descontinuar: "productos.catalogo.producto.descontinuar",
  importar: "productos.catalogo.producto.importar",
  exportar: "productos.catalogo.producto.exportar",
  costoVer: "productos.catalogo.costo.ver",
  costoEditar: "productos.catalogo.costo.editar",
  fiscal: "productos.catalogo.fiscal.editar",
  clasificacion: "productos.configuracion.clasificacion.gestionar",
  marca: "productos.configuracion.marca.gestionar",
  unidad: "productos.configuracion.unidad.gestionar",
  proveedor: "productos.configuracion.proveedor.gestionar",
  caracteristica: "productos.configuracion.caracteristica.gestionar",
  contable: "productos.configuracion.contable.gestionar",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

/** Todos los permisos del módulo del usuario actual (para ocultar/deshabilitar en la UI). */
export async function permisosDe(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string): Promise<Permisos> {
  const claves = Object.keys(P) as Permiso[];
  const valores = await Promise.all(claves.map((k) => hasPermission({ supabase, companyId }, P[k])));
  return Object.fromEntries(claves.map((k, i) => [k, valores[i]])) as Permisos;
}
