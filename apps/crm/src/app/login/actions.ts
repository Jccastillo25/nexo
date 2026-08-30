"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * El login vive en el panel (apps/nexo) — ver
 * lib/supabase/middleware.ts. Esta zona solo necesita poder cerrar
 * sesion; redirige a "/" (relativo a esta zona, es decir /crm), y el
 * middleware se encarga de rebotar al login central ya que no queda
 * sesion.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
