"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface BeneficiarioInput {
  nombreCompleto: string;
  parentesco: string;
  porcentaje: number;
  documentoIdentidad?: string;
  telefono?: string;
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): beneficiarios -- dato sensible,
 * gateado por rrhh.expedientes.beneficiarios.* (solo admin). La suma de
 * porcentaje de filas activas por empleado no puede exceder 100 -- la
 * valida rrhh.fn_validar_porcentaje_beneficiarios() (trigger), el mensaje
 * de error de Postgres se propaga tal cual (ya pensado para el usuario
 * final). Sin DELETE expuesto -- se desactiva.
 */
export async function crearBeneficiario(empleadoId: string, input: BeneficiarioInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.beneficiarios.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("empleado_beneficiarios").insert({
    empleado_id: empleadoId,
    company_id: companyId,
    nombre_completo: input.nombreCompleto.trim(),
    parentesco: input.parentesco.trim(),
    porcentaje: input.porcentaje,
    documento_identidad: input.documentoIdentidad?.trim() || null,
    telefono: input.telefono?.trim() || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export async function editarBeneficiario(
  empleadoId: string,
  beneficiarioId: string,
  input: BeneficiarioInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.beneficiarios.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("empleado_beneficiarios")
    .update({
      nombre_completo: input.nombreCompleto.trim(),
      parentesco: input.parentesco.trim(),
      porcentaje: input.porcentaje,
      documento_identidad: input.documentoIdentidad?.trim() || null,
      telefono: input.telefono?.trim() || null,
      activo: input.activo,
    })
    .eq("id", beneficiarioId)
    .eq("empleado_id", empleadoId)
    .eq("company_id", companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
