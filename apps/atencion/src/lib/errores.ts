import { mensajeDeError } from "@nexo/permissions";

// Los textos de la izquierda son los que devuelven hoy las RPC de Atención
// (supabase/migrations/20261014224341_atencion_esquema.sql,
// 20261015172012_atencion_reactivar_factura_unica.sql y
// 20261015173729_atencion_metricas.sql), todavía con voseo. Se comparan tal
// cual (NO cambiarlos aquí sin cambiar la base) y se muestra el texto de la
// derecha, en español neutro.

// Denegaciones 42501 escritas para el usuario. mensajeDeError trata todo 42501
// como "Tu rol no permite…" porque un 42501 de un GRANT faltante expone el
// schema; estos textos exactos sí se muestran porque dicen qué resolver.
const DENEGACIONES_PROPIAS = new Map<string, string>([
  ["Tu rol no permite iniciar atención así.", "Tu rol no permite iniciar atención así."],
  ["No tenés asignada esa sucursal.", "No tienes asignada esa sucursal."],
  ["Iniciá sesión.", "Inicia sesión."],
  ["No tenés permiso para ver tus métricas.", "No tienes permiso para ver tus métricas."],
  ["No tenés permiso para ver los reportes de Atención.", "No tienes permiso para ver los reportes de Atención."],
]);

// Mensajes P0001 (raise exception) con voseo. mensajeDeError los mostraría tal
// cual; aquí se cambian por su versión neutra. Los que no están en la lista
// (sin voseo) siguen pasando sin cambios.
const MENSAJES_PROPIOS = new Map<string, string>([
  ["Iniciá atención en un puesto primero.", "Inicia atención en un puesto primero."],
  ["Iniciá atención en recepción primero.", "Inicia atención en recepción primero."],
  ["Iniciá atención primero.", "Inicia atención primero."],
  ["Elegí si vas a trabajar en recepción o en un puesto.", "Elige si vas a trabajar en recepción o en un puesto."],
  ["Elegí la sucursal donde vas a trabajar.", "Elige la sucursal donde vas a trabajar."],
  [
    "Ese puesto se acaba de ocupar o ya tenés una atención abierta. Intentá de nuevo.",
    "Ese puesto se acaba de ocupar o ya tienes una atención abierta. Intenta de nuevo.",
  ],
  [
    "Finalizá o marcá ausente el turno actual antes de cerrar.",
    "Finaliza el turno actual o márcalo como ausente antes de cerrar.",
  ],
  [
    "Finalizá o marcá ausente el turno actual antes de llamar otro.",
    "Finaliza el turno actual o márcalo como ausente antes de llamar otro.",
  ],
  ["Escribí el nombre del cliente.", "Escribe el nombre del cliente."],
  ["Elegí una sucursal tuya o iniciá atención.", "Elige una de tus sucursales o inicia atención."],
  ["No tenés un turno llamado.", "No tienes un turno llamado."],
  ["No tenés sucursales para consultar.", "No tienes sucursales para consultar."],
]);

/** mensajeDeError + los textos propios de las RPC de Atención (listas cerradas), en español neutro. */
export function mensajeAtencion(err: unknown, contexto: string, generico?: string): string {
  if (typeof err === "object" && err !== null) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    const texto = typeof message === "string" ? message.trim() : "";
    if (code === "42501") {
      const neutro = DENEGACIONES_PROPIAS.get(texto);
      if (neutro) return neutro;
    } else if (code === "P0001") {
      const neutro = MENSAJES_PROPIOS.get(texto);
      if (neutro) return neutro;
    }
  }
  return mensajeDeError(err, contexto, generico);
}
