"use server";

import { revalidatePath } from "next/cache";
import { hasPermission, requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { contextoActual } from "@nexo/auth";
import { createServiceRoleClient } from "@nexo/supabase/admin";
import { P } from "@/lib/permisos";
import { mensajeAdministracion } from "../errores";
import type { Database, EmpleadoBusqueda } from "@/lib/supabase/database.types";

/** Campos del formulario de usuario a los que se puede asociar un error. */
export type CampoUsuario = "nombreCompleto" | "email" | "password" | "rolId" | "telefono" | "cargo";

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** Campo al que pertenece el error, para mostrarlo junto a él. */
  campo?: CampoUsuario;
}

export interface DatosUsuarioInput {
  nombreCompleto: string;
  telefono: string;
  cargo: string;
  rolId: string | null;
  empleadoId: string | null;
  /** null = no tocar las sucursales asignadas (sin permiso para verlas). */
  sucursalIds: string[] | null;
}

export interface CrearUsuarioInput extends DatosUsuarioInput {
  email: string;
  password: string;
}

const MIN_PASSWORD = 8;
// Supabase Auth "weak_password" (muy corta, débil o filtrada): texto propio,
// nunca el de Auth (revisión de seguridad 2026-10-17).
const CONTRASENA_DEBIL = "La contraseña no cumple la política de seguridad (es débil o aparece en filtraciones conocidas). Elige otra.";
// Bloqueo de inicio de sesión en Supabase Auth para usuarios desactivados
// (~100 años). Reactivar lo quita con "none".
const BAN_DESACTIVADO = "876000h";

/** requirePermission antes de cualquier efecto; la denegación vuelve como mensaje propio. */
async function exigir(code: string, mensaje: string) {
  const ctx = await contextoActual<Database>();
  try {
    await requirePermission(ctx, code);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: mensaje } as const;
    throw err;
  }
  return ctx;
}

function validarDatos(input: DatosUsuarioInput): ActionResult | null {
  const nombre = input.nombreCompleto.trim();
  if (nombre.length < 2 || nombre.length > 120) {
    return { ok: false, campo: "nombreCompleto", message: "El nombre completo debe tener entre 2 y 120 caracteres." };
  }
  if (input.telefono.trim().length > 30) {
    return { ok: false, campo: "telefono", message: "El teléfono no puede superar 30 caracteres." };
  }
  if (input.cargo.trim().length > 80) {
    return { ok: false, campo: "cargo", message: "El cargo no puede superar 80 caracteres." };
  }
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
  const ctx = await exigir(P.usuariosCrear, "No tienes permiso para crear usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, campo: "email", message: "Escribe un correo válido." };
  }
  if (input.password.length < MIN_PASSWORD) {
    return { ok: false, campo: "password", message: `La contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }
  if (!input.rolId) return { ok: false, campo: "rolId", message: "Selecciona un rol." };
  const invalido = validarDatos(input);
  if (invalido) return invalido;

  // Service role solo para crear/borrar la cuenta en Supabase Auth, DESPUÉS
  // de requirePermission; el resto del alta pasa por la RPC con la sesión.
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    console.error("crearUsuario: cliente admin", err);
    return { ok: false, message: "No se pudo crear la cuenta. Intenta de nuevo." };
  }

  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre_completo: input.nombreCompleto.trim() },
  });
  if (authError || !creado.user) {
    const yaExiste = authError?.code === "email_exists" || authError?.message?.toLowerCase().includes("already");
    if (authError?.code === "weak_password") {
      console.error("crearUsuario: auth.createUser", authError);
      return { ok: false, campo: "password", message: CONTRASENA_DEBIL };
    }
    return {
      ok: false,
      campo: yaExiste ? "email" : undefined,
      message: yaExiste
        ? "Ya existe una cuenta con ese correo."
        : mensajeAdministracion(authError, "crearUsuario: auth.createUser", "No se pudo crear la cuenta. Intenta de nuevo."),
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
    return {
      ok: false,
      message: mensajeAdministracion(error, "crearUsuario: admin_completar_alta", "No se pudo crear el usuario. Intenta de nuevo."),
    };
  }

  if (input.sucursalIds && input.sucursalIds.length > 0) {
    const { error: sucError } = await ctx.supabase.rpc("admin_asignar_sucursales", {
      p_company_id: ctx.companyId,
      p_user_id: creado.user.id,
      p_sucursales: input.sucursalIds,
    });
    if (sucError) {
      revalidatePath("/configuracion/usuarios");
      return { ok: false, message: `Usuario creado, pero no se pudieron asignar las sucursales: ${mensajeAdministracion(sucError, "crearUsuario: admin_asignar_sucursales", "intenta de nuevo desde su ficha.")}` };
    }
  }

  revalidatePath("/configuracion/usuarios");
  revalidatePath("/configuracion/roles");
  return { ok: true };
}

export async function editarUsuario(userId: string, input: DatosUsuarioInput): Promise<ActionResult> {
  const ctx = await exigir(P.usuariosEditar, "No tienes permiso para editar usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const invalido = validarDatos(input);
  if (invalido) return invalido;

  const { error } = await ctx.supabase.rpc("admin_editar_usuario", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
    p_nombre_completo: input.nombreCompleto.trim(),
    p_telefono: input.telefono.trim() || null,
    p_cargo: input.cargo.trim() || null,
    p_rol_id: input.rolId,
    p_empleado_id: input.empleadoId,
  });
  if (error) {
    return {
      ok: false,
      message: mensajeAdministracion(error, "editarUsuario: admin_editar_usuario", "No se pudo guardar el usuario. Intenta de nuevo."),
    };
  }

  if (input.sucursalIds) {
    const { error: sucError } = await ctx.supabase.rpc("admin_asignar_sucursales", {
      p_company_id: ctx.companyId,
      p_user_id: userId,
      p_sucursales: input.sucursalIds,
    });
    if (sucError) return { ok: false, message: `Datos guardados, pero no las sucursales: ${mensajeAdministracion(sucError, "editarUsuario: admin_asignar_sucursales", "intenta de nuevo.")}` };
  }

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
  const ctx = await exigir(P.usuariosDesactivar, "No tienes permiso para cambiar el estado de usuarios.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  const { error } = await ctx.supabase.rpc("admin_cambiar_estado_usuario", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
    p_activo: activo,
  });
  if (error) {
    return {
      ok: false,
      message: mensajeAdministracion(error, "cambiarEstadoUsuario: admin_cambiar_estado_usuario", "No se pudo cambiar el estado. Intenta de nuevo."),
    };
  }

  revalidatePath("/configuracion/usuarios");
  revalidatePath(`/configuracion/usuarios/${userId}`);

  try {
    // Service role solo para el bloqueo en Auth, después de requirePermission y de la RPC.
    const admin = createServiceRoleClient();
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: activo ? "none" : BAN_DESACTIVADO,
    });
    if (banError) throw banError;
  } catch (err) {
    console.error("cambiarEstadoUsuario: auth ban", err);
    return {
      ok: false,
      message: `El estado quedó guardado (sin permisos), pero no se pudo ${activo ? "desbloquear" : "bloquear"} el inicio de sesión. Intenta de nuevo.`,
    };
  }
  return { ok: true };
}

/** Nueva contraseña temporal puesta por el administrador; el usuario debe cambiarla al entrar. */
export async function restablecerPassword(userId: string, password: string): Promise<ActionResult> {
  const ctx = await exigir(P.usuariosEditar, "No tienes permiso para restablecer contraseñas.");
  if ("error" in ctx) return { ok: false, message: ctx.error };

  if (password.length < MIN_PASSWORD) {
    return { ok: false, campo: "password", message: `La contraseña temporal debe tener al menos ${MIN_PASSWORD} caracteres.` };
  }

  // Primero la RPC: valida que el llamador pueda administrar a este usuario
  // (no a sí mismo, no al propietario, sin escalada) antes de tocar Auth.
  const { error } = await ctx.supabase.rpc("admin_marcar_password_temporal", {
    p_company_id: ctx.companyId,
    p_user_id: userId,
  });
  if (error) {
    return {
      ok: false,
      message: mensajeAdministracion(error, "restablecerPassword: admin_marcar_password_temporal", "No se pudo restablecer la contraseña. Intenta de nuevo."),
    };
  }

  try {
    // Service role solo para cambiar la contraseña en Auth, después de requirePermission y de la RPC.
    const admin = createServiceRoleClient();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { password });
    if (authError) throw authError;
  } catch (err) {
    console.error("restablecerPassword: auth.updateUserById", err);
    if ((err as { code?: unknown } | null)?.code === "weak_password") {
      return { ok: false, campo: "password", message: CONTRASENA_DEBIL };
    }
    return { ok: false, message: "No se pudo cambiar la contraseña. Intenta de nuevo." };
  }

  revalidatePath(`/configuracion/usuarios/${userId}`);
  return { ok: true };
}

/**
 * Solo lectura, para vincular un empleado de RRHH al crear o editar un
 * usuario. Revisión de seguridad (2026-10-20): como toda Server Action, valida
 * el permiso en el servidor antes de consultar; basta con
 * nexo.administracion.usuarios.crear o .editar (fail-closed: hasPermission
 * deniega ante cualquier error). public.admin_buscar_empleados vuelve a
 * validar dentro de la base (42501 si no corresponde).
 */
export async function buscarEmpleados(texto: string): Promise<{ ok: boolean; message?: string; empleados: EmpleadoBusqueda[] }> {
  const ctx = await contextoActual<Database>();
  const [puedeCrear, puedeEditar] = await Promise.all([
    hasPermission(ctx, P.usuariosCrear),
    hasPermission(ctx, P.usuariosEditar),
  ]);
  if (!puedeCrear && !puedeEditar) {
    return { ok: false, message: "No tienes permiso para buscar empleados.", empleados: [] };
  }

  const { data, error } = await ctx.supabase.rpc("admin_buscar_empleados", {
    p_company_id: ctx.companyId,
    p_texto: typeof texto === "string" ? texto.slice(0, 80) : "",
  });
  if (error) {
    return {
      ok: false,
      message: mensajeAdministracion(error, "buscarEmpleados: admin_buscar_empleados", "No se pudo buscar empleados. Intenta de nuevo."),
      empleados: [],
    };
  }
  return { ok: true, empleados: data ?? [] };
}
