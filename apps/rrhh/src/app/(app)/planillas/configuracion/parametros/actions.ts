"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { CERTEZA, esClaveDe } from "@/lib/planilla/etiquetas";

export interface NuevaVigenciaInput {
  codigo: string;
  /** Valor en la unidad de la base: fracción (0–1) si es porcentaje; el formulario ya convirtió el %. */
  valor: number;
  vigenteDesde: string;
  certeza: string;
  fuente: string;
}

const CODIGO = /^[a-z][a-z0-9_]{1,59}$/;

/**
 * Nueva vigencia de un parámetro de ley (A6): planilla_parametro_vigencia_nueva
 * (rrhh.planillas.parametros.editar). Cierra la vigencia abierta el día antes
 * y abre otra; auditada. La RPC valida el valor según la unidad, la fecha
 * (posterior a la vigente y a las planillas aprobadas), la certeza y la fuente.
 */
export async function nuevaVigenciaParametro(input: NuevaVigenciaInput): Promise<ActionResult> {
  const prep = await prepararAccion(P.parametrosEditar, "nuevaVigenciaParametro");
  if (!prep.ok) return prep;

  const d = (typeof input === "object" && input !== null ? input : {}) as Partial<NuevaVigenciaInput>;
  if (typeof d.codigo !== "string" || !CODIGO.test(d.codigo)) return { ok: false, message: "Parámetro no válido." };
  if (typeof d.valor !== "number" || !Number.isFinite(d.valor) || d.valor < 0) {
    return { ok: false, message: "Indica un valor válido." };
  }
  if (!esFechaIso(d.vigenteDesde)) return { ok: false, message: "Indica desde qué fecha rige el nuevo valor." };
  if (!esClaveDe(CERTEZA, d.certeza)) return { ok: false, message: "Indica el grado de certeza." };
  const fuente = typeof d.fuente === "string" ? d.fuente.trim() : "";
  if (fuente.length < 3 || fuente.length > 200) return { ok: false, message: "Indica la fuente del valor (3 a 200 caracteres)." };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_parametro_vigencia_nueva",
    {
      p_codigo: d.codigo,
      p_valor: d.valor,
      p_vigente_desde: d.vigenteDesde,
      p_certeza: d.certeza,
      p_fuente: fuente,
    },
    "nuevaVigenciaParametro",
    "No se pudo guardar la nueva vigencia. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidatePath(RUTA.parametros());
  return { ok: true };
}
