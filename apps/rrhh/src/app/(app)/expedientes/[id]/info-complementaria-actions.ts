"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError, mensajeDeError } from "@nexo/permissions";
import { contextoActual } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export const ESTADOS_CIVILES = [
  "soltero_a",
  "casado_a",
  "union_de_hecho",
  "divorciado_a",
  "viudo_a",
] as const;
export type EstadoCivil = (typeof ESTADOS_CIVILES)[number];

export interface InfoComplementariaInput {
  estadoCivil?: EstadoCivil | "";
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  contactoEmergenciaParentesco?: string;
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): informacion complementaria del
 * empleado. Sin RPC dedicado -- escritura directa protegida por RLS.
 * Upsert por empleado_id (1:1).
 */
export async function guardarInfoComplementaria(
  empleadoId: string,
  input: InfoComplementariaInput
): Promise<ActionResult> {
  const { supabase, companyId } = await contextoActual<Database>();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.info_complementaria.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: mensajeDeError(err, "guardarInfoComplementaria") };
    throw err;
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .schema("rrhh")
    .from("empleado_info_complementaria")
    .upsert(
      {
        empleado_id: empleadoId,
        company_id: companyId,
        estado_civil: input.estadoCivil || null,
        contacto_emergencia_nombre: input.contactoEmergenciaNombre?.trim() || null,
        contacto_emergencia_telefono: input.contactoEmergenciaTelefono?.trim() || null,
        contacto_emergencia_parentesco: input.contactoEmergenciaParentesco?.trim() || null,
        updated_by: userData.user?.id ?? null,
      },
      { onConflict: "empleado_id" }
    );

  if (error) {
    return {
      ok: false,
      message: mensajeDeError(error, "guardarInfoComplementaria", "No se pudo guardar la información complementaria. Intenta de nuevo."),
    };
  }

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
