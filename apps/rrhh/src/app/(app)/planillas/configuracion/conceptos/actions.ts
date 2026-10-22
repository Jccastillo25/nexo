"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { METODO_CONCEPTO, TIPO_CONCEPTO, esClaveDe } from "@/lib/planilla/etiquetas";

export interface ConceptoInput {
  /** Null para crear. */
  conceptoId: string | null;
  codigo: string;
  nombre: string;
  tipo: string;
  metodo: string;
  afectaInss: boolean;
  afectaIr: boolean;
  afectaInatec: boolean;
  cuentaAguinaldo: boolean;
  cuentaVacaciones: boolean;
  cuentaIndemnizacion: boolean;
  enColilla: boolean;
  permiteNovedad: boolean;
  orden: number;
  cuentaContable: string | null;
  activo: boolean;
}

const CODIGO = /^[A-Z][A-Z0-9_]{1,39}$/;
const BOOLEANOS = [
  "afectaInss",
  "afectaIr",
  "afectaInatec",
  "cuentaAguinaldo",
  "cuentaVacaciones",
  "cuentaIndemnizacion",
  "enColilla",
  "permiteNovedad",
  "activo",
] as const;

/**
 * Crear o editar un concepto de planilla (A8): planilla_concepto_guardar
 * (rrhh.planillas.conceptos.gestionar). La RPC decide las reglas: los
 * conceptos propios son ingresos o deducciones de monto fijo, los del sistema
 * no se editan, una deducción no afecta INSS/IR/INATEC ni prestaciones, y un
 * concepto usado en una planilla aprobada solo cambia nombre, orden, colilla,
 * novedades, cuenta contable y estado. Devuelve el id.
 */
export async function guardarConcepto(input: ConceptoInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.conceptosGestionar, "guardarConcepto");
  if (!prep.ok) return prep;

  const d = (typeof input === "object" && input !== null ? input : {}) as Partial<ConceptoInput>;
  const conceptoId = d.conceptoId === null || d.conceptoId === undefined ? null : d.conceptoId;
  if (conceptoId !== null && !esUuid(conceptoId)) return { ok: false, message: "No se encontró el concepto." };
  const codigo = typeof d.codigo === "string" ? d.codigo.trim().toUpperCase() : "";
  if (!CODIGO.test(codigo)) {
    return {
      ok: false,
      message: "El código va en mayúsculas y sin espacios: de 2 a 40 letras, números o guion bajo, y empieza con una letra.",
    };
  }
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  if (nombre.length < 1 || nombre.length > 80) return { ok: false, message: "Indica el nombre del concepto (hasta 80 caracteres)." };
  if (!esClaveDe(TIPO_CONCEPTO, d.tipo) || !esClaveDe(METODO_CONCEPTO, d.metodo)) {
    return { ok: false, message: "Tipo o método de concepto no válido." };
  }
  for (const campo of BOOLEANOS) {
    if (typeof d[campo] !== "boolean") return { ok: false, message: "Indica todas las opciones del concepto." };
  }
  if (typeof d.orden !== "number" || !Number.isInteger(d.orden) || d.orden < 1 || d.orden > 9999) {
    return { ok: false, message: "El orden va de 1 a 9999." };
  }
  const cuenta = typeof d.cuentaContable === "string" ? d.cuentaContable.trim() : "";
  if (cuenta.length > 40) return { ok: false, message: "La cuenta contable es demasiado larga (hasta 40 caracteres)." };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_concepto_guardar",
    {
      p_concepto_id: conceptoId,
      p_codigo: codigo,
      p_nombre: nombre,
      p_tipo: d.tipo,
      p_metodo: d.metodo,
      p_afecta_inss: d.afectaInss,
      p_afecta_ir: d.afectaIr,
      p_afecta_inatec: d.afectaInatec,
      p_cuenta_aguinaldo: d.cuentaAguinaldo,
      p_cuenta_vacaciones: d.cuentaVacaciones,
      p_cuenta_indemnizacion: d.cuentaIndemnizacion,
      p_en_colilla: d.enColilla,
      p_permite_novedad: d.permiteNovedad,
      p_orden: d.orden,
      p_cuenta_contable: cuenta || null,
      p_activo: d.activo,
    },
    "guardarConcepto",
    "No se pudo guardar el concepto. Intenta de nuevo."
  );
  if (!r.ok) return r;
  const id = typeof r.data === "string" ? r.data : (conceptoId ?? "");
  revalidatePath(RUTA.conceptos());
  if (id) revalidatePath(RUTA.concepto(id));
  return { ok: true, data: id };
}
