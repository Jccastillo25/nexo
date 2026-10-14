"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPanelUrl } from "@/lib/panel";

// No hay login propio. Cerrar la sesión del usuario vuelve al login central.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(new URL("/login", await getPanelUrl()).toString());
}
