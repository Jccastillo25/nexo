// Formas de lo que devuelven las RPC public.presupuesto_* (jsonb).
// Ver supabase/migrations/20261020184030_presupuesto_esquema.sql.

export type OrigenMeta = "sugerida" | "ajustada";

export interface SerieMes {
  mes: number;
  vendido_usd: number;
  meta_usd: number | null;
}

export interface Avance {
  meta_usd: number | null;
  meta_origen: OrigenMeta | null;
  vendido_usd: number;
  vendido_cs: number;
  facturas: number;
  anuladas: number;
}

export type MiAvance =
  | { vinculado: false }
  | {
      vinculado: true;
      vendedor: { id: string; codigo: string; nombre: string; activo: boolean };
      avance: Avance;
      tipo_cambio: number | null;
      serie: SerieMes[];
      ultima_factura: string | null;
    };

export interface FacturaPropia {
  fecha: string;
  numero: string;
  cliente: string | null;
  anulada: boolean;
  total_cs: number;
  total_usd: number;
}

export interface MisFacturas {
  vinculado: boolean;
  total: number;
  filas: FacturaPropia[];
}

export interface FacturaEquipo extends FacturaPropia {
  vendedor_id: string;
  vendedor_codigo: string;
  vendedor_nombre: string;
}

export interface Facturas {
  total: number;
  filas: FacturaEquipo[];
}

export interface VendedorEquipo {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  /** Se muestra en el cuadro de meta (20261020194816). */
  en_tablero: boolean;
  vinculado: boolean;
  meta_usd: number | null;
  meta_origen: OrigenMeta | null;
  vendido_usd: number;
  vendido_cs: number;
  facturas: number;
}

export interface Equipo {
  meta_empresa_usd: number | null;
  tipo_cambio: number | null;
  vendedores: VendedorEquipo[];
  serie_empresa: SerieMes[];
  ultima_factura: string | null;
}

export interface Vendedor {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  vinculado: boolean;
  /** Solo con presupuesto.configuracion.vendedor.gestionar; si no, null (20261020191334). */
  user_id: string | null;
  usuario_nombre: string | null;
  ultima_venta: string | null;
}

export interface UsuarioVinculable {
  user_id: string;
  nombre: string;
  email: string;
  vendedor_id: string | null;
}

export interface Presupuesto {
  existe: boolean;
  venta_base_usd: number | null;
  crecimiento: number | null;
  total_usd: number | null;
  actualizado: string | null;
  meses: { mes: number; porcentaje: number; monto_usd: number }[];
  sugerido: { venta_base_usd: number; porcentajes: number[] };
}

export interface MetaVendedorMes {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  meta_usd: number | null;
  meta_origen: OrigenMeta | null;
  /** Null para vendedores inactivos (no entran en la sugerencia). */
  base_usd: number | null;
  peso: number | null;
  sugerida_usd: number | null;
}

export interface MetasMes {
  meta_empresa_usd: number | null;
  vendedores: MetaVendedorMes[];
}

/** Vendedor resumido en las respuestas de clientes (solo con alcance "todos"). */
export interface VendedorBreve {
  id: string;
  codigo: string;
  nombre: string;
}

/** Una fila de presupuesto_clientes. */
export interface ClienteResumen {
  cliente: string;
  facturas: number;
  total_usd: number;
  total_cs: number;
  usd_anio: number;
  ultima_fecha: string;
  dias_desde: number;
  ultimo_numero: string;
  ultimo_usd: number;
  ultimo_vendedor: VendedorBreve | null;
}

export interface Clientes {
  vinculado: boolean;
  /** "todos" con factura.ver; "propio" solo con factura_propia.ver. */
  alcance: "todos" | "propio";
  vendedor_id: string | null;
  ultima_factura: string | null;
  total: number;
  filas: ClienteResumen[];
}

export interface FacturaDeCliente {
  fecha: string;
  numero: string;
  anulada: boolean;
  total_usd: number;
  total_cs: number;
  vendedor: VendedorBreve | null;
}

export interface FacturasCliente {
  vinculado: boolean;
  alcance: "todos" | "propio";
  cliente: string;
  total: number;
  facturas: number;
  anuladas: number;
  total_usd: number;
  total_cs: number;
  primera_fecha: string | null;
  ultima_fecha: string | null;
  filas: FacturaDeCliente[];
}

/** Cliente que compraba seguido y lleva 45 días o más sin comprar (presupuesto_indicadores). */
export interface ClienteEnRiesgo {
  cliente: string;
  ultima_fecha: string;
  /** Días desde su última factura hasta el corte. */
  dias: number;
  facturas_12m: number;
  usd_12m: number;
  /** Vendedor de su última factura; solo en la vista equipo. */
  vendedor: VendedorBreve | null;
}

export interface ClienteReciente {
  cliente: string;
  fecha: string;
  numero: string;
  total_usd: number;
  dias: number;
  usd_12m: number | null;
}

/** presupuesto_indicadores (20261020204854). Listas en null = sin permiso de facturas. */
export type Indicadores =
  | { vinculado: false }
  | {
      vinculado: true;
      vista: "propio" | "equipo";
      detalle: boolean;
      /** Última factura importada (acotada al fin del mes); null si no hay facturas. */
      corte: string | null;
      dias_habiles_mes: number;
      dias_habiles_transcurridos: number;
      mes: { vendido_usd: number; facturas: number; contado_usd: number; clientes: number; clientes_nuevos: number };
      meta_mes_usd: number | null;
      anio_anterior: { mes_usd: number; a_la_fecha_usd: number };
      ytd: { vendido_usd: number; anterior_usd: number; meta_previa_usd: number | null };
      clientes_12m: { clientes: number; ventas_usd: number; top10_usd: number; contado_usd: number };
      en_riesgo_total: { clientes: number; usd_12m: number };
      en_riesgo: ClienteEnRiesgo[] | null;
      recientes: ClienteReciente[] | null;
      ultima: { fecha: string; numero: string; cliente: string; total_usd: number } | null;
    };

/** presupuesto_venta_diaria (20261020210947): venta vigente por día del mes y del mismo mes del año anterior. */
export type VentaDiaria =
  | { vinculado: false }
  | { vinculado: true; dias: { dia: number; habil: boolean; usd: number; usd_anterior: number }[] };

export interface ErrorFila {
  fila: number;
  numero: string;
  /** Ya traducido por la Server Action (motivoDeFila). */
  error: string;
}

export interface ResultadoLote {
  confirmado: boolean;
  importacion_id?: string;
  filas: number;
  nuevas: number;
  actualizadas: number;
  vendedores_nuevos: number;
  errores: ErrorFila[];
  fecha_min: string | null;
  fecha_max: string | null;
}

export interface Resultado<T = undefined> {
  ok: boolean;
  message?: string;
  /** La acción se negó por permisos (de la Server Action o de la RPC). */
  denegado?: boolean;
  data?: T;
}
