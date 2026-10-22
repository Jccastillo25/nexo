"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { contextoActual } from "@nexo/auth";
import { P } from "@/lib/permisos";
import type { Database } from "@/lib/supabase/database.types";
import { mensajeAdministracion } from "../errores";

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** Campo al que pertenece el error, para mostrarlo junto a él. */
  campo?: "nombre";
}

export interface GuardarSucursalInput {
  sucursalId: string | null;
  nombre: string;
  direccion: string;
  activa: boolean;
}

/** Crea o edita una sucursal. La regla real vive en public.admin_guardar_sucursal. */
export async function guardarSucursal(input: GuardarSucursalInput): Promise<ActionResult> {
  const ctx = await contextoActual<Database>();

  try {
    await requirePermission(ctx, P.sucursalesGestionar);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: "No tienes permiso para gestionar sucursales." };
    }
    throw err;
  }

  const nombre = input.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, campo: "nombre", message: "El nombre de la sucursal debe tener entre 2 y 80 caracteres." };
  }

  const { error } = await ctx.supabase.rpc("admin_guardar_sucursal", {
    p_company_id: ctx.companyId,
    p_sucursal_id: input.sucursalId,
    p_nombre: nombre,
    p_direccion: input.direccion.trim() || null,
    p_zona_horaria: null,
    p_activa: input.activa,
  });
  if (error) {
    return {
      ok: false,
      message: mensajeAdministracion(error, "guardarSucursal: admin_guardar_sucursal", "No se pudo guardar la sucursal. Intenta de nuevo."),
    };
  }

  revalidatePath("/configuracion/sucursales");
  revalidatePath("/configuracion/usuarios");
  return { ok: true };
}
