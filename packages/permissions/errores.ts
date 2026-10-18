// Mensajes de error aptos para el usuario (revisión de seguridad 2026-10-17,
// hallazgo H2). Nunca se reenvía a la UI el texto crudo de Postgres/PostgREST
// (nombres de constraints, schemas, SQLSTATE) ni el código interno de un
// permiso: el detalle queda en el log del servidor.
// Sin importar index.ts (evita un ciclo): PermissionDeniedError se reconoce
// por su `name`.

export const MENSAJE_SIN_PERMISO = "Tu rol no permite realizar esta acción.";
export const MENSAJE_GENERICO = "No se pudo completar la operación. Intenta de nuevo.";

interface ErrorConCodigo {
  code?: unknown;
  message?: unknown;
}

// RPC antiguas (RRHH) lanzan la denegación como P0001 con el código del
// permiso en el texto: "Permiso denegado: rrhh.expedientes…" / "Sin permiso".
const DENEGACION = /^(permiso denegado|sin permiso|no autorizado)/i;

/**
 * Traduce un error de Supabase/PostgREST, o el PermissionDeniedError de
 * requirePermission, a un mensaje seguro para mostrar:
 *
 * - Denegación (PermissionDeniedError, SQLSTATE 42501 o texto de denegación)
 *   → MENSAJE_SIN_PERMISO.
 * - P0001 (`raise exception` propio de la RPC, escrito para el usuario)
 *   → su mensaje tal cual.
 * - Cualquier otro (constraint, uuid inválido, red, PGRST*) → `generico`.
 *
 * Se registra con `contexto` todo lo que no se muestra tal cual, salvo el
 * PermissionDeniedError de requirePermission (denegación esperada, sin
 * detalle técnico que guardar).
 */
export function mensajeDeError(err: unknown, contexto: string, generico: string = MENSAJE_GENERICO): string {
  if (err instanceof Error && err.name === "PermissionDeniedError") return MENSAJE_SIN_PERMISO;

  const e = (typeof err === "object" && err !== null ? err : {}) as ErrorConCodigo;
  const code = typeof e.code === "string" ? e.code : undefined;
  const message = typeof e.message === "string" ? e.message.trim() : "";

  if (code === "P0001" && message && !DENEGACION.test(message)) return message;

  console.error(contexto, err);
  if (code === "42501" || DENEGACION.test(message)) return MENSAJE_SIN_PERMISO;
  return generico;
}
