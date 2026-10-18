"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { mensajeAdministracion } from "../errores";

export interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export interface GuardarRolInput {
  rolId: string | null;
  nombre: string;
  descripcion: string;
  permisos: string[];
}

/**
 * Crea o edita un rol de empresa. Toda la regla de negocio (permisos
 * válidos, anti-escalada, no editar el rol propio, auditoría) vive en
 * public.admin_guardar_rol — esta acción solo da el mensaje legible y
 * revalida. Ver docs/plan/12-administracion-usuarios-roles.md §6.
 */
export async function guardarRol(input: GuardarRolInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const code = input.rolId ? "nexo.administracion.roles.editar" : "nexo.administracion.roles.crear";

  try {
    await requirePermission({ supabase, companyId }, code);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: "No tenés permiso para guardar roles." };
    }
    throw err;
  }

  const nombre = input.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, message: "El nombre del rol debe tener entre 2 y 80 caracteres." };
  }

  const { data, error } = await supabase.rpc("admin_guardar_rol", {
    p_company_id: companyId,
    p_rol_id: input.rolId,
    p_nombre: nombre,
    p_descripcion: input.descripcion.trim() || null,
    p_permisos: Array.from(new Set(input.permisos)),
  });
  if (error) {
    return { ok: false, message: mensajeAdministracion(error, "guardarRol: admin_guardar_rol", "No se pudo guardar el rol. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/roles");
  revalidatePath("/configuracion/usuarios");
  return { ok: true, id: data };
}

export async function eliminarRol(rolId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "nexo.administracion.roles.eliminar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: "No tenés permiso para eliminar roles." };
    }
    throw err;
  }

  const { error } = await supabase.rpc("admin_eliminar_rol", { p_company_id: companyId, p_rol_id: rolId });
  if (error) {
    return { ok: false, message: mensajeAdministracion(error, "eliminarRol: admin_eliminar_rol", "No se pudo eliminar el rol. Intenta de nuevo.") };
  }

  revalidatePath("/configuracion/roles");
  return { ok: true };
}
