import { mensajeDeError } from "@nexo/permissions";

// Denegaciones 42501 que las RPC de administración escriben para el usuario
// (supabase/migrations/20261014203144_nexo_usuarios_roles_esquema.sql, línea
// del `raise` entre paréntesis). mensajeDeError trata todo 42501 como "Tu rol
// no permite…" porque un 42501 de un GRANT faltante expone el schema; estos
// textos exactos sí se muestran tal cual porque dicen qué pasó.
// Excluido a propósito: 'No tenés permiso para esta acción (%s).' (l. 233,
// core.fn_exigir_permiso) porque interpola el código del permiso.
const DENEGACIONES_PROPIAS = new Set([
  "Solo el owner puede modificar al owner.", // l. 274
  "No podés administrar a un usuario cuyo rol tiene permisos que vos no tenés.", // l. 279
  "No podés asignar un rol con permisos que vos no tenés.", // l. 303
  "No tenés permiso para buscar empleados.", // l. 460
  "No podés otorgar permisos que vos no tenés.", // l. 562
  "No podés editar el rol que tenés asignado.", // l. 574
  "No podés editar un rol que tiene permisos que vos no tenés.", // l. 579
  "No podés eliminar un rol que tiene permisos que vos no tenés.", // l. 643
  "No podés cambiar tu propio rol.", // l. 737
  "No podés cambiar tu propio estado.", // l. 784
  "El owner no se puede desactivar.", // l. 788
  "Tu propia contraseña se cambia desde tu perfil, no desde administración.", // l. 815
  "Sesión requerida.", // l. 841
]);

// P0001 de public.admin_guardar_rol (l. 558) que interpola los códigos de
// permiso rechazados: se reemplaza por un texto propio.
const PERMISOS_INVALIDOS = /^Permisos inválidos o de apps no habilitadas/;

/**
 * mensajeDeError + las denegaciones propias de las RPC de administración de
 * Nexo (lista cerrada) + el P0001 de permisos inválidos sin sus códigos.
 */
export function mensajeAdministracion(err: unknown, contexto: string, generico?: string): string {
  if (typeof err === "object" && err !== null) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    const texto = typeof message === "string" ? message.trim() : "";
    if (code === "42501" && DENEGACIONES_PROPIAS.has(texto)) return texto;
    if (code === "P0001" && PERMISOS_INVALIDOS.test(texto)) {
      console.error(contexto, err);
      return "Alguno de los permisos elegidos no es válido o su app no está habilitada.";
    }
  }
  return mensajeDeError(err, contexto, generico);
}
