"use server";

import { revalidatePath } from "next/cache";
import { contextoConPermiso, P } from "@/lib/metas/permisos";
import { esDenegacion, mensajeUsuario } from "@/lib/metas/errores";
import type { Resultado } from "@/lib/metas/tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vendedores que se muestran en el cuadro de meta del equipo
 * (public.presupuesto_guardar_tablero). El resto queda oculto. Es una
 * elección de la empresa y no cambia metas ni totales.
 */
export async function guardarTablero(vendedorIds: string[]): Promise<Resultado<{ mostrados: number; ocultos: number }>> {
  const ctx = await contextoConPermiso(P.metasVend);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };
  if (!Array.isArray(vendedorIds) || vendedorIds.length > 500 || !vendedorIds.every((id) => typeof id === "string" && UUID.test(id))) {
    return { ok: false, message: "La selección de vendedores no es válida." };
  }
  const { data, error } = await ctx.supabase.rpc("presupuesto_guardar_tablero", {
    p_company_id: ctx.companyId,
    p_vendedor_ids: [...new Set(vendedorIds)],
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_guardar_tablero", "No se pudo guardar la selección. Intenta de nuevo."),
    };
  }
  revalidatePath("/dashboard");
  return { ok: true, data: data as { mostrados: number; ocultos: number } };
}
