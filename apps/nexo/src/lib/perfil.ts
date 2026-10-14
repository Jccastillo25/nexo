import "server-only";
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Contraseña puesta por un administrador (core.perfiles.debe_cambiar_password,
 * decisión 2026-10-14): mientras no la cambie, el panel lo manda a
 * /cambiar-contrasena. Si la RPC falla no bloquea el acceso — el permiso de
 * cada pantalla sigue protegido por core.has_permission.
 */
export async function exigirPasswordDefinitiva(supabase: ServerClient) {
  const { data } = await supabase.rpc("mi_perfil");
  if (data?.[0]?.debe_cambiar_password) redirect("/cambiar-contrasena");
}
