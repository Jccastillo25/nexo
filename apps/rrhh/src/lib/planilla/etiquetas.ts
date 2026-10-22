/**
 * Etiquetas visibles de los valores fijos de Planilla (régimen, métodos,
 * tipos, causas, orígenes, certeza) y de los parámetros de ley. Módulo PURO,
 * sin "use client": lo comparten Server Components y componentes cliente
 * (un valor exportado desde un archivo "use client" llega al servidor como
 * referencia, no como dato).
 *
 * Los estados con color (StatusBadge) están en `estados.ts`.
 */
import { porcentajeExacto } from "./formato";
import type {
  CausaLiquidacion,
  CausaLiquidacionTabla,
  Certeza,
  ClasePlanilla,
  Frecuencia,
  MetodoConcepto,
  MetodoEmbargo,
  MetodoIr,
  MetodoPago,
  OrigenNovedad,
  OrigenPrestamo,
  Regimen,
  RegimenInss,
  TipoConcepto,
  TipoDeclaracion,
  TipoEmbargo,
  TipoPrestamo,
  TipoVacaciones,
  UnidadParametro,
} from "./tipos";

/** ¿`valor` es una clave PROPIA del mapa? (nunca "toString", "constructor"…). Sirve para validar filtros de la URL. */
export function esClaveDe<K extends string>(mapa: Readonly<Record<K, unknown>>, valor: unknown): valor is K {
  return typeof valor === "string" && Object.hasOwn(mapa, valor);
}

/** Etiqueta de `valor` en el mapa, o el valor tal cual si no se conoce ("—" si viene vacío). */
export function etiqueta(mapa: Readonly<Record<string, string>>, valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return Object.hasOwn(mapa, valor) ? mapa[valor] : valor;
}

export const REGIMEN: Readonly<Record<Regimen, string>> = {
  laboral: "Laboral",
  servicios_profesionales: "Servicios profesionales",
};

export const REGIMEN_INSS: Readonly<Record<RegimenInss, string>> = {
  integral: "Integral",
  ivm: "IVM",
  ninguno: "Sin INSS",
};

export const METODO_IR: Readonly<Record<MetodoIr, string>> = {
  tabla_progresiva: "Tabla progresiva",
  retencion_fija: "Retención fija",
  exento: "Exento",
};

export const TIPO_CONCEPTO: Readonly<Record<TipoConcepto, string>> = {
  devengado: "Ingreso",
  deduccion: "Deducción",
  aporte_patronal: "Aporte patronal",
  provision: "Provisión",
};

export const METODO_CONCEPTO: Readonly<Record<MetodoConcepto, string>> = {
  sistema: "Lo calcula el sistema",
  fijo: "Monto fijo",
  horas: "Horas",
  dias: "Días",
};

export const CLASE_PLANILLA: Readonly<Record<ClasePlanilla, string>> = {
  ordinaria: "Ordinaria",
  aguinaldo: "Aguinaldo",
};

export const FRECUENCIA: Readonly<Record<Frecuencia, string>> = {
  quincenal: "Quincenal",
  mensual: "Mensual",
  semanal: "Semanal",
  anual: "Anual",
};

export const METODO_PAGO: Readonly<Record<MetodoPago, string>> = {
  cheque: "Cheque",
  transferencia: "Transferencia",
};

/** Las 5 causas que calcula la RPC, en el orden del formulario. */
export const CAUSA_LIQUIDACION: Readonly<Record<CausaLiquidacion, string>> = {
  despido_sin_causa: "Despido sin causa justa",
  renuncia: "Renuncia",
  mutuo_acuerdo: "Mutuo acuerdo",
  despido_causa_justa: "Despido con causa justa",
  confianza: "Personal de confianza",
};

/** Todas las de la tabla, para mostrar una liquidación existente. */
export const CAUSA_LIQUIDACION_TODAS: Readonly<Record<CausaLiquidacionTabla, string>> = {
  ...CAUSA_LIQUIDACION,
  vencimiento: "Vencimiento de contrato",
  fallecimiento: "Fallecimiento",
};

export const NOTA_CAUSAS_PENDIENTES = "Vencimiento de contrato y fallecimiento: pendientes de definir con el contador.";

export const TIPO_VACACIONES: Readonly<Record<TipoVacaciones, string>> = {
  goce: "Goce",
  pago: "Pago sin gozar",
  ajuste: "Ajuste",
  saldo_inicial: "Saldo inicial",
  liquidacion: "Liquidación",
};

/** Descripción de cada tipo en el formulario "Registrar vacaciones" (la liquidación no se registra a mano). */
export const DESCRIPCION_TIPO_VACACIONES: Readonly<Record<Exclude<TipoVacaciones, "liquidacion">, string>> = {
  goce: "Días que la persona descansa",
  pago: "Días que se pagan sin descansar",
  ajuste: "Corrección del saldo",
  saldo_inicial: "Saldo traído de AG Planilla al empezar en Nexo",
};

export const TIPO_PRESTAMO: Readonly<Record<TipoPrestamo, string>> = {
  prestamo: "Préstamo",
  adelanto: "Adelanto salarial",
};

export const ORIGEN_PRESTAMO: Readonly<Record<OrigenPrestamo, string>> = {
  nexo: "Nexo",
  ag: "Traído de AG",
};

export const TIPO_EMBARGO: Readonly<Record<TipoEmbargo, string>> = {
  alimentos: "Pensión alimenticia",
  judicial: "Embargo judicial",
};

export const METODO_EMBARGO: Readonly<Record<MetodoEmbargo, string>> = {
  porcentaje: "Porcentaje",
  monto: "Monto mensual",
};

export const ORIGEN_NOVEDAD: Readonly<Record<OrigenNovedad, string>> = {
  manual: "Manual",
  excel: "Excel",
  asistencia: "Asistencia",
  prestamo: "Préstamo",
  vacaciones: "Vacaciones",
};

/** Certeza de un parámetro, con la explicación del formulario "Nueva vigencia". */
export const CERTEZA: Readonly<Record<Certeza, { label: string; descripcion: string }>> = {
  oficial: { label: "Oficial", descripcion: "Sale de la ley o de la DGI" },
  coincidente: { label: "Coincidente", descripcion: "Varias fuentes coinciden" },
  verificar: { label: "Por verificar", descripcion: "Lo confirma el contador" },
};

export const UNIDAD_PARAMETRO: Readonly<Record<UnidadParametro, string>> = {
  porcentaje: "Porcentaje",
  monto: "Monto (C$)",
  numero: "Número",
};

export const TIPO_DECLARACION: Readonly<Record<TipoDeclaracion, string>> = {
  inss: "INSS",
  inatec: "INATEC",
  ir: "IR (DGI)",
};

/** Nombre de negocio de cada parámetro de ley (`rrhh.parametros_ley.codigo`). */
export const PARAMETROS: Readonly<Record<string, string>> = {
  inss_laboral: "INSS laboral",
  inss_laboral_ivm: "INSS laboral (régimen IVM)",
  inss_patronal: "INSS patronal",
  inss_patronal_ivm: "INSS patronal (régimen IVM)",
  inatec: "INATEC",
  techo_inss: "Techo de cotización del INSS",
  dias_mes_comercial: "Días del mes comercial",
  vacaciones_dias_por_mes: "Días de vacaciones por mes",
  aguinaldo_dias_por_mes: "Días de aguinaldo por mes",
  aguinaldo_mes_inicio: "Mes de inicio del aguinaldo",
  indemnizacion_anios_iniciales: "Años iniciales de la indemnización",
  indemnizacion_dias_anio_inicial: "Días de indemnización por año (años iniciales)",
  indemnizacion_dias_anio_siguiente: "Días de indemnización por año (años siguientes)",
  indemnizacion_dias_minimo: "Mínimo de días de indemnización",
  indemnizacion_dias_maximo: "Máximo de días de indemnización",
  indemnizacion_exencion_ir: "Exención de IR de la indemnización",
  confianza_meses_minimo: "Meses mínimos del personal de confianza (art. 47)",
  confianza_meses_maximo: "Meses máximos del personal de confianza (art. 47)",
  provision_indemnizacion_divisor: "Divisor de la provisión de indemnización",
  factor_horas_extra: "Factor de pago de las horas extra",
  horas_extra_max_dia: "Máximo de horas extra por día",
  horas_extra_max_semana: "Máximo de horas extra por semana",
  horas_extra_fraccion_minutos: "Fracción de minutos para proponer horas extra",
};

/** Nombre del parámetro; uno desconocido se muestra con espacios ("nuevo_codigo" → "Nuevo codigo"). */
export function etiquetaParametro(codigo: string): string {
  if (Object.hasOwn(PARAMETROS, codigo)) return PARAMETROS[codigo];
  const texto = codigo.replace(/_/g, " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** ¿El código es un parámetro conocido? */
export function esParametroConocido(codigo: string): boolean {
  return Object.hasOwn(PARAMETROS, codigo);
}

/** IR de un régimen: "Tabla progresiva", "Retención fija 10.00 %", "Exento"; sin régimen, "—". */
export function etiquetaIr(r: { metodo_ir: MetodoIr | string | null; porcentaje_ir: number | string | null }): string {
  if (!r.metodo_ir) return "—";
  if (r.metodo_ir === "retencion_fija") return `Retención fija ${porcentajeExacto(r.porcentaje_ir)}`;
  return etiqueta(METODO_IR, r.metodo_ir);
}

/** Prestaciones que lleva un régimen: "Vacaciones, aguinaldo e indemnización", "Ninguna"; sin régimen, "—". */
export function etiquetaPrestaciones(r: {
  paga_vacaciones: boolean | null;
  paga_aguinaldo: boolean | null;
  paga_indemnizacion: boolean | null;
}): string {
  if (r.paga_vacaciones === null && r.paga_aguinaldo === null && r.paga_indemnizacion === null) return "—";
  const lista = [
    r.paga_vacaciones ? "vacaciones" : null,
    r.paga_aguinaldo ? "aguinaldo" : null,
    r.paga_indemnizacion ? "indemnización" : null,
  ].filter((x): x is string => x !== null);
  if (lista.length === 0) return "Ninguna";
  const texto = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} ${/^i/.test(lista[lista.length - 1]) ? "e" : "y"} ${lista[lista.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
