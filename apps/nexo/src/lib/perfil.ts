import "server-only";
import { redirect } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Contraseña puesta por un administrador (core.perfiles.debe_cambiar_password,
 * decisión 2026-10-14): mientras no la cambie, el panel lo manda a
 * /cambiar-contrasena. Si la RPC falla no bloquea el acceso — el permiso de
 * cada pantalla sigue protegido por core.has_permission. Usa el cliente
 * compartido del request (contextoActual), sin otra llamada a Auth.
 */
export async function exigirPasswordDefinitiva(): Promise<void> {
  const { supabase } = await contextoActual<Database>();
  const { data } = await supabase.rpc("mi_perfil");
  if (data?.[0]?.debe_cambiar_password) redirect("/cambiar-contrasena");
}
