"use server";

import { revalidatePath } from "next/cache";
import { contextoConPermiso, P } from "@/lib/metas/permisos";
import { esDenegacion, mensajeUsuario } from "@/lib/metas/errores";
import type { Resultado } from "@/lib/metas/tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guarda nombre, usuario vinculado y estado de un vendedor
 * (public.presupuesto_guardar_vendedor). La RPC escribe user_id tal cual llega
 * (H1): por eso los tres campos son obligatorios y siempre llevan el valor
 * actual de la fila, aunque solo cambie uno; null en userId desvincula.
 */
export async function guardarVendedor(datos: {
  vendedorId: string;
  nombre: string;
  userId: string | null;
  activo: boolean;
}): Promise<Resultado> {
  const ctx = await contextoConPermiso(P.vendedores);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };

  const { vendedorId, nombre, userId, activo } = datos ?? ({} as typeof datos);
  if (typeof vendedorId !== "string" || !UUID.test(vendedorId)) return { ok: false, message: "El vendedor no es válido." };
  if (typeof nombre !== "string" || nombre.trim().length < 1 || nombre.trim().length > 120) {
    return { ok: false, message: "El nombre debe tener entre 1 y 120 caracteres." };
  }
  if (userId !== null && (typeof userId !== "string" || !UUID.test(userId))) return { ok: false, message: "El usuario no es válido." };
  if (typeof activo !== "boolean") return { ok: false, message: "Indica si el vendedor está activo." };

  const { error } = await ctx.supabase.rpc("presupuesto_guardar_vendedor", {
    p_company_id: ctx.companyId,
    p_vendedor_id: vendedorId,
    p_nombre: nombre.trim(),
    p_user_id: userId,
    p_activo: activo,
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_guardar_vendedor", "No se pudo guardar el vendedor. Intenta de nuevo."),
    };
  }
  revalidatePath("/configuracion/vendedores");
  revalidatePath("/dashboard");
  revalidatePath("/facturas");
  return { ok: true };
}
