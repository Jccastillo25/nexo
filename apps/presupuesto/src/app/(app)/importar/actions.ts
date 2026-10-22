"use server";

import { revalidatePath } from "next/cache";
import { contextoConPermiso, P } from "@/lib/metas/permisos";
import { esDenegacion, mensajeUsuario, motivoDeFila } from "@/lib/metas/errores";
import type { FilaFactura } from "@/lib/metas/importacion";
import type { ResultadoLote, Resultado } from "@/lib/metas/tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILAS = 1000;

interface RespuestaRpc extends Omit<ResultadoLote, "errores"> {
  errores: { fila: number; numero: string | null; error: string | null }[];
}

/**
 * Un lote del Excel de AG Negocio (public.presupuesto_importar_facturas). El navegador
 * lee y analiza el archivo y manda lotes de hasta 1000 filas, uno tras otro.
 * confirmar = false valida contra la base sin guardar nada. Los lotes
 * confirmados del mismo archivo comparten importacionId (lo devuelve el primero).
 */
export async function importarLote(
  importacionId: string | null,
  archivo: string,
  filas: FilaFactura[],
  confirmar: boolean
): Promise<Resultado<ResultadoLote>> {
  // Mismo permiso que exige la RPC, antes de cualquier efecto.
  const ctx = await contextoConPermiso(P.importar);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };

  if (importacionId !== null && (typeof importacionId !== "string" || !UUID.test(importacionId))) {
    return { ok: false, message: "La importación indicada no es válida. Vuelve a subir el archivo." };
  }
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, message: "El lote no tiene facturas." };
  if (filas.length > MAX_FILAS) return { ok: false, message: `Máximo ${MAX_FILAS} facturas por lote.` };

  const { data, error } = await ctx.supabase.rpc("presupuesto_importar_facturas", {
    p_company_id: ctx.companyId,
    p_importacion_id: importacionId,
    p_archivo: typeof archivo === "string" ? archivo.slice(0, 200) : null,
    p_filas: filas,
    p_confirmar: confirmar === true,
  });
  if (error) {
    return {
      ok: false,
      denegado: esDenegacion(error),
      message: mensajeUsuario(error, "presupuesto_importar_facturas", "No se pudo procesar el lote. Intenta de nuevo."),
    };
  }

  const r = data as RespuestaRpc;
  return {
    ok: true,
    data: {
      ...r,
      // Nunca se reenvía el texto crudo de Postgres: solo motivos conocidos.
      errores: (r.errores ?? []).map((e) => ({ fila: Number(e.fila) || 0, numero: e.numero ?? "", error: motivoDeFila(e.error) })),
    },
  };
}

/**
 * Se llama una sola vez al terminar o detener una importación con lotes
 * guardados: invalida las pantallas que muestran facturas.
 */
export async function terminarImportacion(): Promise<Resultado> {
  const ctx = await contextoConPermiso(P.importar);
  if ("error" in ctx) return { ok: false, denegado: true, message: ctx.error };
  revalidatePath("/dashboard");
  revalidatePath("/facturas");
  revalidatePath("/metas/por-vendedor");
  return { ok: true };
}
