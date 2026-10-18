"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, PermissionDeniedError, mensajeDeError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { Resultado } from "@/lib/tipos";

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

/**
 * Crea (productoId null) o edita un producto. Solo se mandan los campos que
 * el formulario muestra como editables; la RPC exige editar/costo/fiscal según
 * lo que realmente cambie y nunca deja tocar el ID.
 */
export async function guardarProducto(
  productoId: string | null,
  datos: Record<string, unknown>
): Promise<Resultado<{ id: string; numero_id: number; codigo: string }>> {
  const ctx = await contexto(productoId ? P.ver : P.crear);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { data, error } = await ctx.supabase.rpc("productos_guardar", {
    p_company_id: ctx.companyId,
    p_producto_id: productoId,
    p_datos: datos,
  });
  if (error) return { ok: false, message: mensajeDeError(error, "productos_guardar", "No se pudo guardar el producto. Intenta de nuevo.") };
  revalidatePath("/catalogo");
  revalidatePath("/dashboard");
  return { ok: true, data: data as { id: string; numero_id: number; codigo: string } };
}

export async function descontinuarProducto(productoId: string, ventas: boolean, compras: boolean): Promise<Resultado> {
  const ctx = await contexto(P.descontinuar);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.rpc("productos_descontinuar", {
    p_company_id: ctx.companyId,
    p_producto_id: productoId,
    p_ventas: ventas,
    p_compras: compras,
  });
  if (error) return { ok: false, message: mensajeDeError(error, "productos_descontinuar", "No se pudo cambiar el estado del producto. Intenta de nuevo.") };
  revalidatePath("/catalogo");
  return { ok: true };
}

/** Vista previa del código que recibiría un producto nuevo en esa categoría (no lo reserva). */
export async function sugerirCodigo(categoriaId: string): Promise<string | null> {
  const ctx = await contexto(P.crear);
  if ("error" in ctx) return null;
  const { data } = await ctx.supabase.rpc("productos_sugerir_codigo", {
    p_company_id: ctx.companyId,
    p_categoria_id: categoriaId,
  });
  return (data as string | null) ?? null;
}
