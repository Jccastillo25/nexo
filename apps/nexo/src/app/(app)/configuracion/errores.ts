import { mensajeDeError } from "@nexo/permissions";

// Denegaciones 42501 que las RPC de administración escriben para el usuario
// (supabase/migrations/20261014203144_nexo_usuarios_roles_esquema.sql, línea
// del `raise` entre paréntesis). mensajeDeError trata todo 42501 como "Tu rol
// no permite…" porque un 42501 de un GRANT faltante expone el schema; estos
// textos exactos sí dicen qué pasó, así que se muestran.
//
// La CLAVE es el texto literal que devuelve la base (escrito con voseo y
// "owner" en la migración): NO cambiarla, o deja de coincidir. El VALOR es lo
// que ve la persona, en español neutro (decisión 2026-10-20).
// Excluida a propósito la denegación genérica de core.fn_exigir_permiso
// (l. 233), porque interpola el código del permiso.
const DENEGACIONES_PROPIAS = new Map<string, string>([
  ["Solo el owner puede modificar al owner.", "Solo el propietario puede modificar al propietario."], // l. 274
  [
    "No podés administrar a un usuario cuyo rol tiene permisos que vos no tenés.", // l. 279
    "No puedes administrar a un usuario cuyo rol tiene permisos que tú no tienes.",
  ],
  [
    "No podés asignar un rol con permisos que vos no tenés.", // l. 303
    "No puedes asignar un rol con permisos que tú no tienes.",
  ],
  ["No tenés permiso para buscar empleados.", "No tienes permiso para buscar empleados."], // l. 460
  ["No podés otorgar permisos que vos no tenés.", "No puedes otorgar permisos que tú no tienes."], // l. 562
  ["No podés editar el rol que tenés asignado.", "No puedes editar el rol que tienes asignado."], // l. 574
  [
    "No podés editar un rol que tiene permisos que vos no tenés.", // l. 579
    "No puedes editar un rol que tiene permisos que tú no tienes.",
  ],
  [
    "No podés eliminar un rol que tiene permisos que vos no tenés.", // l. 643
    "No puedes eliminar un rol que tiene permisos que tú no tienes.",
  ],
  ["No podés cambiar tu propio rol.", "No puedes cambiar tu propio rol."], // l. 737
  ["No podés cambiar tu propio estado.", "No puedes cambiar tu propio estado."], // l. 784
  ["El owner no se puede desactivar.", "El propietario no se puede desactivar."], // l. 788
  [
    "Tu propia contraseña se cambia desde tu perfil, no desde administración.", // l. 815
    "Tu propia contraseña se cambia desde tu perfil, no desde administración.",
  ],
  ["Sesión requerida.", "Tu sesión terminó. Vuelve a iniciar sesión."], // l. 841
]);

// P0001 de public.admin_guardar_rol (l. 558) que interpola los códigos de
// permiso rechazados: se reemplaza por un texto propio.
const PERMISOS_INVALIDOS = /^Permisos inválidos o de apps no habilitadas/;

/**
 * mensajeDeError + las denegaciones propias de las RPC de administración de
 * Nexo (lista cerrada, traducidas a español neutro) + el P0001 de permisos
 * inválidos sin sus códigos.
 */
export function mensajeAdministracion(err: unknown, contexto: string, generico?: string): string {
  if (typeof err === "object" && err !== null) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    const texto = typeof message === "string" ? message.trim() : "";
    const propio = code === "42501" ? DENEGACIONES_PROPIAS.get(texto) : undefined;
    if (propio) return propio;
    if (code === "P0001" && PERMISOS_INVALIDOS.test(texto)) {
      console.error(contexto, err);
      return "Alguno de los permisos elegidos no es válido o su app no está habilitada.";
    }
  }
  return mensajeDeError(err, contexto, generico);
}
