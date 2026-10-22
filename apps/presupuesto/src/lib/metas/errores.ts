import { mensajeDeError, MENSAJE_SIN_PERMISO } from "@nexo/permissions";

/** Mensaje de denegación del módulo (Server Actions y RPC). */
export const SIN_PERMISO = "Tu rol no permite esta acción.";

// Las RPC public.presupuesto_* ya escriben en español neutro (20261020184030).
// La denegación de core.fn_exigir_permiso puede llegar con un texto antiguo
// o con el código técnico entre paréntesis. Estos patrones solo RECONOCEN el
// texto que devuelve la base (no se muestran): la interfaz enseña siempre
// SIN_PERMISO.
const DENEGACION_DE_LA_BASE = /^No (tenés|tienes) permiso/;

/** Traduce cualquier denegación al mensaje único del módulo; el resto pasa igual. */
export function normalizarDenegacion(mensaje: string): string {
  if (mensaje === MENSAJE_SIN_PERMISO || DENEGACION_DE_LA_BASE.test(mensaje)) return SIN_PERMISO;
  return mensaje;
}

/** mensajeDeError de @nexo/permissions (nunca SQL ni nombres internos) + mensaje único de denegación. */
export function mensajeUsuario(err: unknown, contexto: string, generico?: string): string {
  return normalizarDenegacion(mensajeDeError(err, contexto, generico));
}

/** Denegación de la RPC (SQLSTATE 42501). */
export function esDenegacion(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "42501";
}

// Errores por fila que escribe public.presupuesto_importar_facturas. Cualquier otro
// (conversión, restricción de la base, en inglés) se agrupa sin detalle técnico.
const MOTIVOS_CONOCIDOS = [
  "Falta el número de factura.",
  "Número de factura demasiado largo.",
  "Falta la fecha.",
  "Fecha fuera de rango",
  "Faltan los totales C$ o US$.",
  "Falta el vendedor.",
];

export function motivoDeFila(error: string | null | undefined): string {
  const e = (error ?? "").trim();
  return MOTIVOS_CONOCIDOS.some((m) => e.startsWith(m)) ? e : "Dato con formato inválido";
}
