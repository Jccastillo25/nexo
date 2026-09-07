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

export interface PinResult {
  ok: boolean;
  message?: string;
  /** Texto plano, se muestra UNA sola vez — nunca se puede recuperar después. */
  pin?: string;
}

export interface EstadoCredencialResult {
  ok: boolean;
  message?: string;
  tieneCredencial?: boolean;
  activo?: boolean;
  pinBloqueado?: boolean;
  rotacionNumero?: number;
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

/**
 * F1.3 (2026-09-07): activar ahora genera el PIN de asistencia
 * automáticamente (rrhh.fn_activar_contrato) — se devuelve en texto
 * plano UNA sola vez, igual que en el alta de empleado de F1.0-era. No
 * se puede recuperar después, solo regenerar (ver `regenerarPin`).
 */
export async function activarContrato(
  empleadoId: string,
  contratoId: string
): Promise<PinResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.activar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data, error } = await supabase.rpc("activar_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true, pin: data?.[0]?.pin_kiosko };
}

/**
 * F1.3: único camino para regenerar el PIN — exige contrato activo
 * (rrhh.fn_regenerar_pin_contrato). El PIN anterior deja de funcionar de
 * inmediato.
 */
export async function regenerarPin(
  empleadoId: string,
  contratoId: string
): Promise<PinResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.credenciales.regenerar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data, error } = await supabase.rpc("regenerar_pin_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true, pin: data?.[0]?.pin_kiosko };
}

/**
 * F1.3: "ver" es exclusivamente estado (activa/bloqueada/rotación) —
 * rrhh.fn_estado_credencial_contrato ni siquiera selecciona el
 * pin_hash, así que no hay forma de que este RPC devuelva el PIN.
 */
export async function verEstadoCredencial(
  contratoId: string
): Promise<EstadoCredencialResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.credenciales.ver");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data, error } = await supabase.rpc("estado_credencial_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
  });

  if (error) return { ok: false, message: error.message };

  const row = data?.[0];
  return {
    ok: true,
    tieneCredencial: row?.tiene_credencial,
    activo: row?.activo,
    pinBloqueado: row?.pin_bloqueado,
    rotacionNumero: row?.rotacion_numero,
  };
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
