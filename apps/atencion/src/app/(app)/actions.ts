"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { mensajeAtencion } from "@/lib/errores";
import type { MiEstado, TurnoCola } from "@/lib/supabase/database.types";

export interface Resultado<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
  /** Alta rechazada porque la factura ya tiene un "no se presentó" de hoy que se puede reactivar. */
  reactivable?: { id: string; numero: number };
}

/**
 * Cada acción exige su permiso con @nexo/permissions (mensaje legible) y
 * llama a su RPC public.atencion_*, que vuelve a validar permiso, sesión,
 * sucursal y reglas del módulo (ver supabase/migrations/20261014224341_atencion_esquema.sql).
 */
async function contexto(code: string) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    await requirePermission({ supabase, companyId }, code);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: "Tu rol no permite esta acción." } as const;
    throw err;
  }
  return { supabase, companyId } as const;
}

export async function cargarEstado(): Promise<Resultado<MiEstado>> {
  const ctx = await contexto("atencion.ver_modulo");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_mi_estado", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_mi_estado", "No se pudo cargar tu estado. Intenta de nuevo.") };
  return { ok: true, data: data as unknown as MiEstado };
}

export async function iniciarAtencion(sucursalId: string | null, tipo: "recepcion" | "puesto" | null): Promise<Resultado<MiEstado>> {
  const ctx = await contexto("atencion.ver_modulo");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_iniciar", {
    p_company_id: ctx.companyId,
    p_sucursal_id: sucursalId,
    p_tipo: tipo,
  });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_iniciar", "No se pudo iniciar la atención. Intenta de nuevo.") };
  revalidatePath("/dashboard");
  return { ok: true, data: data as unknown as MiEstado };
}

export async function cerrarAtencion(): Promise<Resultado> {
  const ctx = await contexto("atencion.ver_modulo");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_cerrar", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_cerrar", "No se pudo cerrar la atención. Intenta de nuevo.") };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Fila del día. `ahora` es la hora del servidor: el navegador la usa para
 * corregir su reloj en los cronómetros (una PC del puesto puede estar
 * desfasada minutos).
 */
export async function cargarCola(
  sucursalId: string | null = null
): Promise<Resultado<{ turnos: TurnoCola[]; ahora: string }>> {
  const ctx = await contexto("atencion.cola.turno.ver");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_cola_v3", {
    p_company_id: ctx.companyId,
    p_sucursal_id: sucursalId,
  });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_cola_v3", "No se pudo cargar la fila. Intenta de nuevo.") };
  return { ok: true, data: { turnos: data ?? [], ahora: new Date().toISOString() } };
}

export async function crearTurno(nombre: string, telefono: string, factura: string): Promise<Resultado<{ numero: number }>> {
  const ctx = await contexto("atencion.recepcion.turno.crear");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (!nombre.trim()) return { ok: false, message: "Escribí el nombre del cliente." };
  const { data, error } = await ctx.supabase.rpc("atencion_crear_turno", {
    p_company_id: ctx.companyId,
    p_cliente_nombre: nombre.trim(),
    p_cliente_telefono: telefono.trim() || null,
    p_factura: factura.trim() || null,
  });
  if (error) {
    // atencion_crear_turno marca el caso con detail = 'reactivable:<id>:<numero>'.
    const [marca, id, numero] = (error.details ?? "").split(":");
    return {
      ok: false,
      message: mensajeAtencion(error, "atencion_crear_turno", "No se pudo entregar el turno. Intenta de nuevo."),
      reactivable: marca === "reactivable" && id ? { id, numero: Number(numero) } : undefined,
    };
  }
  return { ok: true, data: { numero: Number((data as { numero: number }).numero) } };
}

export async function reactivarTurno(turnoId: string): Promise<Resultado<{ numero: number }>> {
  const ctx = await contexto("atencion.cola.turno.reactivar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_reactivar_turno", {
    p_company_id: ctx.companyId,
    p_turno_id: turnoId,
  });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_reactivar_turno", "No se pudo reactivar el turno. Intenta de nuevo.") };
  return { ok: true, data: { numero: Number((data as { numero: number }).numero) } };
}

export async function cancelarTurno(turnoId: string): Promise<Resultado> {
  const ctx = await contexto("atencion.recepcion.turno.cancelar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_cancelar_turno", { p_company_id: ctx.companyId, p_turno_id: turnoId });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_cancelar_turno", "No se pudo anular el turno. Intenta de nuevo.") };
  return { ok: true };
}

export async function llamarTurno(turnoId: string | null = null): Promise<Resultado<{ numero: number }>> {
  const ctx = await contexto(turnoId ? "atencion.puesto.turno.llamar_fuera_orden" : "atencion.puesto.turno.llamar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_llamar", { p_company_id: ctx.companyId, p_turno_id: turnoId });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_llamar", "No se pudo llamar el turno. Intenta de nuevo.") };
  return { ok: true, data: { numero: Number((data as { numero: number }).numero) } };
}

export async function rellamarTurno(): Promise<Resultado> {
  const ctx = await contexto("atencion.puesto.turno.llamar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_rellamar", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_rellamar", "No se pudo volver a llamar el turno. Intenta de nuevo.") };
  return { ok: true };
}

export async function terminarTurno(resultado: "atendido" | "ausente"): Promise<Resultado> {
  const ctx = await contexto(resultado === "atendido" ? "atencion.puesto.turno.finalizar" : "atencion.puesto.turno.marcar_ausente");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_terminar", { p_company_id: ctx.companyId, p_resultado: resultado });
  if (error) return { ok: false, message: mensajeAtencion(error, "atencion_terminar", "No se pudo terminar el turno. Intenta de nuevo.") };
  return { ok: true };
}
