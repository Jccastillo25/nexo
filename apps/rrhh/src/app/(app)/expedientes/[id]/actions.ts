"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface EmpleadoInput {
  nombre: string;
  apellido: string;
  documentoIdentidad?: string;
  email?: string;
  telefono?: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * P3 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
 * edición real del Expediente General — antes "Editar" en Expedientes
 * navegaba a la misma ficha de solo lectura que "Visualizar" (deuda
 * documentada en 2026-09-08). Usa el permiso YA EXISTENTE
 * rrhh.expedientes.empleados.editar (sin Paso Cero nuevo) y el RPC nuevo
 * rrhh.fn_editar_empleado (ver
 * supabase/migrations/20260914090000_rrhh_editar_empleado.sql) — solo
 * campos de persona, nunca datos contractuales (eso vive en
 * contratacion/contratos/actions.ts).
 */
export async function editarEmpleado(
  empleadoId: string,
  input: EmpleadoInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.empleados.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("editar_empleado", {
    p_empleado_id: empleadoId,
    p_company_id: companyId,
    p_nombre: input.nombre.trim(),
    p_apellido: input.apellido.trim(),
    p_documento_identidad: input.documentoIdentidad?.trim() || undefined,
    p_email: input.email?.trim() || undefined,
    p_telefono: input.telefono?.trim() || undefined,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  revalidatePath(`/expedientes/${empleadoId}/editar`);
  revalidatePath("/expedientes");
  return { ok: true };
}
