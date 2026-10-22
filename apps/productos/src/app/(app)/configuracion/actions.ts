"use server";

import { revalidatePath } from "next/cache";
import { contextoActual } from "@nexo/auth";
import { requirePermission, PermissionDeniedError, mensajeDeError, MENSAJE_SIN_PERMISO } from "@nexo/permissions";
import { P } from "@/lib/permisos";
import type { Resultado } from "@/lib/tipos";

const SIN_PERMISO_CATALOGO = "Tu rol no permite gestionar este catálogo.";

export type TipoCatalogo = "marca" | "unidad" | "proveedor" | "caracteristica" | "cuenta" | "centro_costo";

const PERMISO: Record<TipoCatalogo, string> = {
  marca: P.marca,
  unidad: P.unidad,
  proveedor: P.proveedor,
  caracteristica: P.caracteristica,
  cuenta: P.contable,
  centro_costo: P.contable,
};

export async function guardarCatalogo(catalogo: TipoCatalogo, id: string | null, datos: Record<string, unknown>): Promise<Resultado> {
  if (!(catalogo in PERMISO)) return { ok: false, message: "Catálogo desconocido." };
  const { supabase, companyId } = await contextoActual();
  try {
    await requirePermission({ supabase, companyId }, PERMISO[catalogo]);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: SIN_PERMISO_CATALOGO };
    throw err;
  }
  const { error } = await supabase.rpc("productos_guardar_catalogo", {
    p_company_id: companyId,
    p_catalogo: catalogo,
    p_id: id,
    p_datos: datos,
  });
  if (error) {
    // mensajeDeError: P0001 (mensaje propio de la RPC) tal cual; denegación
    // (42501, que además puede ser un GRANT faltante) y lo técnico se
    // registran. Se conserva el texto específico de este catálogo.
    const message = mensajeDeError(error, "productos_guardar_catalogo", "No se pudo guardar. Intenta de nuevo.");
    return { ok: false, message: message === MENSAJE_SIN_PERMISO ? SIN_PERMISO_CATALOGO : message };
  }
  revalidatePath("/configuracion/[catalogo]", "page");
  return { ok: true };
}
