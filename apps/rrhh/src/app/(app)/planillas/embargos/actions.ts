"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { validarMotivo } from "@/lib/planilla/estados";
import { aFraccion } from "@/lib/planilla/formato";
import type { MetodoEmbargo, TipoEmbargo } from "@/lib/planilla/tipos";

/**
 * Server Actions de Embargos (C5), con prestamos.gestionar. prepararAccion
 * (requirePermission ANTES de todo) → validación de formato → RPC con
 * `companyId` del servidor. El orden de descuento, el límite y el prorrateo
 * del monto mensual son del motor de planilla, no de aquí.
 */

export interface CrearEmbargoInput {
  contratoId: string;
  tipo: TipoEmbargo;
  metodo: MetodoEmbargo;
  /**
   * Lo que escribió la persona: con `porcentaje`, de 0 a 100 (aquí se
   * convierte a fracción con aFraccion); con `monto`, el monto MENSUAL en C$.
   */
  valor: number;
  topeTotal: number | null;
  referencia: string;
  /** "YYYY-MM-DD". */
  vigenteDesde: string;
  vigenteHasta: string | null;
  nota: string | null;
}

const NOTA_MAX = 300;
const REFERENCIA_MIN = 3;
const REFERENCIA_MAX = 200;
const MONTO_MAX = 100_000_000;

function dosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

export async function crearEmbargo(input: CrearEmbargoInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.prestamosGestionar, "crearEmbargo");
  if (!prep.ok) return prep;

  if (!esUuid(input?.contratoId)) return { ok: false, message: "Elige la persona." };
  if (input.tipo !== "alimentos" && input.tipo !== "judicial") return { ok: false, message: "Elige el tipo de embargo." };
  if (input.metodo !== "porcentaje" && input.metodo !== "monto") return { ok: false, message: "Elige si es un porcentaje o un monto mensual." };
  const v = input.valor;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || !dosDecimales(v)) {
    return { ok: false, message: "Indica un valor mayor que 0, con hasta dos decimales." };
  }
  if (input.metodo === "porcentaje" && v > 100) return { ok: false, message: "El porcentaje no puede ser mayor que 100." };
  if (input.metodo === "monto" && v >= MONTO_MAX) return { ok: false, message: "El monto mensual no es válido." };
  const tope = input.topeTotal;
  if (tope !== null && (typeof tope !== "number" || !Number.isFinite(tope) || tope <= 0 || tope >= MONTO_MAX || !dosDecimales(tope))) {
    return { ok: false, message: "El tope total de la orden debe ser mayor que 0, con hasta dos decimales." };
  }
  const referencia = typeof input.referencia === "string" ? input.referencia.trim() : "";
  if (referencia.length < REFERENCIA_MIN || referencia.length > REFERENCIA_MAX) {
    return { ok: false, message: `Indica la referencia de la orden (${REFERENCIA_MIN} a ${REFERENCIA_MAX} caracteres).` };
  }
  if (!esFechaIso(input.vigenteDesde)) return { ok: false, message: "Indica desde cuándo rige el embargo." };
  const hasta = input.vigenteHasta;
  if (hasta !== null && (!esFechaIso(hasta) || hasta < input.vigenteDesde)) {
    return { ok: false, message: "La fecha de fin debe ser igual o posterior a la de inicio." };
  }
  const nota = typeof input.nota === "string" ? input.nota.trim() : "";
  if (nota.length > NOTA_MAX) return { ok: false, message: `La nota admite hasta ${NOTA_MAX} caracteres.` };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_embargo_crear",
    {
      p_contrato_id: input.contratoId,
      p_tipo: input.tipo,
      p_metodo: input.metodo,
      // Conversión de entrada (no es cálculo de planilla): 25 % → 0.25.
      p_valor: input.metodo === "porcentaje" ? aFraccion(v) : v,
      p_tope_total: tope,
      p_referencia: referencia,
      p_vigente_desde: input.vigenteDesde,
      p_vigente_hasta: hasta,
      p_nota: nota || null,
    },
    "crearEmbargo",
    "No se pudo registrar el embargo. Intenta de nuevo."
  );
  if (r.ok) revalidatePath(RUTA.embargos());
  return r;
}

/**
 * Termina un embargo vigente con su fecha de fin. Con el día anterior al
 * inicio, la RPC lo deja anulado (registro por error, sin cobros aprobados).
 */
export async function terminarEmbargo(embargoId: string, vigenteHasta: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.prestamosGestionar, "terminarEmbargo");
  if (!prep.ok) return prep;
  if (!esUuid(embargoId)) return { ok: false, message: "Revisa los datos e intenta de nuevo." };
  if (!esFechaIso(vigenteHasta)) return { ok: false, message: "Indica la fecha de fin." };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_embargo_terminar",
    { p_embargo_id: embargoId, p_vigente_hasta: vigenteHasta, p_motivo: motivo.trim() },
    "terminarEmbargo",
    "No se pudo terminar el embargo. Intenta de nuevo."
  );
  if (r.ok) revalidatePath(RUTA.embargos());
  return r;
}
