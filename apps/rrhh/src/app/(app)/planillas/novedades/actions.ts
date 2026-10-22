"use server";

/**
 * Server Actions de Novedades (B8): registrar y anular. Cada una:
 * `prepararAccion` (requirePermission ANTES de cualquier efecto) →
 * validación de formato → RPC `planilla_novedad_*` con `p_company_id` del
 * servidor → revalidatePath. La RPC vuelve a validar todo (vigencia del
 * contrato, concepto que admite novedades, planilla aprobada, cantidad o
 * monto según el método del concepto, nota, clave de reintento).
 */
import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { esFechaIso } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";

const NOTA_MAX = 300;

export interface CrearNovedadInput {
  contratoId: string;
  conceptoId: string;
  fecha: string;
  /** Horas o días (conceptos de esos métodos); null en los de monto. */
  cantidad: number | null;
  /** Monto en C$; null en los de horas o días. */
  monto: number | null;
  nota: string | null;
  /** uuid por intento: un reintento del mismo envío no crea dos novedades. */
  clave: string;
}

function positivo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** Registra una novedad (`planilla_novedad_crear`). Idempotente con la misma `clave`. */
export async function crearNovedad(input: CrearNovedadInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.novedadesCrear, "crearNovedad");
  if (!prep.ok) return prep;

  const datos = (typeof input === "object" && input !== null ? input : {}) as Partial<Record<keyof CrearNovedadInput, unknown>>;
  if (!esUuid(datos.contratoId)) return { ok: false, message: "Elige la persona." };
  if (!esUuid(datos.conceptoId)) return { ok: false, message: "Elige el concepto." };
  if (!esFechaIso(datos.fecha)) return { ok: false, message: "Indica la fecha de la novedad." };
  if (!esUuid(datos.clave)) return { ok: false, message: "No se pudo guardar la novedad. Recarga la página e intenta de nuevo." };
  const cantidad = datos.cantidad === null || datos.cantidad === undefined ? null : positivo(datos.cantidad);
  const monto = datos.monto === null || datos.monto === undefined ? null : positivo(datos.monto);
  if ((datos.cantidad !== null && datos.cantidad !== undefined && cantidad === null) || (datos.monto !== null && datos.monto !== undefined && monto === null)) {
    return { ok: false, message: "Indica una cantidad o un monto mayor que cero." };
  }
  if ((cantidad === null) === (monto === null)) return { ok: false, message: "Indica la cantidad o el monto, solo uno de los dos." };
  const nota = typeof datos.nota === "string" ? datos.nota.trim() : "";
  if (nota.length > NOTA_MAX) return { ok: false, message: `La nota admite hasta ${NOTA_MAX} caracteres.` };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_novedad_crear",
    {
      p_contrato_id: datos.contratoId,
      p_concepto_id: datos.conceptoId,
      p_fecha: datos.fecha,
      p_cantidad: cantidad,
      p_monto: monto,
      p_nota: nota || null,
      p_clave: datos.clave,
    },
    "crearNovedad",
    "No se pudo guardar la novedad. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidatePath(RUTA.novedades());
  return { ok: true, data: typeof r.data === "string" ? r.data : "" };
}

/** Anula una novedad manual, de Excel o de Asistencia (`planilla_novedad_anular`). */
export async function anularNovedad(id: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.novedadesAnular, "anularNovedad");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: "La novedad indicada no es válida. Recarga la página e intenta de nuevo." };

  const r = await accionRpc(
    prep.ctx,
    "planilla_novedad_anular",
    { p_novedad_id: id },
    "anularNovedad",
    "No se pudo anular la novedad. Intenta de nuevo."
  );
  if (r.ok) revalidatePath(RUTA.novedades());
  return r.ok ? { ok: true } : r;
}
