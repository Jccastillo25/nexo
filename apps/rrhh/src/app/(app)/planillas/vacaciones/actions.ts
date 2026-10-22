"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { MOTIVO_MAX, validarMotivo } from "@/lib/planilla/estados";
import type { TipoVacaciones } from "@/lib/planilla/tipos";

/**
 * Server Actions de Vacaciones (C1–C3). Cada una: prepararAccion
 * (requirePermission ANTES de todo) → validación de formato → RPC con
 * `companyId` del servidor. Las reglas (saldo, separación de funciones,
 * corte del saldo inicial, rango de fechas) son de las RPC
 * `planilla_vacaciones_*`, que también usará Nexo Mobile: aquí no se calcula
 * ningún saldo.
 */

/** Tipos que se registran a mano (la `liquidacion` la crea la liquidación aprobada). */
type TipoRegistrable = Exclude<TipoVacaciones, "liquidacion">;
const TIPOS: readonly TipoRegistrable[] = ["goce", "pago", "ajuste", "saldo_inicial"];

export interface RegistrarVacacionesInput {
  contratoId: string;
  tipo: TipoRegistrable;
  /** "YYYY-MM-DD". */
  fechaInicio: string;
  /** Solo en goce: último día de vacaciones. En los demás tipos se ignora (la RPC usa la fecha de inicio). */
  fechaFin: string | null;
  /** Hasta 2 decimales; negativo solo en un ajuste. */
  dias: number;
  /** Obligatorio (5 a 500) en ajuste y saldo inicial; opcional (hasta 500) en goce y pago. */
  motivo: string | null;
}

const REVISA = "Revisa los datos del formulario e intenta de nuevo.";

function revalidarVacaciones() {
  revalidatePath(RUTA.vacaciones());
  revalidatePath(RUTA.vacacionesMovimientos());
}

/** ¿Número finito con hasta 2 decimales? */
function dosDecimales(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

export async function registrarVacaciones(input: RegistrarVacacionesInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.vacacionesRegistrar, "registrarVacaciones");
  if (!prep.ok) return prep;

  const tipo = input?.tipo;
  if (!esUuid(input?.contratoId)) return { ok: false, message: "Elige la persona." };
  if (!TIPOS.includes(tipo)) return { ok: false, message: "Elige el tipo de movimiento." };
  if (!esFechaIso(input.fechaInicio)) return { ok: false, message: "Indica la fecha." };
  const fechaFin = tipo === "goce" ? input.fechaFin : null;
  if (tipo === "goce" && (!esFechaIso(fechaFin) || fechaFin < input.fechaInicio)) {
    return { ok: false, message: "Indica el último día de vacaciones (igual o posterior al primero)." };
  }
  const dias = input.dias;
  if (!dosDecimales(dias) || Math.abs(dias) >= 1000) {
    return { ok: false, message: "Indica una cantidad de días válida (hasta dos decimales)." };
  }
  if ((tipo === "goce" || tipo === "pago") && dias <= 0) return { ok: false, message: "Los días deben ser mayores que 0." };
  if (tipo === "ajuste" && dias === 0) return { ok: false, message: "Un ajuste no puede ser de 0 días." };
  if (tipo === "saldo_inicial" && dias < 0) return { ok: false, message: "El saldo inicial no puede ser negativo." };

  const motivo = typeof input.motivo === "string" ? input.motivo.trim() : "";
  if (tipo === "ajuste" || tipo === "saldo_inicial") {
    const problema = validarMotivo(motivo);
    if (problema) return { ok: false, message: problema };
  } else if (motivo.length > MOTIVO_MAX) {
    return { ok: false, message: `El motivo es demasiado largo (hasta ${MOTIVO_MAX} caracteres).` };
  }

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_vacaciones_registrar",
    {
      p_contrato_id: input.contratoId,
      p_tipo: tipo,
      p_fecha_inicio: input.fechaInicio,
      p_fecha_fin: fechaFin,
      p_dias: dias,
      p_motivo: motivo || null,
    },
    "registrarVacaciones",
    "No se pudo registrar el movimiento. Intenta de nuevo."
  );
  if (r.ok) revalidarVacaciones();
  return r;
}

export async function aprobarVacaciones(movimientoId: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.vacacionesAprobar, "aprobarVacaciones");
  if (!prep.ok) return prep;
  if (!esUuid(movimientoId)) return { ok: false, message: REVISA };

  const r = await accionRpc(
    prep.ctx,
    "planilla_vacaciones_aprobar",
    { p_movimiento_id: movimientoId },
    "aprobarVacaciones",
    "No se pudo aprobar el movimiento. Intenta de nuevo."
  );
  if (r.ok) {
    revalidarVacaciones();
    // Un pago sin gozar aprobado entra como novedad de la planilla del período.
    revalidatePath(RUTA.novedades());
  }
  return r;
}

export async function rechazarVacaciones(movimientoId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.vacacionesAprobar, "rechazarVacaciones");
  if (!prep.ok) return prep;
  if (!esUuid(movimientoId)) return { ok: false, message: REVISA };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_vacaciones_rechazar",
    { p_movimiento_id: movimientoId, p_motivo: motivo.trim() },
    "rechazarVacaciones",
    "No se pudo rechazar la solicitud. Intenta de nuevo."
  );
  if (r.ok) revalidarVacaciones();
  return r;
}

export async function anularVacaciones(movimientoId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.vacacionesAprobar, "anularVacaciones");
  if (!prep.ok) return prep;
  if (!esUuid(movimientoId)) return { ok: false, message: REVISA };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_vacaciones_anular",
    { p_movimiento_id: movimientoId, p_motivo: motivo.trim() },
    "anularVacaciones",
    "No se pudo anular el movimiento. Intenta de nuevo."
  );
  if (r.ok) {
    revalidarVacaciones();
    revalidatePath(RUTA.novedades());
  }
  return r;
}
