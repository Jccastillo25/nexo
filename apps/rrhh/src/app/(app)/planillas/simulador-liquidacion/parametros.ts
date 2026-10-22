/**
 * Parámetros del simulador de liquidación en la URL (C7):
 * `?contrato=&egreso=&causa=&pendiente=&vacaciones=&confianza=`. Módulo PURO:
 * lo usan la página (Server Component) y el formulario (cliente). Solo valida
 * formato y rangos de entrada; el cálculo es de planilla_liquidacion_simular.
 */
import { esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { CAUSA_LIQUIDACION, esClaveDe } from "@/lib/planilla/etiquetas";
import type { CausaLiquidacion } from "@/lib/planilla/tipos";

/** Valores tal como se escriben en el formulario (texto). */
export interface ValoresSimulacion {
  contrato: string;
  egreso: string;
  causa: string;
  pendiente: string;
  vacaciones: string;
  confianza: string;
}

/** Simulación lista para la RPC. */
export interface SimulacionValida {
  contratoId: string;
  egreso: string;
  causa: CausaLiquidacion;
  /** Días de salario pendiente (0 a 31). */
  pendiente: number;
  /** Null = el saldo registrado de vacaciones. */
  vacaciones: number | null;
  /** Meses adicionales del art. 47 (solo personal de confianza). */
  confianza: number | null;
}

export type ErroresSimulacion = Partial<Record<keyof ValoresSimulacion, string>>;

export const VACIO: ValoresSimulacion = { contrato: "", egreso: "", causa: "", pendiente: "", vacaciones: "", confianza: "" };

function numero(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : Number.NaN;
}

function dosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

/** Valida los valores del formulario: la simulación, o los errores por campo. */
export function validarSimulacion(v: ValoresSimulacion): { valida: SimulacionValida | null; errores: ErroresSimulacion } {
  const e: ErroresSimulacion = {};
  if (!esUuid(v.contrato)) e.contrato = "Elige el contrato.";
  if (!esFechaIso(v.egreso)) e.egreso = "Indica la fecha de egreso.";
  if (!esClaveDe(CAUSA_LIQUIDACION, v.causa)) e.causa = "Elige la causa de la terminación.";
  const pendiente = numero(v.pendiente);
  if (pendiente !== null && (Number.isNaN(pendiente) || pendiente < 0 || pendiente > 31 || !dosDecimales(pendiente))) {
    e.pendiente = "Indica de 0 a 31 días, con hasta dos decimales.";
  }
  const vacaciones = numero(v.vacaciones);
  if (vacaciones !== null && (Number.isNaN(vacaciones) || vacaciones < 0 || vacaciones >= 1000 || !dosDecimales(vacaciones))) {
    e.vacaciones = "Indica los días con hasta dos decimales, o déjalo vacío para usar el saldo registrado.";
  }
  const esConfianza = v.causa === "confianza";
  const confianza = esConfianza ? numero(v.confianza) : null;
  if (confianza !== null && (Number.isNaN(confianza) || confianza < 0 || confianza > 99 || !dosDecimales(confianza))) {
    e.confianza = "Indica los meses con hasta dos decimales.";
  }
  if (Object.keys(e).length > 0 || !esClaveDe(CAUSA_LIQUIDACION, v.causa)) return { valida: null, errores: e };
  return {
    valida: {
      contratoId: v.contrato,
      egreso: v.egreso,
      causa: v.causa,
      // Campo vacío del formulario = 0 días de salario pendiente (valor por defecto de la RPC).
      pendiente: pendiente === null ? 0 : pendiente,
      vacaciones,
      confianza,
    },
    errores: e,
  };
}

function uno(valor: string | string[] | undefined): string {
  const x = Array.isArray(valor) ? valor[0] : valor;
  return typeof x === "string" ? x.slice(0, 64) : "";
}

/** Lee los parámetros de la URL. Sin contrato, egreso ni causa no hay simulación ni errores (pantalla inicial). */
export function leerSimulacion(sp: Record<string, string | string[] | undefined>): {
  valores: ValoresSimulacion;
  valida: SimulacionValida | null;
  errores: ErroresSimulacion;
  pedida: boolean;
} {
  const valores: ValoresSimulacion = {
    contrato: uno(sp.contrato),
    egreso: uno(sp.egreso),
    causa: uno(sp.causa),
    pendiente: uno(sp.pendiente),
    vacaciones: uno(sp.vacaciones),
    confianza: uno(sp.confianza),
  };
  const pedida = valores.contrato !== "" || valores.egreso !== "" || valores.causa !== "";
  if (!pedida) return { valores, valida: null, errores: {}, pedida };
  const { valida, errores } = validarSimulacion(valores);
  return { valores, valida, errores, pedida };
}

/** Query de la URL para una simulación (sin los campos vacíos; confianza solo con esa causa). */
export function queryDe(v: ValoresSimulacion) {
  return {
    contrato: v.contrato,
    egreso: v.egreso,
    causa: v.causa,
    pendiente: v.pendiente.trim() === "" || Number(v.pendiente) === 0 ? undefined : v.pendiente.trim(),
    vacaciones: v.vacaciones.trim() || undefined,
    confianza: v.causa === "confianza" ? v.confianza.trim() || undefined : undefined,
  };
}
