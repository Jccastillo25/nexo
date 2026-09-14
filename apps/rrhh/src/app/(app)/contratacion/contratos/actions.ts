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

export interface CrearContratoResult extends ActionResult {
  /** Id del contrato recien creado — se usa para redirigir a su ficha. */
  contratoId?: string;
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

export interface AsignarJornadaResult {
  ok: boolean;
  message?: string;
  vigenteDesde?: string;
}

/**
 * Ciclo de vida completo del contrato (dominio Contratación) —
 * reubicado desde expedientes/[id]/actions.ts en la reconciliación de
 * 2026-09-14 (P2/P3, ver docs/status-log/): el Expediente General
 * (persona) y la relación laboral (Contratación) son dos dominios
 * separados, y esta era la única implementación real de cada acción — se
 * MUEVE, no se duplica (`crearContrato`/`editarContrato`/etc. siguen
 * siendo la única función para cada operación, ahora vive donde
 * corresponde). Cada acción llama al RPC correspondiente
 * (rrhh.fn_crear_contrato/fn_editar_contrato/fn_activar_contrato/
 * fn_finalizar_contrato via sus wrappers public.*, authenticated-only —
 * ver supabase/migrations/20260907153604_f1_2_rrhh_contratos.sql). El
 * requirePermission de cada funcion es la capa de UX (norma v3.0); la
 * proteccion real esta dentro del RPC (permiso + estado del contrato) y
 * en RLS/el trigger de transicion de estado.
 *
 * `empleadoId` ya no es parámetro de las acciones que solo lo usaban para
 * revalidar `/expedientes/[id]` (esa página ya no muestra nada derivado
 * del contrato, P2) — sigue siendo obligatorio únicamente en
 * `crearContrato`, donde es el dato de negocio real (a qué empleado
 * pertenece el contrato nuevo).
 */
export async function crearContrato(
  empleadoId: string,
  input: ContratoInput
): Promise<CrearContratoResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data, error } = await supabase.rpc("crear_contrato", {
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

  revalidatePath("/contratacion/contratos");
  return { ok: true, contratoId: data?.[0]?.contrato_id };
}

export async function editarContrato(
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

  revalidatePath(`/contratacion/contratos/${contratoId}`);
  revalidatePath("/contratacion/contratos");
  return { ok: true };
}

/**
 * F1.3: activar genera el PIN de asistencia automáticamente
 * (rrhh.fn_activar_contrato) — se devuelve en texto plano UNA sola vez.
 * No se puede recuperar después, solo regenerar (ver `regenerarPin`).
 */
export async function activarContrato(contratoId: string): Promise<PinResult> {
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

  revalidatePath(`/contratacion/contratos/${contratoId}`);
  revalidatePath("/contratacion/contratos");
  return { ok: true, pin: data?.[0]?.pin_kiosko };
}

/**
 * F1.3: único camino para regenerar el PIN — exige contrato activo
 * (rrhh.fn_regenerar_pin_contrato). El PIN anterior deja de funcionar de
 * inmediato.
 */
export async function regenerarPin(contratoId: string): Promise<PinResult> {
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

  revalidatePath(`/contratacion/contratos/${contratoId}`);
  return { ok: true, pin: data?.[0]?.pin_kiosko };
}

/**
 * F1.3: "ver" es exclusivamente estado (activa/bloqueada/rotación) —
 * rrhh.fn_estado_credencial_contrato ni siquiera selecciona el
 * pin_hash, así que no hay forma de que este RPC devuelva el PIN.
 */
export async function verEstadoCredencial(contratoId: string): Promise<EstadoCredencialResult> {
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

/**
 * F1.4 (2026-09-07): asigna/reasigna la jornada de un contrato (rrhh.
 * fn_asignar_jornada_contrato) -- cierra la vigencia abierta anterior y
 * abre una nueva, nunca sobreescribe el historico. Requisito para poder
 * activar el contrato (rrhh.fn_activar_contrato ahora lo exige).
 */
export async function asignarJornada(
  contratoId: string,
  jornadaId: string,
  vigenteDesde?: string
): Promise<AsignarJornadaResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data, error } = await supabase.rpc("asignar_jornada_contrato", {
    p_contrato_id: contratoId,
    p_company_id: companyId,
    p_jornada_id: jornadaId,
    p_vigente_desde: vigenteDesde || undefined,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/contratacion/contratos/${contratoId}`);
  return { ok: true, vigenteDesde: data?.[0]?.vigente_desde };
}

export async function finalizarContrato(contratoId: string): Promise<ActionResult> {
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

  revalidatePath(`/contratacion/contratos/${contratoId}`);
  revalidatePath("/contratacion/contratos");
  return { ok: true };
}
