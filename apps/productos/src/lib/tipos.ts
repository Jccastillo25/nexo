// Formas de lo que devuelven las RPC public.productos_* (jsonb).

export interface Resumen {
  total: number;
  activos: number;
  servicios: number;
  descontinuados: number;
  sin_clasificacion: number;
  con_codigo_barras: number;
  sin_costo: number | null;
  siguiente_id: number;
  clases: number;
  ultimos: { id: string; numero_id: number; codigo: string; nombre: string; created_at: string }[];
}

export interface FilaProducto {
  id: string;
  numero_id: number;
  codigo: string;
  nombre: string;
  codigo_barras: string | null;
  es_servicio: boolean;
  clasificacion: string;
  marca: string | null;
  unidad: string | null;
  costo: number | null;
  costo_moneda: "NIO" | "USD" | null;
  descontinuado_ventas: boolean;
  sin_clasificacion: boolean;
}

export interface Listado {
  total: number;
  costo_visible: boolean;
  filas: FilaProducto[];
}

export interface Clasificacion {
  id: string;
  nivel: "clase" | "tipo" | "categoria";
  padre_id: string | null;
  numero: string;
  nombre: string;
  codigo_erp: string | null;
  activa: boolean;
  productos: number;
  prefijo: string | null;
}

export interface Catalogos {
  clasificaciones: Clasificacion[];
  marcas: { id: string; nombre: string; activa: boolean; clases: string[] }[];
  unidades: { id: string; nombre: string; simbolo: string | null; activa: boolean }[];
  proveedores: { id: string; nombre: string; activo: boolean }[];
  caracteristicas: { id: string; nombre: string; tipo: "texto" | "numero" | "si_no"; activa: boolean }[];
  cuentas: { id: string; codigo: string; nombre: string; tipo: "ingreso" | "inventario" | "costo"; exenta: boolean; activa: boolean }[];
  centros_costo: { id: string; codigo: string; nombre: string; activo: boolean }[];
}

export interface Producto {
  id: string;
  numero_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  notas: string | null;
  codigo_barras: string | null;
  peso: number | null;
  erp_producto_id: number | null;
  fecha_ingreso: string;
  es_servicio: boolean;
  inventariable: boolean;
  clase_id: string | null;
  tipo_id: string | null;
  categoria_id: string | null;
  marca_id: string | null;
  proveedor_id: string | null;
  unidad_id: string;
  exento_ventas: boolean;
  exento_compras: boolean;
  cuenta_ingreso_id: string | null;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
  codigo_sac: string | null;
  centro_costo_id: string | null;
  centro_costo_unico: boolean;
  costo_moneda?: "NIO" | "USD";
  costo_referencia?: number | null;
  existencia_minima: number;
  existencia_maxima: number;
  lote_por_vencimiento: boolean;
  plazo_vencimiento_dias: number | null;
  margen_dias_vencer: number | null;
  descontinuado_ventas: boolean;
  descontinuado_compras: boolean;
  clase: string | null;
  tipo: string | null;
  categoria: string | null;
  caracteristicas: { caracteristica_id: string; nombre: string; valor: string }[];
}

export interface ResultadoImportacion {
  confirmado: boolean;
  total: number;
  creados: number;
  actualizados: number;
  errores: { fila: number; codigo: string; mensaje: string }[];
  sin_clasificacion: number;
  sin_costo: number;
  catalogos_nuevos: Record<"clases" | "tipos" | "categorias" | "marcas" | "unidades" | "proveedores" | "cuentas" | "centros_costo", number>;
  siguiente_id: number;
}

export interface Resultado<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}
