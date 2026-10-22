/**
 * Estados de Planilla con su etiqueta y tono de StatusBadge, textos fijos de
 * las pantallas y reglas de presentación (separación de funciones, avisos
 * del contador, motivo). Módulo PURO, sin "use client": lo usan Server
 * Components y componentes cliente.
 *
 * El estado siempre lleva texto (StatusBadge con label): nunca solo color.
 */
import type { StatusTone } from "@nexo/ui";
import { esParametroConocido, etiquetaParametro } from "./etiquetas";
import type {
  Certeza,
  EstadoComparacion,
  EstadoEmbargo,
  EstadoLiquidacion,
  EstadoNovedad,
  EstadoPlanilla,
  EstadoPrestamo,
  EstadoVacaciones,
} from "./tipos";

export interface EstadoVisual {
  label: string;
  tone: StatusTone;
}

export const ESTADO_PLANILLA: Readonly<Record<EstadoPlanilla, EstadoVisual>> = {
  borrador: { label: "Borrador", tone: "neutral" },
  calculada: { label: "Calculada", tone: "info" },
  aprobada: { label: "Aprobada", tone: "positive" },
  pagada: { label: "Pagada", tone: "positive" },
  anulada: { label: "Anulada", tone: "negative" },
};

export const ESTADO_LIQUIDACION: Readonly<Record<EstadoLiquidacion, EstadoVisual>> = {
  calculada: { label: "Calculada", tone: "info" },
  aprobada: { label: "Aprobada", tone: "positive" },
  pagada: { label: "Pagada", tone: "positive" },
  anulada: { label: "Anulada", tone: "negative" },
};

export const ESTADO_VACACIONES: Readonly<Record<EstadoVacaciones, EstadoVisual>> = {
  solicitada: { label: "Por aprobar", tone: "warning" },
  aprobada: { label: "Aprobada", tone: "positive" },
  rechazada: { label: "Rechazada", tone: "negative" },
  anulada: { label: "Anulada", tone: "neutral" },
};

export const ESTADO_NOVEDAD: Readonly<Record<EstadoNovedad, EstadoVisual>> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  aplicada: { label: "Aplicada", tone: "positive" },
  anulada: { label: "Anulada", tone: "neutral" },
};

/** `pagado` lo calcula planilla_prestamos_saldos (activo sin saldo pendiente). */
export const ESTADO_PRESTAMO: Readonly<Record<EstadoPrestamo, EstadoVisual>> = {
  activo: { label: "Vigente", tone: "info" },
  pagado: { label: "Pagado", tone: "positive" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  anulado: { label: "Anulado", tone: "neutral" },
};

export const ESTADO_EMBARGO: Readonly<Record<EstadoEmbargo, EstadoVisual>> = {
  activo: { label: "Vigente", tone: "info" },
  terminado: { label: "Terminado", tone: "neutral" },
  anulado: { label: "Anulado", tone: "neutral" },
};

export const ESTADO_COMPARACION: Readonly<Record<EstadoComparacion, EstadoVisual>> = {
  nuevo: { label: "Entra", tone: "info" },
  sale: { label: "Sale", tone: "warning" },
  igual: { label: "Igual", tone: "neutral" },
  cambia: { label: "Cambia", tone: "warning" },
};

export const ESTADO_CERTEZA: Readonly<Record<Certeza, EstadoVisual>> = {
  oficial: { label: "Oficial", tone: "positive" },
  coincidente: { label: "Coincidente", tone: "info" },
  verificar: { label: "Por verificar", tone: "warning" },
};

/**
 * Etiqueta y tono de `valor` en `mapa`. Un valor desconocido se muestra tal
 * cual en neutral (no rompe); vacío → "—".
 */
export function estadoVisual(mapa: Readonly<Record<string, EstadoVisual>>, valor: string | null | undefined): EstadoVisual {
  if (valor === null || valor === undefined || valor === "") return { label: "—", tone: "neutral" };
  return Object.hasOwn(mapa, valor) ? mapa[valor] : { label: valor, tone: "neutral" };
}

/** Alias con el nombre de la especificación (§4.5). */
export const estadoVisible = estadoVisual;

// ---------------------------------------------------------------- textos fijos

export const AVISO_CONTADOR = "Valor pendiente de confirmar con el contador.";
export const MOTIVO_SEPARACION = "La aprobación la hace otra persona.";
export const SOLO_LECTURA = "Para corregirla, anúlala y genera otra.";
/** Una planilla pagada no se anula (planilla_anular lo rechaza). */
export const SOLO_LECTURA_PAGADA =
  "Una planilla pagada no se anula ni se edita. Si encuentras un error, consúltalo con el contador: la corrección de un pago todavía no está definida.";
/** Variante para la liquidación (C8). */
export const SOLO_LECTURA_LIQUIDACION = "Para corregirla, anúlala y prepara otra.";
export const AVISO_REGIMEN = "Revisar régimen con el contador";
export const SIMULACION_NO_GUARDA = "Simulación: no se guarda ni cambia el contrato.";
export const NO_ASESORIA =
  "Nexo no da asesoría legal: el régimen de cada contrato lo decide el contador o el abogado de la empresa.";
/** Liquidación (D3): aprobar finaliza el contrato con la fecha de egreso. */
export const AYUDA_APROBAR_LIQUIDACION = "Al aprobar, el contrato se finaliza con la fecha de egreso.";
/** Liquidación (D3): sin `rrhh.expedientes.contratos.finalizar`, "Aprobar" se ve deshabilitado con este motivo. */
export const MOTIVO_FALTA_FINALIZAR = "Para aprobar también necesitas el permiso de finalizar contratos.";
export const AGUINALDO_SIN_DEDUCCIONES = "El aguinaldo no lleva deducciones ni descuentos (art. 97 del Código del Trabajo).";

// ---------------------------------------------------------------- separación de funciones

/**
 * ¿Quien mira generó o calculó la planilla? Entonces "Aprobar planilla" se ve
 * deshabilitado con MOTIVO_SEPARACION (el servidor también lo rechaza). Se
 * compara el uuid de `sesionActual().user.id` (D1). Sin usuario → false.
 */
export function esAutorDePlanilla(
  p: { generada_por: string | null; calculada_por: string | null },
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return p.generada_por === userId || p.calculada_por === userId;
}

/** ¿Quien mira creó o calculó la liquidación? (misma regla que la planilla). */
export function esAutorDeLiquidacion(
  l: { calculada_por: string | null; creada_por?: string | null },
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return l.calculada_por === userId || l.creada_por === userId;
}

// ---------------------------------------------------------------- avisos del cálculo

/** Inicio de los avisos de parámetros "verificar" que escribe la RPC ("…: techo inss"). */
export const PREFIJO_AVISO_CONTADOR = "Valor pendiente de confirmar con el contador";
const PREFIJO = /^valor pendiente de confirmar con el contador\s*[:.]?\s*/i;
const MENCIONA_CONTADOR = /pendiente de confirmar con el contador/i;

/** ¿El aviso es de un valor que confirma el contador? */
export function esAvisoContador(aviso: string): boolean {
  return MENCIONA_CONTADOR.test(aviso);
}

/** Texto del aviso del contador sin el prefijo; si nombra un parámetro conocido, con su nombre de negocio. */
export function textoAvisoContador(aviso: string): string {
  if (!PREFIJO.test(aviso)) return aviso;
  const resto = aviso.replace(PREFIJO, "").trim();
  if (!resto) return aviso;
  const codigo = resto.toLowerCase().replace(/\s+/g, "_");
  if (esParametroConocido(codigo)) return etiquetaParametro(codigo);
  return resto.charAt(0).toUpperCase() + resto.slice(1);
}

/**
 * Separa los avisos de una planilla, liquidación o simulación: los del
 * contador (sin el prefijo) y el resto, sin repetidos y en su orden.
 */
export function separarAvisos(avisos: readonly string[] | null | undefined): { contador: string[]; otros: string[] } {
  const contador: string[] = [];
  const otros: string[] = [];
  const vistos = new Set<string>();
  for (const bruto of avisos ?? []) {
    const aviso = typeof bruto === "string" ? bruto.trim() : "";
    if (!aviso || vistos.has(aviso)) continue;
    vistos.add(aviso);
    if (esAvisoContador(aviso)) contador.push(textoAvisoContador(aviso));
    else otros.push(aviso);
  }
  return { contador, otros };
}

/** ¿Hay avisos del contador? (para mostrar AVISO_CONTADOR al aprobar o pagar). */
export function hayAvisosContador(avisos: readonly string[] | null | undefined): boolean {
  return (avisos ?? []).some((a) => typeof a === "string" && esAvisoContador(a));
}

// ---------------------------------------------------------------- motivo

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

/**
 * Valida un motivo obligatorio (anular, rechazar, descartar, cambiar
 * régimen…): null si es válido, o el mensaje de error para mostrar junto al
 * campo. La RPC vuelve a validar.
 */
export function validarMotivo(texto: unknown, min = MOTIVO_MIN, max = MOTIVO_MAX): string | null {
  // Lo llaman Server Actions: el argumento no es confiable aunque el tipo diga string.
  const largo = typeof texto === "string" ? texto.trim().length : 0;
  if (largo < min) return `Escribe el motivo (al menos ${min} caracteres).`;
  if (largo > max) return `El motivo es demasiado largo (hasta ${max} caracteres).`;
  return null;
}
