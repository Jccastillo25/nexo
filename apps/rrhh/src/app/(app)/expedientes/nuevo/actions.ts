"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface NuevoEmpleadoInput {
  nombre: string;
  apellido: string;
  documentoIdentidad?: string;
  email?: string;
  telefono?: string;
}

export interface CrearEmpleadoResult {
  ok: boolean;
  message?: string;
  empleadoId?: string;
  codigoEmpleado?: number;
}

/**
 * Puente transaccional: recibe los datos del formulario y llama al RPC
 * rrhh.fn_crear_empleado (via el wrapper public.crear_empleado,
 * authenticated-only — ver supabase/migrations/20260907152301_f1_1_separar_expediente_general_laboral.sql).
 * El RPC mismo es security definer y ya valida
 * rrhh.expedientes.empleados.crear — el requirePermission de aca abajo es
 * la capa de UX (norma v3.0): sin el, un usuario sin permiso veria el
 * error crudo de Postgres en vez de un mensaje entendible.
 *
 * F1.1 (2026-09-07, docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md): "Crear
 * empleado != contratar empleado". Esta accion crea EXCLUSIVAMENTE el
 * Expediente General (identidad/datos personales) — puesto,
 * departamento, modalidad de contrato, salario, nombre_usuario y PIN ya
 * no existen en esta firma. Todo eso pasa a ser un Contrato (F1.2) que
 * se crea/activa por separado; el PIN nace solo al activar un contrato
 * (F1.3), nunca aca. No confundir con el flujo anterior — quedo
 * documentado en docs/IMPLEMENTATION_STATUS.md D-01/D-02 y en
 * docs/MIGRATION_LOG.md.
 */
export async function crearEmpleado(
  input: NuevoEmpleadoInput
): Promise<CrearEmpleadoResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.empleados.crear");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  const nombre = input.nombre.trim();
  const apellido = input.apellido.trim();
  if (!nombre || !apellido) {
    return { ok: false, message: "Nombres y apellidos son obligatorios." };
  }

  const { data, error } = await supabase.rpc("crear_empleado", {
    p_company_id: companyId,
    p_nombre: nombre,
    p_apellido: apellido,
    p_documento_identidad: input.documentoIdentidad?.trim() || undefined,
    p_email: input.email?.trim() || undefined,
    p_telefono: input.telefono?.trim() || undefined,
  });

  if (error) {
    // rrhh.fn_crear_empleado propaga mensajes ya pensados para el
    // usuario final (permiso faltante, validaciones) tal cual — no son
    // datos sensibles de infraestructura.
    return { ok: false, message: error.message };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, message: "No se pudo crear el empleado." };
  }

  revalidatePath("/expedientes");

  return {
    ok: true,
    empleadoId: row.empleado_id,
    codigoEmpleado: row.codigo_empleado,
  };
}
