"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { FilaExportada, FilaImportacion } from "@/lib/importacion";
import type { Resultado, ResultadoImportacion } from "@/lib/tipos";

async function contexto(codigos: string[]) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    for (const code of codigos) await requirePermission({ supabase, companyId }, code);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: "Tu rol no permite esta acción." } as const;
    throw err;
  }
  return { supabase, companyId } as const;
}

/**
 * Vista previa (confirmar = false) o importación real. La RPC hace todo o
 * nada: con un solo error no guarda ninguna fila.
 */
export async function importarProductos(
  filas: FilaImportacion[],
  confirmar: boolean
): Promise<Resultado<ResultadoImportacion>> {
  // La importación escribe costo y datos fiscales: mismos permisos que exige la RPC.
  const ctx = await contexto([P.importar, P.costoEditar, P.fiscal]);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, message: "El archivo no tiene filas para importar." };
  const { data, error } = await ctx.supabase.rpc("productos_importar", {
    p_company_id: ctx.companyId,
    p_filas: filas,
    p_confirmar: confirmar,
  });
  if (error) return { ok: false, message: error.message };
  if (confirmar) {
    revalidatePath("/catalogo");
    revalidatePath("/dashboard");
    revalidatePath("/clasificacion");
  }
  return { ok: true, data: data as ResultadoImportacion };
}

export async function exportarProductos(): Promise<Resultado<FilaExportada[]>> {
  const ctx = await contexto([P.exportar]);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("productos_exportar", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: data as FilaExportada[] };
}
