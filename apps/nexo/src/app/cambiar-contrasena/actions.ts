"use server";

import { redirect } from "next/navigation";
import { mensajeDeError } from "@nexo/permissions";
import { createServerClient } from "@nexo/supabase";
import type { Database } from "@/lib/supabase/database.types";

export type CambioState = {
  error: string | null;
  /** Campo al que pertenece el error, para mostrarlo junto a él. Sin campo, va al pie. */
  campo?: "password" | "confirmacion";
};

// Supabase Auth "weak_password": muy corta, débil o expuesta en filtraciones
// (revisión de seguridad 2026-10-17). El texto crudo de Auth no se muestra.
const CONTRASENA_DEBIL = "La contraseña no cumple la política de seguridad (es débil o aparece en filtraciones conocidas). Elige otra.";

/**
 * Primer ingreso con contraseña temporal: el usuario pone la suya
 * (supabase.auth.updateUser con su propia sesión) y se baja la marca
 * core.perfiles.debe_cambiar_password vía public.confirmar_cambio_password.
 * No lleva requirePermission: solo cambia la contraseña de la propia sesión.
 */
export async function cambiarPassword(_prev: CambioState, formData: FormData): Promise<CambioState> {
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", campo: "password" };
  if (password !== confirmacion) return { error: "Las contraseñas no coinciden.", campo: "confirmacion" };

  const supabase = await createServerClient<Database>();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // La comparación con el texto de Supabase Auth es interna: elige un
    // mensaje propio; el texto crudo nunca llega a la pantalla.
    if (error.code === "same_password" || error.message.toLowerCase().includes("different")) {
      return { error: "La nueva contraseña tiene que ser distinta de la temporal.", campo: "password" };
    }
    if (error.code === "weak_password") {
      console.error("cambiarPassword: auth.updateUser", error);
      return { error: CONTRASENA_DEBIL, campo: "password" };
    }
    return {
      error: mensajeDeError(error, "cambiarPassword: auth.updateUser", "No se pudo cambiar la contraseña. Intenta de nuevo."),
    };
  }

  const { error: rpcError } = await supabase.rpc("confirmar_cambio_password");
  if (rpcError) {
    console.error("cambiarPassword: confirmar_cambio_password", rpcError);
    return { error: "La contraseña cambió, pero no se pudo confirmar. Vuelve a iniciar sesión e intenta de nuevo." };
  }

  redirect("/");
}
