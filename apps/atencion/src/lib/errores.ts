import { mensajeDeError } from "@nexo/permissions";

// Denegaciones 42501 que las RPC de Atención escriben para el usuario
// (supabase/migrations/20261014224341_atencion_esquema.sql y
// 20261015173729_atencion_metricas.sql). mensajeDeError trata todo 42501 como
// "Tu rol no permite…" porque un 42501 de un GRANT faltante expone el schema;
// estos textos exactos sí se muestran tal cual porque dicen qué resolver.
const DENEGACIONES_PROPIAS = new Set([
  "Tu rol no permite iniciar atención así.",
  "No tenés asignada esa sucursal.",
  "Iniciá sesión.",
  "No tenés permiso para ver tus métricas.",
  "No tenés permiso para ver los reportes de Atención.",
]);

/** mensajeDeError + las denegaciones propias de las RPC de Atención (lista cerrada). */
export function mensajeAtencion(err: unknown, contexto: string, generico?: string): string {
  if (typeof err === "object" && err !== null) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (code === "42501" && typeof message === "string" && DENEGACIONES_PROPIAS.has(message.trim())) {
      return message.trim();
    }
  }
  return mensajeDeError(err, contexto, generico);
}
