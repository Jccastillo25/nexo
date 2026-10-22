"use server";

import { revalidatePath } from "next/cache";
import { contextoConPermiso, P } from "@/lib/metas/permisos";
import { esDenegacion, mensajeUsuario } from "@/lib/metas/errores";
import type { Resultado } from "@/lib/metas/tipos";

/**
 * Guarda el presupuesto anual (public.presupuesto_guardar_anual).
 * crecimiento y porcentajes van como fracciones (32 % → 0.32).
 */
export async function guardarPresupuesto(
  anio: number,
  ventaBaseUsd: number,
  crecimiento: number,
  porcentajes: number[]
): Promise<Resultado> {
  const ctx = await contextoConPermiso(P.presupuesto);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return { ok: false, message: "El año no es válido." };
  if (typeof ventaBaseUsd !== "number" || !Number.isFinite(ventaBaseUsd) || ventaBaseUsd < 0) {
    return { ok: false, message: "La venta base debe ser un monto en US$ igual o mayor que 0." };
  }
  if (typeof crecimiento !== "number" || !Number.isFinite(crecimiento) || crecimiento <= -1 || crecimiento > 10) {
    return { ok: false, message: "El crecimiento debe estar entre -100 % y 1000 %." };
  }
  if (!Array.isArray(porcentajes) || porcentajes.length !== 12 || porcentajes.some((x) => typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1)) {
    return { ok: false, message: "Hacen falta los 12 porcentajes mensuales, cada uno entre 0 % y 100 %." };
  }

  const { error } = await ctx.supabase.rpc("presupuesto_guardar_anual", {
    p_company_id: ctx.companyId,
    p_anio: anio,
    p_venta_base_usd: Math.round(ventaBaseUsd * 100) / 100,
    p_crecimiento: Math.round(crecimiento * 10000) / 10000,
    p_porcentajes: porcentajes.map((x) => Math.round(x * 1e6) / 1e6),
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_guardar_anual", "No se pudo guardar el presupuesto. Intenta de nuevo."),
    };
  }
  revalidatePath("/anual");
  revalidatePath("/dashboard");
  revalidatePath("/metas/por-vendedor");
  return { ok: true };
}
