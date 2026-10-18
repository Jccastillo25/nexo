"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError, mensajeDeError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { Resultado } from "@/lib/tipos";

/** Crea o edita una clase, tipo o categoría. Número vacío = el siguiente libre dentro del padre. */
export async function guardarClasificacion(input: {
  id: string | null;
  nivel: "clase" | "tipo" | "categoria";
  padreId: string | null;
  numero: string;
  nombre: string;
  activa: boolean;
}): Promise<Resultado> {
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    await requirePermission({ supabase, companyId }, P.clasificacion);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: "Tu rol no permite gestionar la clasificación." };
    throw err;
  }
  const { error } = await supabase.rpc("productos_guardar_clasificacion", {
    p_company_id: companyId,
    p_id: input.id,
    p_nivel: input.nivel,
    p_padre_id: input.padreId,
    p_numero: input.numero.trim() || null,
    p_nombre: input.nombre.trim(),
    p_activa: input.activa,
  });
  if (error) return { ok: false, message: mensajeDeError(error, "productos_guardar_clasificacion", "No se pudo guardar. Intenta de nuevo.") };
  revalidatePath("/clasificacion");
  return { ok: true };
}
