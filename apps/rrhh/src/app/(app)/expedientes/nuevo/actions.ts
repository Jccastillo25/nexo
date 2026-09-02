"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, hasPermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export interface NuevoEmpleadoInput {
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  puesto?: string;
  departamento?: string;
  modalidadContrato?: "nomina_estandar" | "comisionista_destajo";
  salarioBase?: number;
}

export interface CrearEmpleadoResult {
  ok: boolean;
  message?: string;
  empleadoId?: string;
  nombreUsuario?: string;
  /** Solo presente si el creador tiene rrhh.expedientes.compensacion.ver
   * — ver nota mas abajo. */
  pinKiosko?: string;
  /** true si el empleado se creo pero el PIN no se muestra porque el
   * creador no tiene ese permiso adicional. */
  credencialesOcultas?: boolean;
}

/**
 * Puente transaccional: recibe los datos del formulario y llama al RPC
 * rrhh.fn_crear_empleado (via el wrapper public.crear_empleado,
 * authenticated-only — ver supabase/migrations/20260902000008). El RPC
 * mismo es security definer y ya valida rrhh.expedientes.empleados.crear
 * (y, si se manda modalidad_contrato/salario_base,
 * rrhh.expedientes.compensacion.editar por separado) — el
 * requirePermission de aca abajo es la capa de UX (norma v3.0): sin el,
 * un usuario sin permiso veria el error crudo de Postgres en vez de un
 * mensaje entendible.
 *
 * Identidad delegada (@kiosko.internal): fn_crear_empleado NO crea la
 * cuenta de auth.users — eso queda para cuando se construya el modulo
 * movil de choferes (ver el comentario de cierre en
 * 20260902000008_rrhh_nicaragua_and_contracts.sql). Este alta solo deja
 * `rrhh.empleados.user_id` en null; el empleado ya puede marcar en el
 * kiosko fisico (PIN valida contra pin_hash sin necesitar auth.users)
 * pero todavia no puede loguearse a un modulo movil propio.
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
    p_email: input.email?.trim() || undefined,
    p_telefono: input.telefono?.trim() || undefined,
    p_puesto: input.puesto?.trim() || undefined,
    p_departamento: input.departamento?.trim() || undefined,
    p_modalidad_contrato: input.modalidadContrato,
    p_salario_base: input.salarioBase,
  });

  if (error) {
    // rrhh.fn_crear_empleado lanza mensajes ya pensados para el usuario
    // final (nombre_usuario duplicado, PIN invalido, permiso de
    // compensacion faltante) — se propagan tal cual, no son datos
    // sensibles de infraestructura.
    return { ok: false, message: error.message };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, message: "No se pudo crear el empleado." };
  }

  revalidatePath("/expedientes");

  // Vista protegida (pedido explicito): mostrar el PIN en texto plano
  // exige ADEMAS rrhh.expedientes.compensacion.ver. Es la UNICA vez que
  // existe en texto plano — rrhh.fn_crear_empleado no lo vuelve a
  // devolver nunca (esta bcrypt-hasheado en la tabla) — asi que si el
  // creador no tiene ese permiso, el empleado queda creado igual pero
  // las credenciales las tiene que entregar despues alguien que si
  // tenga el permiso (reasignando un PIN nuevo via
  // rrhh.fn_set_pin_empleado, que requiere
  // rrhh.expedientes.empleados.editar — verificado en
  // 20260902000006_rrhh_schema_and_tables.sql).
  const puedeVerCredenciales = await hasPermission(
    { supabase, companyId },
    "rrhh.expedientes.compensacion.ver"
  );

  return {
    ok: true,
    empleadoId: row.empleado_id,
    nombreUsuario: row.nombre_usuario,
    pinKiosko: puedeVerCredenciales ? row.pin_kiosko : undefined,
    credencialesOcultas: !puedeVerCredenciales,
  };
}
