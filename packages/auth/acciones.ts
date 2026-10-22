"use server";

// Server Actions compartidas. Archivo aparte con "use server" (solo puede
// exportar funciones async). Un Client Component que necesite llamarlas las
// importa desde "@nexo/auth/acciones", no desde "@nexo/auth" (server-only).

import { redirect } from "next/navigation";
import { createServerClient } from "@nexo/supabase";
import { getPanelUrl } from "./panel";

/** Cierra la sesión del usuario y lo lleva al login central del panel (no hay login por módulo). */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect(new URL("/login", await getPanelUrl()).toString());
}
