"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { Resultado } from "@/lib/tipos";

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
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    await requirePermission({ supabase, companyId }, PERMISO[catalogo]);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: "Tu rol no permite gestionar este catálogo." };
    throw err;
  }
  const { error } = await supabase.rpc("productos_guardar_catalogo", {
    p_company_id: companyId,
    p_catalogo: catalogo,
    p_id: id,
    p_datos: datos,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/configuracion/[catalogo]", "page");
  return { ok: true };
}
