"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface JornadaInput {
  nombre: string;
  descripcion?: string;
}

export interface DiaInput {
  diaSemana: number; // 1=lunes..7=domingo (ISO-8601)
  laborable: boolean;
  horaEntrada?: string; // "HH:MM"
  horaSalida?: string;
  minutosDescanso: number;
  toleranciaEntradaMin: number;
  toleranciaSalidaMin: number;
}

/**
 * F1.4 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): CRUD de
 * plantillas de jornada y sus dias. Sin RPC dedicado -- rrhh.jornadas/
 * rrhh.jornada_dias son tablas de escritura directa protegidas por RLS
 * (mismo patron que rrhh.parametros_ley), gateadas por los permisos ya
 * existentes rrhh.asistencia.turnos.* (turno = jornada, ver
 * supabase/migrations/20260907162904_f1_4_jornadas_permission_matrix.sql).
 * requirePermission aca es solo la capa de UX (norma v3.0) -- la
 * proteccion real es RLS.
 */
export async function crearJornada(input: JornadaInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.turnos.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("jornadas").insert({
    company_id: companyId,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/jornadas");
  return { ok: true };
}

export async function editarJornada(
  jornadaId: string,
  input: JornadaInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.turnos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("jornadas")
    .update({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      activo: input.activo,
    })
    .eq("id", jornadaId)
    .eq("company_id", companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/jornadas");
  return { ok: true };
}

export async function eliminarJornada(jornadaId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.turnos.eliminar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  // Una jornada con historico real (rrhh.contrato_jornadas) queda
  // protegida por la FK (on delete restrict) -- el error de Postgres se
  // devuelve tal cual, mas entendible que un 500 crudo pero sin ocultar
  // la causa real.
  const { error } = await supabase
    .schema("rrhh")
    .from("jornadas")
    .delete()
    .eq("id", jornadaId)
    .eq("company_id", companyId);

  if (error) {
    if (error.message.includes("foreign key")) {
      return {
        ok: false,
        message: "No se puede eliminar: esta jornada ya fue asignada a un contrato. Desactívala en vez de eliminarla.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/jornadas");
  return { ok: true };
}

/**
 * Guarda los 7 dias de una jornada de una vez (upsert por
 * jornada_id+dia_semana). El formulario siempre envia los 7 -- mas
 * simple que una API incremental por dia para un formulario que edita
 * la semana completa junta.
 */
export async function guardarDiasJornada(jornadaId: string, dias: DiaInput[]): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.turnos.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const rows = dias.map((d) => ({
    jornada_id: jornadaId,
    company_id: companyId,
    dia_semana: d.diaSemana,
    laborable: d.laborable,
    hora_entrada: d.laborable ? d.horaEntrada : null,
    hora_salida: d.laborable ? d.horaSalida : null,
    minutos_descanso: d.laborable ? d.minutosDescanso : 0,
    tolerancia_entrada_min: d.laborable ? d.toleranciaEntradaMin : 0,
    tolerancia_salida_min: d.laborable ? d.toleranciaSalidaMin : 0,
  }));

  const { error } = await supabase
    .schema("rrhh")
    .from("jornada_dias")
    .upsert(rows, { onConflict: "jornada_id,dia_semana" });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/jornadas");
  return { ok: true };
}

export interface FeriadoInput {
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
}

export async function crearFeriado(input: FeriadoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.feriados.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("feriados").insert({
    company_id: companyId,
    fecha: input.fecha,
    nombre: input.nombre.trim(),
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { ok: false, message: "Ya existe un feriado registrado en esa fecha." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/jornadas");
  return { ok: true };
}

export async function eliminarFeriado(feriadoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.feriados.eliminar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("feriados")
    .delete()
    .eq("id", feriadoId)
    .eq("company_id", companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/jornadas");
  return { ok: true };
}
