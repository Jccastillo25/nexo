"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";

export interface TipoPlanillaInput {
  /** Null para crear. */
  tipoId: string | null;
  nombre: string;
  clase: string;
  frecuencia: string;
  centroCosto: string | null;
  activo: boolean;
}

const COMBINACIONES: Readonly<Record<string, readonly string[]>> = {
  ordinaria: ["quincenal", "mensual", "semanal"],
  aguinaldo: ["anual"],
};

/**
 * Crear o editar un tipo de planilla (A9): planilla_tipo_guardar
 * (rrhh.planillas.conceptos.gestionar). La RPC exige un solo tipo activo por
 * clase y frecuencia y que un tipo con planillas o novedades no cambie de
 * clase ni de frecuencia. Devuelve el id.
 */
export async function guardarTipoPlanilla(input: TipoPlanillaInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.conceptosGestionar, "guardarTipoPlanilla");
  if (!prep.ok) return prep;

  const d = (typeof input === "object" && input !== null ? input : {}) as Partial<TipoPlanillaInput>;
  const tipoId = d.tipoId === null || d.tipoId === undefined ? null : d.tipoId;
  if (tipoId !== null && !esUuid(tipoId)) return { ok: false, message: "No se encontró el tipo de planilla." };
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  if (nombre.length < 1 || nombre.length > 80) {
    return { ok: false, message: "Indica el nombre del tipo de planilla (hasta 80 caracteres)." };
  }
  const clase = typeof d.clase === "string" ? d.clase : "";
  const frecuencia = typeof d.frecuencia === "string" ? d.frecuencia : "";
  if (!Object.hasOwn(COMBINACIONES, clase) || !COMBINACIONES[clase].includes(frecuencia)) {
    return { ok: false, message: "Elige una clase y una frecuencia válidas." };
  }
  const centro = typeof d.centroCosto === "string" ? d.centroCosto.trim() : "";
  if (centro.length > 80) return { ok: false, message: "El centro de costo es demasiado largo (hasta 80 caracteres)." };
  if (typeof d.activo !== "boolean") return { ok: false, message: "Indica si el tipo de planilla está activo." };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_tipo_guardar",
    {
      p_tipo_id: tipoId,
      p_nombre: nombre,
      p_clase: clase,
      p_frecuencia: frecuencia,
      p_centro_costo: centro || null,
      p_activo: d.activo,
    },
    "guardarTipoPlanilla",
    "No se pudo guardar el tipo de planilla. Intenta de nuevo."
  );
  if (!r.ok) return r;
  const id = typeof r.data === "string" ? r.data : (tipoId ?? "");
  revalidatePath(RUTA.tipos());
  if (id) revalidatePath(RUTA.tipo(id));
  return { ok: true, data: id };
}
