"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyId } from "@/lib/company";
import type { EmpleadoBusqueda } from "@/lib/supabase/database.types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface DatosUsuarioInput {
  nombreCompleto: string;
  telefono: string;
  cargo: string;
  rolId: string | null;
  empleadoId: string | null;
}

export interface CrearUsuarioInput extends DatosUsuarioInput {
  email: string;
  password: string;
}

const MIN_PASSWORD = 8;
// Bloqueo de inicio de sesión en Supabase Auth para usuarios desactivados
// (~100 años). Reactivar lo quita con "none".
const BAN_DESACTIVADO = "876000h";

async function exigir(code: string, mensaje: string) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    await requirePermission({ supabase, companyId }, code);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: mensaje } as const;
    throw err;
  }
  return { supabase, companyId } as const;
}

function validarDatos(input: DatosUsuarioInput): string | null {
  const nombre = input.nombreCompleto.trim();
  if (nombre.length < 2 || nombre.length > 120) return "El nombre completo debe tener entre 2 y 120 caracteres.";
  if (input.telefono.trim().length > 30) return "El teléfono no puede superar 30 caracteres.";
  if (input.cargo.trim().length > 80) return "El cargo no puede superar 80 caracteres.";
  return null;
}

/**
 * Alta de usuario (decisión 2026-10-14: el administrador pone la
 * contraseña). Dos pasos:
 *   1. crea la cuenta en Supabase Auth con service role (única parte que
 *      no puede vivir en una RPC);
 *   2. public.admin_completar_alta, con la sesión del administrador, crea
 *      perfil + membresía + rol + vínculo RRHH y valida anti-escalada.
 * Si el paso 2 falla, se borra la cuenta recién creada para no dejar
 * cuentas huérfanas.
 */
export async function crearUsuario(input: CrearUsuarioInput): Promise<ActionResult> {
  const ctx = await exigir("nexo.administracion.usuarios.crear", "No tenés permiso para crear usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Escribí un correo válido." };
  if (input.password.length < MIN_PASSWORD) {
    return { ok: false, message: `La contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (!input.rolId) return { ok: false, message: "Seleccioná un rol." };
  const invalido = validarDatos(input);
  if (invalido) return { ok: false, message: invalido };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }

  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre_completo: input.nombreCompleto.trim() },
  });
  if (authError || !creado.user) {
    const yaExiste = authError?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      message: yaExiste
        ? "Ya existe una cuenta con ese correo."
        : `No se pudo crear la cuenta: ${authError?.message ?? "error desconocido"}.`,
    };
  }

  const { error } = await ctx.supabase.rpc("admin_completar_alta", {
    p_company_id: ctx.companyId,
    p_user_id: creado.user.id,
    p_nombre_completo: input.nombreCompleto.trim(),
    p_telefono: input.telefono.trim() || null,
    p_cargo: input.cargo.trim() || null,
    p_rol_id: input.rolId,
    p_empleado_id: input.empleadoId,
  });
  if (error) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false, message: error.message };
  }

  revalidatePath("/configuracion/usuarios");
  revalidatePath("/configuracion/roles");
  return { ok: true };
}

export async function editarUsuario(userId: string, input: DatosUsuarioInput): Promise<ActionResult> {
  const ctx = await exigir("nexo.administracion.usuarios.editar", "No tenés permiso para editar usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const invalido = validarDatos(input);
  if (invalido) return { ok: false, message: invalido };

  const { error } = await ctx.supabase.rpc("admin_editar_usuario", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
    p_nombre_completo: input.nombreCompleto.trim(),
    p_telefono: input.telefono.trim() || null,
    p_cargo: input.cargo.trim() || null,
    p_rol_id: input.rolId,
    p_empleado_id: input.empleadoId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/configuracion/usuarios");
  revalidatePath(`/configuracion/usuarios/${userId}`);
  revalidatePath("/configuracion/roles");
  return { ok: true };
}

/**
 * Desactivar = la RPC marca la membresía inactiva (has_permission deja de
 * dar cualquier permiso) y además se bloquea el inicio de sesión en Auth.
 * Reactivar revierte ambas cosas. El rol y el historial se conservan.
 */
export async function cambiarEstadoUsuario(userId: string, activo: boolean): Promise<ActionResult> {
  const ctx = await exigir("nexo.administracion.usuarios.desactivar", "No tenés permiso para cambiar el estado de usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const { error } = await ctx.supabase.rpc("admin_cambiar_estado_usuario", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
    p_activo: activo,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/configuracion/usuarios");
  revalidatePath(`/configuracion/usuarios/${userId}`);

  try {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: activo ? "none" : BAN_DESACTIVADO,
    });
    if (banError) throw banError;
  } catch (err) {
    return {
      ok: false,
      message: `El estado quedó guardado (sin permisos), pero no se pudo ${activo ? "desbloquear" : "bloquear"} el inicio de sesión: ${(err as Error).message}`,
    };
  }
  return { ok: true };
}

/** Nueva contraseña temporal puesta por el administrador; el usuario debe cambiarla al entrar. */
export async function restablecerPassword(userId: string, password: string): Promise<ActionResult> {
  const ctx = await exigir("nexo.administracion.usuarios.editar", "No tenés permiso para restablecer contraseñas.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `La contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }

  // Primero la RPC: valida que el llamador pueda administrar a este usuario
  // (no a sí mismo, no al owner, sin escalada) antes de tocar Auth.
  const { error } = await ctx.supabase.rpc("admin_marcar_password_temporal", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
  });
  if (error) return { ok: false, message: error.message };

  try {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { password });
    if (authError) throw authError;
  } catch (err) {
    return { ok: false, message: `No se pudo cambiar la contraseña: ${(err as Error).message}` };
  }

  revalidatePath(`/configuracion/usuarios/${userId}`);
  return { ok: true };
}

export async function buscarEmpleados(texto: string): Promise<{ ok: boolean; message?: string; empleados: EmpleadoBusqueda[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_buscar_empleados", {
    p_company_id: getCompanyId(),
    p_texto: texto.slice(0, 80),
  });
  if (error) return { ok: false, message: error.message, empleados: [] };
  return { ok: true, empleados: data ?? [] };
}
