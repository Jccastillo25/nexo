"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { validarMotivo } from "@/lib/planilla/estados";
import { CAUSA_LIQUIDACION, esClaveDe } from "@/lib/planilla/etiquetas";
import type { CausaLiquidacion, MetodoPago } from "@/lib/planilla/tipos";

/**
 * Server Actions de Liquidaciones (C6–C8). Cada una: prepararAccion
 * (requirePermission ANTES de todo) → validación de formato → RPC con
 * `companyId` del servidor. Los montos, las vacaciones (del saldo), los
 * préstamos descontados (nunca del aguinaldo), la huella y la separación de
 * funciones son de las RPC `planilla_liquidacion_*`: aquí no se calcula nada.
 */

export interface CrearLiquidacionInput {
  contratoId: string;
  /** "YYYY-MM-DD". */
  fechaEgreso: string;
  causa: CausaLiquidacion;
  /** 0 a 31, hasta 2 decimales. */
  diasSalarioPendiente: number;
  /** Solo con causa `confianza` (art. 47). */
  mesesConfianza: number | null;
  nota: string | null;
}

export interface PagoLiquidacionInput {
  metodo: MetodoPago;
  referencia: string | null;
  /** "YYYY-MM-DD". */
  fecha: string;
}

const NOTA_MAX = 500;
const REFERENCIA_MAX = 120;
const REVISA = "Revisa los datos e intenta de nuevo.";

function dosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

function revalidarLiquidacion(id?: string) {
  revalidatePath(RUTA.liquidaciones());
  if (id) revalidatePath(RUTA.liquidacion(id));
}

/** Guarda la liquidación en estado Calculada con el saldo de vacaciones registrado. Devuelve su id. */
export async function crearLiquidacion(input: CrearLiquidacionInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.liquidacionesCalcular, "crearLiquidacion");
  if (!prep.ok) return prep;

  if (!esUuid(input?.contratoId)) return { ok: false, message: "Elige el contrato." };
  if (!esFechaIso(input.fechaEgreso)) return { ok: false, message: "Indica la fecha de egreso." };
  if (!esClaveDe(CAUSA_LIQUIDACION, input.causa)) return { ok: false, message: "Elige la causa de la terminación." };
  const pendiente = input.diasSalarioPendiente;
  if (typeof pendiente !== "number" || !Number.isFinite(pendiente) || pendiente < 0 || pendiente > 31 || !dosDecimales(pendiente)) {
    return { ok: false, message: "Los días de salario pendiente van de 0 a 31." };
  }
  const meses = input.causa === "confianza" ? input.mesesConfianza : null;
  if (meses !== null && (typeof meses !== "number" || !Number.isFinite(meses) || meses < 0 || meses > 99 || !dosDecimales(meses))) {
    return { ok: false, message: "Indica los meses adicionales del art. 47 con hasta dos decimales." };
  }
  const nota = typeof input.nota === "string" ? input.nota.trim() : "";
  if (nota.length > NOTA_MAX) return { ok: false, message: `La nota admite hasta ${NOTA_MAX} caracteres.` };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_liquidacion_crear",
    {
      p_contrato_id: input.contratoId,
      p_fecha_egreso: input.fechaEgreso,
      p_causa: input.causa,
      p_dias_salario_pendiente: pendiente,
      p_meses_confianza: meses,
      p_nota: nota || null,
    },
    "crearLiquidacion",
    "No se pudo preparar la liquidación. Intenta de nuevo."
  );
  if (r.ok) revalidarLiquidacion();
  return r;
}

export async function recalcularLiquidacion(liquidacionId: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.liquidacionesCalcular, "recalcularLiquidacion");
  if (!prep.ok) return prep;
  if (!esUuid(liquidacionId)) return { ok: false, message: REVISA };

  const r = await accionRpc(
    prep.ctx,
    "planilla_liquidacion_recalcular",
    { p_liquidacion_id: liquidacionId },
    "recalcularLiquidacion",
    "No se pudo volver a calcular la liquidación. Intenta de nuevo."
  );
  if (r.ok) revalidarLiquidacion(liquidacionId);
  return r;
}

/**
 * Aprueba otra persona (la RPC lo exige). Si el contrato sigue activo, la RPC
 * lo finaliza con la fecha de egreso y exige además el permiso de finalizar
 * contratos: esa regla vive en la RPC (para Web y Mobile), no aquí.
 */
export async function aprobarLiquidacion(liquidacionId: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.liquidacionesAprobar, "aprobarLiquidacion");
  if (!prep.ok) return prep;
  if (!esUuid(liquidacionId)) return { ok: false, message: REVISA };

  const r = await accionRpc(
    prep.ctx,
    "planilla_liquidacion_aprobar",
    { p_liquidacion_id: liquidacionId },
    "aprobarLiquidacion",
    "No se pudo aprobar la liquidación. Intenta de nuevo."
  );
  if (r.ok) {
    revalidarLiquidacion(liquidacionId);
    // Registra las vacaciones liquidadas y salda las cuotas de préstamo.
    revalidatePath(RUTA.vacaciones());
    revalidatePath(RUTA.prestamos());
  }
  return r;
}

export async function pagarLiquidacion(liquidacionId: string, pago: PagoLiquidacionInput): Promise<ActionResult> {
  const prep = await prepararAccion(P.liquidacionesPagar, "pagarLiquidacion");
  if (!prep.ok) return prep;
  if (!esUuid(liquidacionId)) return { ok: false, message: REVISA };
  if (pago?.metodo !== "cheque" && pago?.metodo !== "transferencia") {
    return { ok: false, message: "Indica el método de pago: cheque o transferencia." };
  }
  const referencia = typeof pago.referencia === "string" ? pago.referencia.trim() : "";
  if (referencia.length > REFERENCIA_MAX) return { ok: false, message: `La referencia admite hasta ${REFERENCIA_MAX} caracteres.` };
  if (!esFechaIso(pago.fecha)) return { ok: false, message: "Indica la fecha de pago." };

  const r = await accionRpc(
    prep.ctx,
    "planilla_liquidacion_pagar",
    {
      p_liquidacion_id: liquidacionId,
      p_metodo_pago: pago.metodo,
      p_referencia: referencia || null,
      p_fecha_pago: pago.fecha,
    },
    "pagarLiquidacion",
    "No se pudo marcar la liquidación como pagada. Intenta de nuevo."
  );
  if (r.ok) revalidarLiquidacion(liquidacionId);
  return r;
}

export async function anularLiquidacion(liquidacionId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.liquidacionesAnular, "anularLiquidacion");
  if (!prep.ok) return prep;
  if (!esUuid(liquidacionId)) return { ok: false, message: REVISA };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_liquidacion_anular",
    { p_liquidacion_id: liquidacionId, p_motivo: motivo.trim() },
    "anularLiquidacion",
    "No se pudo anular la liquidación. Intenta de nuevo."
  );
  if (r.ok) {
    revalidarLiquidacion(liquidacionId);
    // Devuelve el saldo de vacaciones y las cuotas de préstamo.
    revalidatePath(RUTA.vacaciones());
    revalidatePath(RUTA.prestamos());
    revalidatePath(RUTA.novedades());
  }
  return r;
}
