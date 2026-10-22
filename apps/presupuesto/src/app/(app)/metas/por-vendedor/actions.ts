"use server";

import { revalidatePath } from "next/cache";
import { contextoConPermiso, P } from "@/lib/metas/permisos";
import { esDenegacion, mensajeUsuario } from "@/lib/metas/errores";
import type { Resultado } from "@/lib/metas/tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function periodoValido(anio: unknown, mes: unknown): boolean {
  return Number.isInteger(anio) && (anio as number) >= 2000 && (anio as number) <= 2100
    && Number.isInteger(mes) && (mes as number) >= 1 && (mes as number) <= 12;
}

function revalidar() {
  revalidatePath("/metas/por-vendedor");
  revalidatePath("/dashboard");
}

/** Escribe la meta sugerida de cada vendedor activo (public.presupuesto_generar_sugeridas). */
export async function generarSugeridas(anio: number, mes: number, reemplazarAjustadas: boolean): Promise<Resultado> {
  const ctx = await contextoConPermiso(P.metasVend);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };
  if (!periodoValido(anio, mes)) return { ok: false, message: "El periodo no es válido." };
  const { error } = await ctx.supabase.rpc("presupuesto_generar_sugeridas", {
    p_company_id: ctx.companyId,
    p_anio: anio,
    p_mes: mes,
    p_reemplazar_ajustadas: reemplazarAjustadas === true,
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_generar_sugeridas", "No se pudieron generar las metas. Intenta de nuevo."),
    };
  }
  revalidar();
  return { ok: true };
}

/** Ajusta a mano la meta de un vendedor (public.presupuesto_ajustar_meta). */
export async function ajustarMeta(vendedorId: string, anio: number, mes: number, montoUsd: number): Promise<Resultado> {
  const ctx = await contextoConPermiso(P.metasVend);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };
  if (typeof vendedorId !== "string" || !UUID.test(vendedorId)) return { ok: false, message: "El vendedor no es válido." };
  if (!periodoValido(anio, mes)) return { ok: false, message: "El periodo no es válido." };
  if (typeof montoUsd !== "number" || !Number.isFinite(montoUsd) || montoUsd < 0 || montoUsd > 1e12) {
    return { ok: false, message: "La meta debe ser un monto en US$ igual o mayor que 0." };
  }
  const { error } = await ctx.supabase.rpc("presupuesto_ajustar_meta", {
    p_company_id: ctx.companyId,
    p_vendedor_id: vendedorId,
    p_anio: anio,
    p_mes: mes,
    p_monto_usd: Math.round(montoUsd * 100) / 100,
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_ajustar_meta", "No se pudo guardar la meta. Intenta de nuevo."),
    };
  }
  revalidar();
  return { ok: true };
}
