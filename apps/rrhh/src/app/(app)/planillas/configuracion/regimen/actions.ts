"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { validarMotivo } from "@/lib/planilla/estados";
import { aFraccion } from "@/lib/planilla/formato";

/**
 * Acciones de la ficha de régimen (A2). Cada una: prepararAccion
 * (requirePermission ANTES de validar o llamar) → validación de formato →
 * RPC con `p_company_id` del servidor (rpcPlanilla lo pone) → revalidatePath.
 * La RPC vuelve a validar permiso, coherencia del régimen, fechas y motivo
 * (sus mensajes P0001 se muestran tal cual).
 */

/** Datos del formulario "Cambiar régimen" / "Asignar régimen". El % llega de 0 a 100. */
export interface CambioRegimenInput {
  contratoId: string;
  regimen: "laboral" | "servicios_profesionales";
  /** Solo laboral. */
  regimenInss?: "integral" | "ivm";
  /** Solo servicios profesionales. */
  metodoIr?: "retencion_fija" | "exento";
  /** Solo con retención fija: 0 a 100. */
  porcentajeIr?: number | null;
  /** Solo servicios profesionales (el laboral lleva todas). */
  pagaVacaciones?: boolean;
  pagaAguinaldo?: boolean;
  pagaIndemnizacion?: boolean;
  vigenteDesde: string;
  motivo: string;
}

function fallo(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function revalidarFicha(contratoId: string) {
  revalidatePath(RUTA.regimen());
  revalidatePath(RUTA.regimenContrato(contratoId));
}

/** planilla_regimen_cambiar (rrhh.planillas.regimen.cambiar). */
export async function cambiarRegimen(input: CambioRegimenInput): Promise<ActionResult> {
  const prep = await prepararAccion(P.regimenCambiar, "cambiarRegimen");
  if (!prep.ok) return prep;

  const datos = (typeof input === "object" && input !== null ? input : {}) as Partial<CambioRegimenInput>;
  if (!esUuid(datos.contratoId)) return fallo("No se encontró el contrato.");
  if (!esFechaIso(datos.vigenteDesde)) return fallo("Indica la fecha efectiva del cambio.");
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  const problemaMotivo = validarMotivo(motivo);
  if (problemaMotivo) return fallo(problemaMotivo);

  let regimen: Record<string, unknown>;
  if (datos.regimen === "laboral") {
    if (datos.regimenInss !== "integral" && datos.regimenInss !== "ivm") return fallo("Elige el régimen INSS: Integral o IVM.");
    regimen = {
      p_regimen: "laboral",
      p_regimen_inss: datos.regimenInss,
      p_metodo_ir: "tabla_progresiva",
      p_porcentaje_ir: null,
      p_paga_vacaciones: true,
      p_paga_aguinaldo: true,
      p_paga_indemnizacion: true,
    };
  } else if (datos.regimen === "servicios_profesionales") {
    if (datos.metodoIr !== "retencion_fija" && datos.metodoIr !== "exento") {
      return fallo("Elige el método de IR: retención fija o exento.");
    }
    let porcentaje: number | null = null;
    if (datos.metodoIr === "retencion_fija") {
      const pct = datos.porcentajeIr;
      if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) {
        return fallo("El % de retención va de 0 a 100.");
      }
      porcentaje = aFraccion(pct);
    }
    if (
      typeof datos.pagaVacaciones !== "boolean" ||
      typeof datos.pagaAguinaldo !== "boolean" ||
      typeof datos.pagaIndemnizacion !== "boolean"
    ) {
      return fallo("Indica qué prestaciones lleva el contrato.");
    }
    regimen = {
      p_regimen: "servicios_profesionales",
      p_regimen_inss: "ninguno",
      p_metodo_ir: datos.metodoIr,
      p_porcentaje_ir: porcentaje,
      p_paga_vacaciones: datos.pagaVacaciones,
      p_paga_aguinaldo: datos.pagaAguinaldo,
      p_paga_indemnizacion: datos.pagaIndemnizacion,
    };
  } else {
    return fallo("Elige el régimen: laboral o servicios profesionales.");
  }

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_regimen_cambiar",
    { p_contrato_id: datos.contratoId, ...regimen, p_vigente_desde: datos.vigenteDesde, p_motivo: motivo },
    "cambiarRegimen",
    "No se pudo guardar el régimen. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidarFicha(datos.contratoId);
  revalidatePath(RUTA.simuladorRegimen());
  return { ok: true };
}

/** planilla_regimen_aviso_descartar (rrhh.planillas.regimen.cambiar). */
export async function descartarAvisoRegimen(contratoId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.regimenCambiar, "descartarAvisoRegimen");
  if (!prep.ok) return prep;
  if (!esUuid(contratoId)) return fallo("No se encontró el contrato.");
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  const problema = validarMotivo(texto);
  if (problema) return fallo(problema);

  const r = await accionRpc(
    prep.ctx,
    "planilla_regimen_aviso_descartar",
    { p_contrato_id: contratoId, p_motivo: texto },
    "descartarAvisoRegimen",
    "No se pudo descartar el aviso. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidarFicha(contratoId);
  return { ok: true };
}

/**
 * planilla_contrato_antiguedad_fijar (rrhh.planillas.liquidaciones.aprobar,
 * decisión del usuario). `fecha` null = heredar del contrato anterior.
 * Devuelve la fecha que quedó fijada.
 */
export async function fijarAntiguedad(contratoId: string, fecha: string | null, motivo: string): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.liquidacionesAprobar, "fijarAntiguedad");
  if (!prep.ok) return prep;
  if (!esUuid(contratoId)) return fallo("No se encontró el contrato.");
  if (fecha !== null && !esFechaIso(fecha)) return fallo("Indica una fecha de antigüedad válida.");
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  const problema = validarMotivo(texto);
  if (problema) return fallo(problema);

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_contrato_antiguedad_fijar",
    { p_contrato_id: contratoId, p_fecha_antiguedad: fecha, p_motivo: texto },
    "fijarAntiguedad",
    "No se pudo fijar la antigüedad. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidarFicha(contratoId);
  return { ok: true, data: typeof r.data === "string" ? r.data : (fecha ?? "") };
}
