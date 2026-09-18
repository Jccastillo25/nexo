"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface PuestoInput {
  nombre: string;
  descripcion?: string;
  /** Obligatorio desde 2026-09-17 (ver supabase/migrations/20260917100000_...)
   * -- cada puesto pertenece a un único departamento organizacional. */
  departamentoId: string;
}

/**
 * Fase 3 (2026-09-16, bloque pre-F1.5): catalogo de puestos. Sin RPC
 * dedicado -- rrhh.puestos es de escritura directa protegida por RLS
 * (mismo patron que rrhh.departamentos/rrhh.jornadas). Sin DELETE expuesto.
 */
export async function crearPuesto(input: PuestoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.puestos.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  if (!input.departamentoId) {
    return { ok: false, message: "Elegí un departamento para este puesto." };
  }

  const { error } = await supabase.schema("rrhh").from("puestos").insert({
    company_id: companyId,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    departamento_id: input.departamentoId,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe un puesto con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/puestos");
  return { ok: true };
}

export async function editarPuesto(
  puestoId: string,
  input: PuestoInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.puestos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  if (!input.departamentoId) {
    return { ok: false, message: "Elegí un departamento para este puesto." };
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("puestos")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      departamento_id: input.departamentoId,
      activo: input.activo,
    })
    .eq("id", puestoId)
    .eq("company_id", companyId);

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe un puesto con ese nombre en esta empresa." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/contratacion/catalogos/puestos");
  return { ok: true };
}

/**
 * Asigna (o quita, con plantillaId=null) la plantilla predeterminada de un
 * puesto -- rrhh.puesto_plantillas solo permite una fila con
 * predeterminada=true y activo=true por puesto (indice unico parcial), asi
 * que primero se apaga cualquier default anterior y despues se prende el
 * nuevo. No es atomico en un solo statement, pero esto es una accion de
 * catalogo de baja concurrencia (un admin configurando plantillas), no un
 * flujo transaccional de alto riesgo como activar un contrato.
 */
export async function asignarPlantillaPredeterminada(
  puestoId: string,
  plantillaId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.plantillas.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error: unsetError } = await supabase
    .schema("rrhh")
    .from("puesto_plantillas")
    .update({ predeterminada: false })
    .eq("puesto_id", puestoId)
    .eq("company_id", companyId)
    .eq("predeterminada", true);

  if (unsetError) return { ok: false, message: unsetError.message };

  if (plantillaId) {
    const { error: upsertError } = await supabase
      .schema("rrhh")
      .from("puesto_plantillas")
      .upsert(
        { company_id: companyId, puesto_id: puestoId, plantilla_id: plantillaId, predeterminada: true, activo: true },
        { onConflict: "puesto_id,plantilla_id" }
      );

    if (upsertError) return { ok: false, message: upsertError.message };
  }

  revalidatePath("/contratacion/catalogos/puestos");
  return { ok: true };
}
