"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { CampoPantalla, CamposPantalla } from "@/lib/supabase/database.types";

export interface Resultado {
  ok: boolean;
  message?: string;
}

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

export async function guardarPuesto(input: {
  puestoId: string | null;
  sucursalId: string;
  nombre: string;
  orden: number;
  activo: boolean;
}): Promise<Resultado> {
  const ctx = await contexto("atencion.configuracion.puesto.gestionar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("atencion_guardar_puesto", {
    p_company_id: ctx.companyId,
    p_puesto_id: input.puestoId,
    p_sucursal_id: input.sucursalId,
    p_nombre: input.nombre.trim(),
    p_orden: Number.isFinite(input.orden) ? Math.trunc(input.orden) : 1,
    p_activo: input.activo,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function guardarPantalla(input: {
  pantallaId: string | null;
  sucursalId: string;
  nombre: string;
  activa: boolean;
  youtube: string;
  mostrar: CamposPantalla;
  anunciar: CamposPantalla;
}): Promise<Resultado> {
  const ctx = await contexto("atencion.configuracion.pantalla.gestionar");
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const youtube = input.youtube.trim();
  if (youtube && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtube)) {
    return { ok: false, message: "El enlace de entretenimiento tiene que ser de YouTube (https://youtube.com/… o https://youtu.be/…)." };
  }
  const { error } = await ctx.supabase.rpc("atencion_guardar_pantalla", {
    p_company_id: ctx.companyId,
    p_pantalla_id: input.pantallaId,
    p_sucursal_id: input.sucursalId,
    p_nombre: input.nombre.trim(),
    p_activa: input.activa,
    p_config: {
      ...(youtube ? { youtube } : {}),
      mostrar: soloCampos(input.mostrar),
      anunciar: soloCampos(input.anunciar),
    },
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/configuracion");
  return { ok: true };
}

/** Normaliza lo que llega del navegador: solo las 3 claves conocidas, booleanas. */
function soloCampos(campos: CamposPantalla): Record<CampoPantalla, boolean> {
  return {
    cliente: campos.cliente === true,
    agente: campos.agente === true,
    puesto: campos.puesto === true,
  };
}
