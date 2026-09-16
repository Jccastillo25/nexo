"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface CuentaBancariaInput {
  banco: string;
  tipoCuenta: "ahorro" | "corriente";
  moneda: "NIO" | "USD";
  numeroCuenta: string;
  principal: boolean;
}

/**
 * Fase 5 (2026-09-16, bloque pre-F1.5): cuentas bancarias -- dato
 * sensible, gateado por rrhh.expedientes.cuentas_bancarias.* (solo
 * admin). Sin RPC dedicado -- escritura directa protegida por RLS. Sin
 * DELETE expuesto -- se desactiva.
 */
export async function crearCuentaBancaria(empleadoId: string, input: CuentaBancariaInput): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.cuentas_bancarias.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase.schema("rrhh").from("empleado_cuentas_bancarias").insert({
    empleado_id: empleadoId,
    company_id: companyId,
    banco: input.banco.trim(),
    tipo_cuenta: input.tipoCuenta,
    moneda: input.moneda,
    numero_cuenta: input.numeroCuenta.trim(),
    principal: input.principal,
  });

  if (error) {
    if (error.message.includes("duplicate key") && error.message.includes("principal")) {
      return { ok: false, message: "Ya existe una cuenta principal activa para este empleado." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export async function editarCuentaBancaria(
  empleadoId: string,
  cuentaId: string,
  input: CuentaBancariaInput & { activo: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.cuentas_bancarias.editar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { error } = await supabase
    .schema("rrhh")
    .from("empleado_cuentas_bancarias")
    .update({
      banco: input.banco.trim(),
      tipo_cuenta: input.tipoCuenta,
      moneda: input.moneda,
      numero_cuenta: input.numeroCuenta.trim(),
      principal: input.principal,
      activo: input.activo,
    })
    .eq("id", cuentaId)
    .eq("empleado_id", empleadoId)
    .eq("company_id", companyId);

  if (error) {
    if (error.message.includes("duplicate key") && error.message.includes("principal")) {
      return { ok: false, message: "Ya existe una cuenta principal activa para este empleado." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
