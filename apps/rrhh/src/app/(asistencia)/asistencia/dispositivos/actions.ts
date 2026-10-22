"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, mensajeDeError, MENSAJE_SIN_PERMISO } from "@nexo/permissions";
import { contextoActual } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { P_ASISTENCIA } from "@/lib/permisos-asistencia";
import { esIdValido, validarDispositivo } from "./validacion";

export type DispositivoActionResult =
  | { ok: true }
  | { ok: false; message: string; campo?: "nombre" | "ubicacion" };

const RUTA = "/asistencia/dispositivos";
const NO_ENCONTRADO = "No se encontró el dispositivo. Recarga la página e intenta de nuevo.";

/**
 * Dispositivos de marcación (rrhh.kiosko_dispositivos). Escritura directa
 * protegida por RLS con policies por permiso (mismo patrón que
 * rrhh.puestos); el permiso se valida aquí antes de cualquier efecto.
 * La tabla no tiene trigger de `updated_at`: cada update lo fija. No hay
 * eliminar (fuera de alcance): solo desactivar/reactivar.
 */
async function contexto(codigo: string, accion: string) {
  const { supabase, companyId } = await contextoActual<Database>();
  try {
    await requirePermission({ supabase, companyId }, codigo);
  } catch (err) {
    return { ok: false as const, message: mensajeDeError(err, accion) };
  }
  return { ok: true as const, supabase, companyId };
}

export async function registrarDispositivo(input: unknown): Promise<DispositivoActionResult> {
  const ctx = await contexto(P_ASISTENCIA.kioskosCrear, "registrarDispositivo");
  if (!ctx.ok) return ctx;

  const validacion = validarDispositivo(input);
  if (!validacion.ok) return { ok: false, message: validacion.message, campo: validacion.campo };

  const { error } = await ctx.supabase.schema("rrhh").from("kiosko_dispositivos").insert({
    company_id: ctx.companyId,
    nombre: validacion.valor.nombre,
    ubicacion: validacion.valor.ubicacion,
  });
  if (error) {
    return {
      ok: false,
      message: mensajeDeError(error, "registrarDispositivo", "No se pudo registrar el dispositivo. Intenta de nuevo."),
    };
  }

  revalidatePath(RUTA);
  return { ok: true };
}

export async function editarDispositivo(id: unknown, input: unknown): Promise<DispositivoActionResult> {
  const ctx = await contexto(P_ASISTENCIA.kioskosEditar, "editarDispositivo");
  if (!ctx.ok) return ctx;
  if (!esIdValido(id)) return { ok: false, message: NO_ENCONTRADO };

  const validacion = validarDispositivo(input);
  if (!validacion.ok) return { ok: false, message: validacion.message, campo: validacion.campo };

  const { data, error } = await ctx.supabase
    .schema("rrhh")
    .from("kiosko_dispositivos")
    .update({
      nombre: validacion.valor.nombre,
      ubicacion: validacion.valor.ubicacion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select("id");
  if (error) {
    return {
      ok: false,
      message: mensajeDeError(error, "editarDispositivo", "No se pudieron guardar los cambios. Intenta de nuevo."),
    };
  }
  if (!data || data.length === 0) return { ok: false, message: NO_ENCONTRADO };

  revalidatePath(RUTA);
  return { ok: true };
}

export async function cambiarEstadoDispositivo(id: unknown, activo: unknown): Promise<DispositivoActionResult> {
  const ctx = await contexto(P_ASISTENCIA.kioskosEditar, "cambiarEstadoDispositivo");
  if (!ctx.ok) return ctx;
  if (!esIdValido(id) || typeof activo !== "boolean") return { ok: false, message: NO_ENCONTRADO };

  const { data, error } = await ctx.supabase
    .schema("rrhh")
    .from("kiosko_dispositivos")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select("id");
  if (error) {
    return {
      ok: false,
      message: mensajeDeError(
        error,
        "cambiarEstadoDispositivo",
        activo ? "No se pudo reactivar el dispositivo. Intenta de nuevo." : "No se pudo desactivar el dispositivo. Intenta de nuevo."
      ),
    };
  }
  if (!data || data.length === 0) return { ok: false, message: NO_ENCONTRADO };

  revalidatePath(RUTA);
  return { ok: true };
}

// ------------------------------------------------- enrolamiento de equipos

export type GenerarCodigoResult =
  | { ok: true; codigo: string; venceEn: string }
  | { ok: false; message: string };

const ERROR_GENERAR = "No se pudo generar el código. Intenta de nuevo.";
const ERROR_REVOCAR = "No se pudo revocar el equipo. Intenta de nuevo.";
const INACTIVO = "Reactiva el dispositivo antes de asignarle un equipo.";

function objetoDe(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

/**
 * Genera el código de asignación de un equipo (RPC
 * asistencia_generar_codigo_terminal, que vuelve a validar el permiso). El
 * código solo viaja al navegador en esta respuesta y nunca se registra: lo
 * único que se loguea (mensajeDeError) es el error de PostgREST, que no lo
 * contiene.
 */
export async function generarCodigoTerminal(kioskoId: unknown): Promise<GenerarCodigoResult> {
  const ctx = await contexto(P_ASISTENCIA.kioskosAsignar, "generarCodigoTerminal");
  if (!ctx.ok) return ctx;
  if (!esIdValido(kioskoId)) return { ok: false, message: NO_ENCONTRADO };

  const { data, error } = await ctx.supabase.rpc("asistencia_generar_codigo_terminal", {
    p_company_id: ctx.companyId,
    p_kiosko_id: kioskoId,
  });
  if (error) return { ok: false, message: mensajeDeError(error, "generarCodigoTerminal", ERROR_GENERAR) };

  const res = objetoDe(data);
  if (
    res?.estado === "generado" &&
    typeof res.codigo === "string" &&
    /^[0-9]{10}$/.test(res.codigo) &&
    typeof res.vence_en === "string"
  ) {
    revalidatePath(RUTA);
    return { ok: true, codigo: res.codigo, venceEn: res.vence_en };
  }
  if (res?.estado === "denegado") return { ok: false, message: MENSAJE_SIN_PERMISO };
  if (res?.estado === "inactivo") return { ok: false, message: INACTIVO };
  if (res?.estado === "no_encontrado") return { ok: false, message: NO_ENCONTRADO };
  return { ok: false, message: ERROR_GENERAR };
}

/**
 * Revoca el equipo asignado o cancela el código pendiente (RPC
 * asistencia_revocar_terminal, idempotente; también valida el permiso).
 */
export async function revocarTerminal(kioskoId: unknown): Promise<DispositivoActionResult> {
  const ctx = await contexto(P_ASISTENCIA.kioskosRevocar, "revocarTerminal");
  if (!ctx.ok) return ctx;
  if (!esIdValido(kioskoId)) return { ok: false, message: NO_ENCONTRADO };

  const { data, error } = await ctx.supabase.rpc("asistencia_revocar_terminal", {
    p_company_id: ctx.companyId,
    p_kiosko_id: kioskoId,
  });
  if (error) return { ok: false, message: mensajeDeError(error, "revocarTerminal", ERROR_REVOCAR) };

  const res = objetoDe(data);
  if (res?.estado === "revocada") {
    revalidatePath(RUTA);
    return { ok: true };
  }
  if (res?.estado === "denegado") return { ok: false, message: MENSAJE_SIN_PERMISO };
  if (res?.estado === "no_encontrado") return { ok: false, message: NO_ENCONTRADO };
  return { ok: false, message: ERROR_REVOCAR };
}
