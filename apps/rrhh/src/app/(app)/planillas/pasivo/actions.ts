"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { esMes, primerDiaMes } from "@/lib/planilla/periodos";

/**
 * Copia mensual de provisiones (A4): planilla_provisiones_generar
 * (rrhh.planillas.planilla.generar) con el primer día del mes. Idempotente:
 * vuelve a generar la copia del mes con los valores de hoy, sin duplicar.
 * La RPC rechaza meses futuros. Devuelve cuántos contratos guardó.
 */
export async function generarProvisiones(mes: string): Promise<ActionResult<number>> {
  const prep = await prepararAccion(P.planillaGenerar, "generarProvisiones");
  if (!prep.ok) return prep;
  if (!esMes(mes)) return { ok: false, message: "Indica el mes de las provisiones." };

  const r = await accionRpc<number>(
    prep.ctx,
    "planilla_provisiones_generar",
    { p_mes: primerDiaMes(mes) },
    "generarProvisiones",
    "No se pudieron generar las provisiones. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidatePath(RUTA.pasivo());
  return { ok: true, data: typeof r.data === "number" ? r.data : 0 };
}
