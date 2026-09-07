"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ContratoInput {
  puesto?: string;
  departamento?: string;
  modalidadContrato?: "nomina_estandar" | "comisionista_destajo";
  fechaInicio?: string;
  fechaFinPrevista?: string;
  salarioBase?: number;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * F1.2 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): acciones
 * del ciclo de vida del contrato (Expediente Laboral), separado del
 * Expediente General (F1.1, ver expedientes/nuevo/actions.ts). Cada
 * accion llama al RPC correspondiente (rrhh.fn_crear_contrato/
 * fn_editar_contrato/fn_activar_contrato/fn_finalizar_contrato via sus
 * wrappers public.*, authenticated-only — ver
 * supabase/migrations/20260907153604_f1_2_rrhh_contratos.sql). El
 * requirePermission de cada funcion es la capa de UX (norma v3.0); la
 * proteccion real esta dentro del RPC (permiso + estado del contrato) y
 * en RLS/el trigger de transicion de estado.
 */
export async function crearContrato(
  empleadoId: string,
  input: ContratoInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("crear_contrato", {
    p_company_id: companyId,
    p_empleado_id: empleadoId,
    p_puesto: input.puesto?.trim() || undefined,
    p_departamento: input.departamento?.trim() || undefined,
    p_modalidad_contrato: input.modalidadContrato,
    p_fecha_inicio: input.fechaInicio || undefined,
    p_fecha_fin_prevista: input.fechaFinPrevista || undefined,
    p_salario_base: input.salarioBase,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export async function editarContrato(
  empleadoId: string,
  contratoId: string,
  input: ContratoInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("editar_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
    p_puesto: input.puesto?.trim() || undefined,
    p_departamento: input.departamento?.trim() || undefined,
    p_modalidad_contrato: input.modalidadContrato,
    p_fecha_inicio: input.fechaInicio || undefined,
    p_fecha_fin_prevista: input.fechaFinPrevista || undefined,
    p_salario_base: input.salarioBase,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export async function activarContrato(
  empleadoId: string,
  contratoId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.activar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("activar_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export async function finalizarContrato(
  empleadoId: string,
  contratoId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.finalizar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.rpc("finalizar_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
