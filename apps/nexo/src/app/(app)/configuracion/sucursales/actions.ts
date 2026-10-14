"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface GuardarSucursalInput {
  sucursalId: string | null;
  nombre: string;
  direccion: string;
  activa: boolean;
}

/** Crea o edita una sucursal. La regla real vive en public.admin_guardar_sucursal. */
export async function guardarSucursal(input: GuardarSucursalInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "nexo.administracion.sucursales.gestionar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: "No tenés permiso para gestionar sucursales." };
    }
    throw err;
  }

  const nombre = input.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, message: "El nombre de la sucursal debe tener entre 2 y 80 caracteres." };
  }

  const { error } = await supabase.rpc("admin_guardar_sucursal", {
    p_company_id: companyId,
    p_sucursal_id: input.sucursalId,
    p_nombre: nombre,
    p_direccion: input.direccion.trim() || null,
    p_zona_horaria: null,
    p_activa: input.activa,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/configuracion/sucursales");
  revalidatePath("/configuracion/usuarios");
  return { ok: true };
}
