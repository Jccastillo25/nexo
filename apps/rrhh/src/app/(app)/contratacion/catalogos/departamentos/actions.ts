"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface DepartamentoInput {
  nombre: string;
  descripcion?: string;
}

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de departamentos
 * ORGANIZACIONALES (Ventas, Operaciones) -- no geografico. Sin RPC dedicado
 * -- rrhh.departamentos es de escritura directa protegida por RLS (mismo
 * patron que rrhh.jornadas/rrhh.parametros_ley). Sin DELETE expuesto -- se
 * activa/desactiva, mismo criterio que empleados/contratos.
 */
export async function crearDepartamento(input: DepartamentoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.departamentos.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("departamentos").insert({
    company_id: companyId,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe un departamento con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/departamentos");
  return { ok: true };
}

export async function editarDepartamento(
  departamentoId: string,
  input: DepartamentoInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.departamentos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("departamentos")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    })
    .eq("id", departamentoId)
    .eq("company_id", companyId);

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe un departamento con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/departamentos");
  return { ok: true };
}
