"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface DireccionInput {
  departamentoGeoId?: string;
  municipioGeoId?: string;
  direccionDetalle?: string;
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): direccion del empleado. Sin RPC
 * dedicado -- escritura directa protegida por RLS (mismo patron que
 * rrhh.departamentos/rrhh.jornadas). Upsert por empleado_id (1:1) --
 * el formulario siempre guarda el registro completo, no hay campos
 * parciales que preservar de una fila anterior.
 */
export async function guardarDireccion(empleadoId: string, input: DireccionInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.direccion.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .schema("rrhh")
    .from("empleado_direccion")
    .upsert(
      {
        empleado_id: empleadoId,
        company_id: companyId,
        departamento_geo_id: input.departamentoGeoId || null,
        municipio_geo_id: input.municipioGeoId || null,
        direccion_detalle: input.direccionDetalle?.trim() || null,
        updated_by: userData.user?.id ?? null,
      },
      { onConflict: "empleado_id" }
    );

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
