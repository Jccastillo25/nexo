"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError, mensajeDeError } from "@nexo/permissions";
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
 * valida rrhh.fn_validar_porcentaje_beneficiarios() (trigger), cuyo P0001
 * ya esta pensado para el usuario final y mensajeDeError lo deja pasar;
 * cualquier otro error de Postgres va al log y la UI recibe un mensaje
 * generico. Sin DELETE expuesto -- se desactiva.
 */
export async function crearBeneficiario(empleadoId: string, input: BeneficiarioInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.beneficiarios.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: mensajeDeError(err, "crearBeneficiario") };
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

  if (error) {
    return { ok: false, message: mensajeDeError(error, "crearBeneficiario", "No se pudo agregar el beneficiario. Intenta de nuevo.") };
  }

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
    if (err instanceof PermissionDeniedError) return { ok: false, message: mensajeDeError(err, "editarBeneficiario") };
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

  if (error) {
    return { ok: false, message: mensajeDeError(error, "editarBeneficiario", "No se pudo guardar el beneficiario. Intenta de nuevo.") };
  }

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
