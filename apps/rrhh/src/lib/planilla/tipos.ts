/**
 * Tipos de los resultados de las RPC y tablas de Planilla (contrato común de
 * PL2b, PL2c y pantallas, más las migraciones aplicadas 20261021191441 PL2a,
 * 20261021235639 y 20261022000001…20261022001314 PL2b, y
 * 20261022001530…20261022001922 PL2c).
 *
 * Módulo de solo tipos (sin código de ejecución): lo pueden importar
 * Server Components, Server Actions, Route Handlers y componentes cliente.
 *
 * Números: PostgREST serializa `numeric`, `bigint` e `integer` como número
 * JSON (también dentro de un `jsonb`), y supabase-js los entrega como
 * `number`; por eso aquí son `number`. Los montos vienen ya redondeados por la
 * RPC (2 decimales; diarios y bases, 4): la UI nunca los recalcula. Los
 * helpers de `formato.ts` aceptan además `string` por si una RPC futura
 * devolviera el texto de un `numeric` (p. ej. con `::text` para no perder
 * precisión); si eso pasa, cambia aquí el campo a `number | string`.
 * Fechas `date` = "YYYY-MM-DD"; `timestamptz` = texto ISO; `uuid` = string.
 *
 * Mientras `database.types.ts` no se regenere con las RPC `planilla_*`, las
 * llamadas pasan por `rpcPlanilla` de `servidor.ts` y su `data` se tipa con
 * estos tipos.
 */

// ---------------------------------------------------------------- valores fijos

export type EstadoPlanilla = "borrador" | "calculada" | "aprobada" | "pagada" | "anulada";
export type EstadoLiquidacion = "calculada" | "aprobada" | "pagada" | "anulada";
export type EstadoVacaciones = "solicitada" | "aprobada" | "rechazada" | "anulada";
export type EstadoNovedad = "pendiente" | "aplicada" | "anulada";
/** `pagado` no existe en la tabla: lo calcula planilla_prestamos_saldos (activo sin saldo). */
export type EstadoPrestamo = "activo" | "pagado" | "cancelado" | "anulado";
export type EstadoEmbargo = "activo" | "terminado" | "anulado";
export type EstadoComparacion = "nuevo" | "sale" | "igual" | "cambia";
export type EstadoContrato = "borrador" | "activo" | "finalizado";
export type Certeza = "oficial" | "coincidente" | "verificar";

export type Regimen = "laboral" | "servicios_profesionales";
export type RegimenInss = "integral" | "ivm" | "ninguno";
export type MetodoIr = "tabla_progresiva" | "retencion_fija" | "exento";

export type ClasePlanilla = "ordinaria" | "aguinaldo";
export type Frecuencia = "mensual" | "quincenal" | "semanal" | "anual";
export type MetodoPago = "cheque" | "transferencia";

export type TipoConcepto = "devengado" | "deduccion" | "aporte_patronal" | "provision";
export type MetodoConcepto = "sistema" | "fijo" | "horas" | "dias";
export type UnidadLinea = "dias" | "horas" | "monto" | "porcentaje";
export type OrigenLinea = "sistema" | "novedad" | "embargo";
export type OrigenNovedad = "manual" | "excel" | "asistencia" | "prestamo" | "vacaciones";
export type UnidadParametro = "porcentaje" | "monto" | "numero";

/** Las 5 causas que hoy calcula la RPC; vencimiento y fallecimiento responden "pendiente de definir". */
export type CausaLiquidacion = "despido_sin_causa" | "renuncia" | "mutuo_acuerdo" | "despido_causa_justa" | "confianza";
/** Todas las que admite la tabla (para mostrar una fila existente). */
export type CausaLiquidacionTabla = CausaLiquidacion | "vencimiento" | "fallecimiento";

export type TipoVacaciones = "saldo_inicial" | "goce" | "pago" | "ajuste" | "liquidacion";
export type TipoPrestamo = "prestamo" | "adelanto";
export type OrigenPrestamo = "nexo" | "ag";
export type TipoEmbargo = "alimentos" | "judicial";
export type MetodoEmbargo = "porcentaje" | "monto";
export type TipoDeclaracion = "inss" | "inatec" | "ir";

// ---------------------------------------------------------------- resultados de servidor

/** Error de una RPC de Supabase/PostgREST (forma mínima). */
export interface ErrorRpc {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Lectura para una página: "sin datos" es distinto de "falló".
 * - `denegado`: 42501 o denegación → EmptyState no-access.
 * - `negocio`: P0001 (mensaje escrito por la RPC) → Alert warning con `mensaje`.
 * - `error`: cualquier otro → EmptyState error (el detalle queda en el log).
 */
export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; motivo: "denegado" | "negocio" | "error"; mensaje: string };

/** Respuesta fallida de una Server Action (mensaje apto para mostrar). */
export interface ActionFallo {
  ok: false;
  message: string;
}

/**
 * Resultado de una Server Action. Sin tipo: `{ ok: true }`; con tipo:
 * `{ ok: true, data }`. Ejemplos: `ActionResult` (aprobar),
 * `ActionResult<string>` (crear devuelve el uuid), `ActionResult<TotalesPlanilla>`.
 */
export type ActionResult<T = void> = ([T] extends [void] ? { ok: true } : { ok: true; data: T }) | ActionFallo;

// ---------------------------------------------------------------- planilla

/** `rrhh.planillas.totales` (jsonb). En borrador viene `{}`: por eso las pantallas lo leen como Partial. */
export interface TotalesPlanilla {
  empleados: number;
  devengado: number;
  deducciones: number;
  neto: number;
  aportes: number;
  provisiones: number;
  /** Devengado + aportes patronales + provisiones. */
  costo_total: number;
  avisos: string[];
  empleados_con_aviso: number;
}

/** Fila de `rrhh.planillas` (lectura directa con RLS planilla.ver, o dentro de planilla_detalle). */
export interface PlanillaFila {
  id: string;
  company_id: string;
  planilla_tipo_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_pago: string | null;
  estado: EstadoPlanilla;
  /** Columna histórica; el dato vigente está en `totales`. */
  total: number;
  totales: Partial<TotalesPlanilla>;
  generada_por: string | null;
  generada_en: string;
  calculada_por: string | null;
  calculada_en: string | null;
  aprobada_por: string | null;
  aprobada_en: string | null;
  pagada_por: string | null;
  pagada_en: string | null;
  metodo_pago: MetodoPago | null;
  referencia_pago: string | null;
  anulada_por: string | null;
  anulada_en: string | null;
  motivo_anulacion: string | null;
  reemplaza_a: string | null;
  hash_insumos: string | null;
  hash_aprobado: string | null;
  asiento_contable_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Nombre y RUC de la empresa (core.companies), para colillas, cheques y liquidación. */
export interface Empresa {
  nombre: string;
  ruc: string | null;
}

/** Línea de un renglón (`rrhh.planilla_lineas` + `en_colilla` del concepto). */
export interface Linea {
  concepto_codigo: string;
  concepto_nombre: string;
  tipo: TipoConcepto;
  cantidad: number | null;
  unidad: UnidadLinea;
  base: number | null;
  /** Fracción (0.07 = 7 %) cuando `unidad = porcentaje`; factor en otros casos. */
  tasa: number | null;
  monto: number;
  orden: number;
  en_colilla: boolean;
  origen: OrigenLinea;
  articulo: string | null;
}

/** Renglón por contrato de una planilla (`rrhh.planilla_empleados` con sus líneas). */
export interface Renglon {
  id: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_id: string;
  empleado_nombre: string;
  periodo_inicio: string;
  periodo_fin: string;
  salario_mensual: number;
  /** 4 decimales: se muestra con `tarifa()`. */
  salario_diario: number;
  dias_pagados: number;
  devengado: number;
  deducciones: number;
  neto: number;
  aportes: number;
  provisiones: number;
  regimen: Regimen;
  regimen_inss: RegimenInss;
  metodo_ir: MetodoIr;
  porcentaje_ir: number | null;
  avisos: string[];
  lineas: Linea[];
}

/** `planilla_detalle(p_company_id, p_planilla_id)` → jsonb. */
export interface PlanillaDetalle {
  planilla: PlanillaFila & {
    tipo_nombre: string;
    clase: ClasePlanilla;
    frecuencia: Frecuencia;
    /** Id de la planilla que la reemplaza (si está anulada y ya tiene reemplazo). */
    reemplazada_por: string | null;
    /** Calculada con insumos que cambiaron después: hay que volver a calcular antes de aprobar. */
    cambios_sin_calcular: boolean;
  };
  empresa: Empresa | null;
  renglones: Renglon[];
}

/** `planilla_comparar` → table. Sin planilla anterior: `anterior_id` y sus fechas en null. */
export interface ComparacionFila {
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  devengado_actual: number | null;
  devengado_anterior: number | null;
  neto_actual: number | null;
  neto_anterior: number | null;
  diferencia_neto: number;
  estado: EstadoComparacion;
  anterior_id: string | null;
  anterior_periodo_inicio: string | null;
  anterior_periodo_fin: string | null;
}

/** `planilla_contratos_opciones` → table (sin salario). */
export interface ContratoOpcionRpc {
  contrato_id: string;
  numero_contrato: number;
  empleado_id: string;
  empleado_nombre: string;
  estado: EstadoContrato;
  fecha_inicio: string | null;
  fecha_fin_real: string | null;
  frecuencia_pago: string | null;
  puesto: string | null;
}

/** Opción de contrato lista para un <select>: "Nombre · N.º 12 (finalizado)". */
export interface OpcionContrato extends ContratoOpcionRpc {
  etiqueta: string;
}

/** `planilla_novedades_listado` → table. */
export interface NovedadFila {
  id: string;
  fecha: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  concepto_id: string;
  concepto_codigo: string;
  concepto_nombre: string;
  concepto_metodo: MetodoConcepto;
  tipo: TipoConcepto;
  cantidad: number | null;
  monto: number | null;
  nota: string | null;
  estado: EstadoNovedad;
  origen: OrigenNovedad;
  planilla_id: string | null;
  planilla_estado: EstadoPlanilla | null;
  creado_en: string;
}

/** `planilla_asistencia_propuesta` → table. */
export interface PropuestaAsistencia {
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  fecha: string;
  concepto_codigo: "HORAS_EXTRA" | "AUSENCIA";
  /** Horas (HORAS_EXTRA) o días (AUSENCIA). */
  cantidad: number;
  ya_importada: boolean;
  detalle: string | null;
}

/** Elemento de `p_items` de `planilla_asistencia_importar`. */
export interface ItemImportarAsistencia {
  contrato_id: string;
  fecha: string;
  concepto_codigo: "HORAS_EXTRA" | "AUSENCIA";
  cantidad: number;
}

// ---------------------------------------------------------------- vacaciones, préstamos y embargos

/** `planilla_vacaciones_saldos` → table. `salario_diario` y `valor` en null sin planilla.ver ni compensacion.ver (D6). */
export interface VacacionSaldo {
  contrato_id: string;
  empleado_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  estado_contrato: EstadoContrato;
  fecha_corte: string | null;
  acumulado: number;
  gozado: number;
  pagado: number;
  ajustes: number;
  liquidado: number;
  saldo: number;
  salario_diario: number | null;
  valor: number | null;
}

/** `planilla_vacaciones_movimientos` → table. */
export interface VacacionMovimiento {
  id: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  tipo: TipoVacaciones;
  fecha_inicio: string;
  fecha_fin: string;
  /** Con signo en un ajuste. */
  dias: number;
  estado: EstadoVacaciones;
  motivo: string | null;
  registrado_por: string | null;
  registrado_en: string;
  aprobado_por: string | null;
  aprobado_en: string | null;
  rechazo_motivo: string | null;
}

/** `planilla_prestamos_saldos` → table. */
export interface PrestamoSaldo {
  prestamo_id: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  tipo: TipoPrestamo;
  origen: OrigenPrestamo;
  monto: number;
  cuotas: number;
  monto_cuota: number;
  fecha_primera: string;
  estado: EstadoPrestamo;
  aplicado: number;
  pendiente: number;
  /** Lo que la liquidación no pudo descontar sin tocar el aguinaldo (art. 97). */
  condonado: number;
  cuotas_pendientes: number;
  proxima_fecha: string | null;
  nota: string | null;
  created_at: string;
}

/** `planilla_prestamo_cuotas` → table. */
export interface PrestamoCuota {
  novedad_id: string;
  cuota_numero: number | null;
  fecha: string;
  monto: number;
  estado: EstadoNovedad;
  planilla_id: string | null;
  planilla_estado: EstadoPlanilla | null;
  saldada_en_liquidacion: boolean;
}

/** `planilla_embargos_saldos` → table. `valor`: fracción 0–1 (porcentaje) o monto mensual. */
export interface EmbargoSaldo {
  embargo_id: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  tipo: TipoEmbargo;
  metodo: MetodoEmbargo;
  valor: number;
  tope_total: number | null;
  aplicado: number;
  /** Null si la orden no tiene tope. */
  pendiente: number | null;
  referencia: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  estado: EstadoEmbargo;
}

// ---------------------------------------------------------------- liquidaciones

/** Línea de pago de una liquidación simulada (`lineas` de planilla_liquidacion_simular). */
export interface LineaLiquidacionSimulada {
  concepto: string;
  nombre: string;
  dias: number | null;
  diario: number | null;
  monto: number;
  articulo: string | null;
  /** Solo en AGUINALDO: desde qué fecha se cuenta. */
  desde?: string | null;
}

/** Préstamo pendiente descontado en la liquidación (`deducciones`). */
export interface DeduccionLiquidacion {
  concepto: string;
  nombre: string;
  monto: number;
  origen_id: string;
  pendiente: number;
  articulo: string | null;
}

/** `planilla_liquidacion_simular` → jsonb (rrhh.fn_liquidacion_preparar). */
export interface LiquidacionSimulada {
  contrato_id: string;
  empleado_id: string;
  contrato_regimen_id: string;
  regimen: Regimen;
  salario_mensual: number;
  diario: number;
  fecha_antiguedad: string;
  meses_antiguedad: number;
  causa: CausaLiquidacion;
  fecha_egreso: string;
  dias_vacaciones: number;
  dias_vacaciones_saldo: number | null;
  aguinaldo_desde: string | null;
  lineas: LineaLiquidacionSimulada[];
  deducciones: DeduccionLiquidacion[];
  /** Igual a `total_devengado`. */
  total: number;
  total_devengado: number;
  total_deducciones: number;
  neto: number;
  avisos: string[];
}

/** Fila de `rrhh.liquidaciones` sin `resultado` ni `hash_insumos`, más datos del contrato. */
export interface LiquidacionDocumento {
  id: string;
  company_id: string;
  contrato_id: string;
  empleado_id: string;
  contrato_regimen_id: string;
  fecha_egreso: string;
  causa: CausaLiquidacionTabla;
  meses_confianza: number | null;
  dias_salario_pendiente: number;
  salario_mensual: number;
  salario_diario: number;
  fecha_antiguedad: string;
  dias_vacaciones: number;
  aguinaldo_desde: string | null;
  total_devengado: number;
  total_deducciones: number;
  neto: number;
  avisos: string[];
  estado: EstadoLiquidacion;
  nota: string | null;
  creada_por: string;
  calculada_por: string;
  calculada_en: string;
  aprobada_por: string | null;
  aprobada_en: string | null;
  pagada_por: string | null;
  pagada_en: string | null;
  metodo_pago: MetodoPago | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  anulada_por: string | null;
  anulada_en: string | null;
  motivo_anulacion: string | null;
  created_at: string;
  updated_at: string;
  // Agregados por la RPC:
  numero_contrato: number;
  empleado_nombre: string;
  fecha_inicio: string | null;
  regimen: Regimen;
  /** Si sigue activo, aprobar lo finaliza y exige además el permiso de finalizar contratos. */
  contrato_estado: EstadoContrato;
  meses_antiguedad: number | null;
  dias_vacaciones_saldo: number | null;
}

/** Línea guardada de una liquidación (`rrhh.liquidacion_lineas`). */
export interface LineaLiquidacion {
  concepto: string;
  nombre: string;
  tipo: "devengado" | "deduccion";
  dias: number | null;
  diario: number | null;
  monto: number;
  articulo: string | null;
}

/** `planilla_liquidacion_detalle` → jsonb. */
export interface LiquidacionDetalle {
  liquidacion: LiquidacionDocumento;
  empresa: Empresa | null;
  lineas: LineaLiquidacion[];
}

/** `planilla_liquidaciones_listado` → table. */
export interface LiquidacionFila {
  id: string;
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  fecha_egreso: string;
  causa: CausaLiquidacionTabla;
  estado: EstadoLiquidacion;
  total_devengado: number;
  total_deducciones: number;
  neto: number;
  calculada_por: string;
  calculada_en: string;
  aprobada_por: string | null;
  aprobada_en: string | null;
  pagada_en: string | null;
}

// ---------------------------------------------------------------- análisis

/** `planilla_pasivo_laboral` → table. */
export interface PasivoFila {
  contrato_id: string;
  empleado_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  salario_mensual: number;
  salario_diario: number;
  vacaciones_dias: number;
  vacaciones_monto: number;
  aguinaldo_dias: number;
  aguinaldo_monto: number;
  indemnizacion_dias: number;
  indemnizacion_monto: number;
  total: number;
}

/** Fila de `rrhh.provisiones` (copia mensual del pasivo; lectura con planilla.ver). */
export interface ProvisionFila extends Omit<PasivoFila, "numero_contrato" | "empleado_nombre"> {
  id: string;
  mes: string;
  company_id: string;
  fecha_corte: string;
  generado_por: string | null;
  generado_en: string;
}

/** `planilla_regimen_listado` → table. Sin régimen: `regimen_id` y los campos del régimen en null. */
export interface RegimenFila {
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  estado_contrato: EstadoContrato;
  fecha_inicio: string | null;
  /** Efectiva: si no se fijó, el inicio del contrato. */
  fecha_antiguedad: string | null;
  regimen_id: string | null;
  regimen: Regimen | null;
  regimen_inss: RegimenInss | null;
  metodo_ir: MetodoIr | null;
  porcentaje_ir: number | null;
  paga_vacaciones: boolean | null;
  paga_aguinaldo: boolean | null;
  paga_indemnizacion: boolean | null;
  vigente_desde: string | null;
  motivo: string | null;
  tiene_aviso: boolean;
  aviso_descartado_en: string | null;
}

/** Fila de `rrhh.contrato_regimen` (historial; lectura con regimen.ver). */
export interface ContratoRegimen {
  id: string;
  company_id: string;
  contrato_id: string;
  empleado_id: string;
  regimen: Regimen;
  regimen_inss: RegimenInss;
  metodo_ir: MetodoIr;
  porcentaje_ir: number | null;
  paga_vacaciones: boolean;
  paga_aguinaldo: boolean;
  paga_indemnizacion: boolean;
  vigente_desde: string;
  vigente_hasta: string | null;
  motivo: string;
  aprobado_por: string | null;
  aviso_descartado_por: string | null;
  aviso_descartado_en: string | null;
  aviso_motivo: string | null;
  created_at: string;
}

/** `planilla_simular_regimen` → table. Montos en null sin planilla.ver ni compensacion.ver. */
export interface SimulacionRegimenFila {
  contrato_id: string;
  numero_contrato: number;
  empleado_nombre: string;
  salario_mensual: number | null;
  regimen_actual: Regimen | null;
  costo_laboral: number | null;
  costo_servicios: number | null;
  diferencia: number | null;
  inss_patronal: number | null;
  inatec: number | null;
  provisiones_laboral: number | null;
  provisiones_servicios: number | null;
  avisos: string[];
}

/** `planilla_declaracion_inss` → table. */
export interface DeclaracionInss {
  empleado_id: string;
  empleado_nombre: string;
  documento_identidad: string | null;
  /** Null: el expediente todavía no guarda el número de INSS. */
  numero_inss: string | null;
  dias: number;
  salario_inss: number;
  inss_laboral: number;
  inss_patronal: number;
}

/** `planilla_declaracion_inatec` → table (una fila por tasa del mes). */
export interface DeclaracionInatec {
  base: number;
  tasa: number;
  monto: number;
  empleados: number;
}

/** `planilla_declaracion_ir` → table (una fila por persona y régimen). */
export interface DeclaracionIr {
  empleado_id: string;
  empleado_nombre: string;
  documento_identidad: string | null;
  renta_bruta: number;
  inss_laboral: number;
  renta_neta: number;
  ir_retenido: number;
  regimen: Regimen;
}

// ---------------------------------------------------------------- configuración

/** Fila de `rrhh.parametros_ley` (lectura con parametros.ver). `valor`: fracción si `unidad = porcentaje`. */
export interface ParametroLey {
  id: string;
  company_id: string;
  codigo: string;
  unidad: UnidadParametro;
  valor: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  certeza: Certeza;
  fuente: string | null;
  created_at: string;
  created_by: string | null;
}

/** Fila de `rrhh.ir_tramos` (renta neta anual en C$). `porcentaje`: fracción 0–1. */
export interface IrTramo {
  id: string;
  company_id: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  desde: number;
  hasta: number | null;
  impuesto_base: number;
  porcentaje: number;
  sobre_exceso: number;
  created_at: string;
  created_by: string | null;
}

/** Elemento de `p_tramos` de `planilla_ir_tabla_nueva`. */
export interface IrTramoEntrada {
  desde: number;
  hasta: number | null;
  impuesto_base: number;
  porcentaje: number;
  sobre_exceso: number;
}

/** Fila de `rrhh.conceptos` (lectura con conceptos.ver). */
export interface Concepto {
  id: string;
  company_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  metodo: MetodoConcepto;
  afecta_inss: boolean;
  afecta_ir: boolean;
  afecta_inatec: boolean;
  cuenta_aguinaldo: boolean;
  cuenta_vacaciones: boolean;
  cuenta_indemnizacion: boolean;
  es_ordinario: boolean;
  en_colilla: boolean;
  permite_novedad: boolean;
  es_sistema: boolean;
  orden: number;
  articulo: string | null;
  cuenta_contable: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Fila de `rrhh.planilla_tipos` (lectura con conceptos.ver). */
export interface PlanillaTipo {
  id: string;
  company_id: string;
  nombre: string;
  clase: ClasePlanilla;
  frecuencia: Frecuencia;
  moneda: "NIO";
  centro_costo: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
