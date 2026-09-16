"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface PlantillaInput {
  nombre: string;
  descripcion?: string;
}

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de plantillas de
 * contrato. Solo nombre/descripcion/activo en este bloque -- el archivo
 * real (storage_path) se sube en Fase 4 (Storage privado), todavia sin
 * construir. Sin RPC dedicado -- escritura directa protegida por RLS.
 */
export async function crearPlantilla(input: PlantillaInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.plantillas.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("plantillas_contrato").insert({
    company_id: companyId,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe una plantilla con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/plantillas");
  return { ok: true };
}

export async function editarPlantilla(
  plantillaId: string,
  input: PlantillaInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.plantillas.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("plantillas_contrato")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    })
    .eq("id", plantillaId)
    .eq("company_id", companyId);

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe una plantilla con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/plantillas");
  return { ok: true };
}
