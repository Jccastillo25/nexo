"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Nexo Enterprise UI (2026-09-07) — completa el hueco de UI de §1.8: el
 * permiso rrhh.expedientes.empleados.eliminar y la politica RLS DELETE ya
 * existian, pero ningun boton lo invocaba. La validacion de dominio (¿tiene
 * contratos historicos?) es explicita en el backend
 * (rrhh.fn_eliminar_empleado, ver
 * supabase/migrations/20260907224007_nexo_enterprise_ui_eliminar_empleado.sql)
 * — esta funcion solo llama al RPC real, no reimplementa el chequeo aca.
 */
export async function eliminarEmpleado(empleadoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.empleados.eliminar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("eliminar_empleado", {
    p_empleado_id: empleadoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/expedientes");
  return { ok: true };
}
