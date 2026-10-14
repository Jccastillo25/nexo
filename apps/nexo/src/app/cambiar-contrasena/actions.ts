"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CambioState = { error: string | null };

/**
 * Primer ingreso con contraseña temporal: el usuario pone la suya
 * (supabase.auth.updateUser con su propia sesión) y se baja la marca
 * core.perfiles.debe_cambiar_password vía public.confirmar_cambio_password.
 */
export async function cambiarPassword(_prev: CambioState, formData: FormData): Promise<CambioState> {
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmacion) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error: error.message.toLowerCase().includes("different")
        ? "La nueva contraseña tiene que ser distinta de la temporal."
        : `No se pudo cambiar la contraseña: ${error.message}`,
    };
  }

  const { error: rpcError } = await supabase.rpc("confirmar_cambio_password");
  if (rpcError) return { error: `La contraseña cambió, pero no se pudo confirmar: ${rpcError.message}` };

  redirect("/");
}
