"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { CERTEZA, esClaveDe } from "@/lib/planilla/etiquetas";
import type { IrTramoEntrada } from "@/lib/planilla/tipos";

export interface NuevaTablaIrInput {
  vigenteDesde: string;
  /** Porcentaje ya como fracción (0–1). */
  tramos: IrTramoEntrada[];
  certeza: string;
  fuente: string;
}

const TOPE = 1_000_000_000_000;

function numeroValido(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < TOPE;
}

/** Copia solo los cinco campos de un tramo (descarta cualquier otro) o null si no es válido. */
function limpiarTramo(t: unknown): IrTramoEntrada | null {
  if (typeof t !== "object" || t === null) return null;
  const x = t as Record<string, unknown>;
  const hasta = x.hasta === null || x.hasta === undefined ? null : x.hasta;
  if (!numeroValido(x.desde) || !numeroValido(x.impuesto_base) || !numeroValido(x.sobre_exceso)) return null;
  if (hasta !== null && !numeroValido(hasta)) return null;
  if (typeof x.porcentaje !== "number" || !Number.isFinite(x.porcentaje) || x.porcentaje < 0 || x.porcentaje > 1) return null;
  return {
    desde: x.desde,
    hasta: hasta as number | null,
    impuesto_base: x.impuesto_base,
    porcentaje: x.porcentaje,
    sobre_exceso: x.sobre_exceso,
  };
}

/**
 * Nueva vigencia de la tabla de IR (A7): planilla_ir_tabla_nueva
 * (rrhh.planillas.parametros.editar). La RPC es la autoridad: tramos
 * contiguos desde 0, un solo tramo final sin límite, decimales, fecha
 * posterior a la tabla vigente y a las planillas aprobadas. Certeza y fuente
 * quedan en la auditoría (ir_tramos no las guarda).
 */
export async function guardarTablaIr(input: NuevaTablaIrInput): Promise<ActionResult<number>> {
  const prep = await prepararAccion(P.parametrosEditar, "guardarTablaIr");
  if (!prep.ok) return prep;

  const d = (typeof input === "object" && input !== null ? input : {}) as Partial<NuevaTablaIrInput>;
  if (!esFechaIso(d.vigenteDesde)) return { ok: false, message: "Indica desde qué fecha rige la tabla." };
  if (!esClaveDe(CERTEZA, d.certeza)) return { ok: false, message: "Indica el grado de certeza." };
  const fuente = typeof d.fuente === "string" ? d.fuente.trim() : "";
  if (fuente.length < 3 || fuente.length > 200) return { ok: false, message: "Indica la fuente de la tabla (3 a 200 caracteres)." };
  if (!Array.isArray(d.tramos) || d.tramos.length < 1 || d.tramos.length > 20) {
    return { ok: false, message: "Indica entre 1 y 20 tramos." };
  }
  const tramos: IrTramoEntrada[] = [];
  for (const t of d.tramos) {
    const limpio = limpiarTramo(t);
    if (!limpio) return { ok: false, message: "Revisa los tramos: cada uno lleva montos de 0 en adelante y un porcentaje de 0 a 100." };
    tramos.push(limpio);
  }

  const r = await accionRpc<number>(
    prep.ctx,
    "planilla_ir_tabla_nueva",
    { p_vigente_desde: d.vigenteDesde, p_tramos: tramos, p_certeza: d.certeza, p_fuente: fuente },
    "guardarTablaIr",
    "No se pudo guardar la tabla de IR. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidatePath(RUTA.tablaIr());
  return { ok: true, data: typeof r.data === "number" ? r.data : tramos.length };
}
