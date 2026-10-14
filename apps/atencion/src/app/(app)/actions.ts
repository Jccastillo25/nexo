"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { MiEstado, TurnoCola } from "@/lib/supabase/database.types";

export interface Resultado<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
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
  if (error) return { ok: false, message: error.message };
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
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, data: data as unknown as MiEstado };
}

export async function cerrarAtencion(): Promise<Resultado> {
  const ctx = await contexto("atencion.ver_modulo");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_cerrar", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cargarCola(sucursalId: string | null = null): Promise<Resultado<TurnoCola[]>> {
  const ctx = await contexto("atencion.cola.turno.ver");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_cola", {
    p_company_id: ctx.companyId,
    p_sucursal_id: sucursalId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: data ?? [] };
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
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { numero: Number((data as { numero: number }).numero) } };
}

export async function cancelarTurno(turnoId: string): Promise<Resultado> {
  const ctx = await contexto("atencion.recepcion.turno.cancelar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_cancelar_turno", { p_company_id: ctx.companyId, p_turno_id: turnoId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function llamarTurno(turnoId: string | null = null): Promise<Resultado<{ numero: number }>> {
  const ctx = await contexto(turnoId ? "atencion.puesto.turno.llamar_fuera_orden" : "atencion.puesto.turno.llamar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("atencion_llamar", { p_company_id: ctx.companyId, p_turno_id: turnoId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { numero: Number((data as { numero: number }).numero) } };
}

export async function rellamarTurno(): Promise<Resultado> {
  const ctx = await contexto("atencion.puesto.turno.llamar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_rellamar", { p_company_id: ctx.companyId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function terminarTurno(resultado: "atendido" | "ausente"): Promise<Resultado> {
  const ctx = await contexto(resultado === "atendido" ? "atencion.puesto.turno.finalizar" : "atencion.puesto.turno.marcar_ausente");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_terminar", { p_company_id: ctx.companyId, p_resultado: resultado });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
