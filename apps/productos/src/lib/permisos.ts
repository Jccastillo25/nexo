import { misPermisos } from "@nexo/auth";

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

const CLAVES = Object.keys(P) as Permiso[];
const CODIGOS = Object.values(P);

/**
 * Todos los permisos del módulo del usuario actual, para ocultar o
 * deshabilitar en la UI. Layout y páginas piden SIEMPRE esta misma lista, así
 * misPermisos (cacheada por request) hace una sola consulta por carga.
 * Las Server Actions no la usan: llaman a requirePermission antes de mutar.
 */
export async function permisosDe(): Promise<Permisos> {
  const tiene = await misPermisos(CODIGOS);
  return Object.fromEntries(CLAVES.map((k) => [k, tiene.has(P[k])])) as Permisos;
}
