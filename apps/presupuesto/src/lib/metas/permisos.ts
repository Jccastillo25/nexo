import { cache } from "react";
import { contextoActual, type Contexto } from "@nexo/auth";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { SIN_PERMISO } from "@/lib/metas/errores";

// Solo servidor: @nexo/auth importa "server-only". Un Client Component que
// necesite un permiso lo recibe como prop desde su página.

/**
 * Permisos de la app Presupuesto: Paso Cero 20261020183127_presupuesto_paso_cero
 * (docs/plan/19-presupuesto.md §4). Significan lo mismo que los permisos de
 * Metas del plan 15, con el prefijo de la app.
 */
export const P = {
  modulo: "presupuesto.ver_modulo",
  propio: "presupuesto.metas.avance_propio.ver",
  misFacturas: "presupuesto.ventas.factura_propia.ver",
  equipo: "presupuesto.metas.avance_equipo.ver",
  facturas: "presupuesto.ventas.factura.ver",
  importar: "presupuesto.ventas.factura.importar",
  metasVend: "presupuesto.metas.meta_vendedor.gestionar",
  presupuesto: "presupuesto.ventas.presupuesto_anual.gestionar",
  vendedores: "presupuesto.configuracion.vendedor.gestionar",
} as const;

export type Permiso = keyof typeof P;
export type Permisos = Record<Permiso, boolean>;

const CLAVES = Object.keys(P) as Permiso[];

/**
 * Una sola consulta por carga: public.presupuesto_mis_permisos devuelve, en
 * UNA llamada, los códigos presupuesto.* que tiene el usuario (exige
 * presupuesto.ver_modulo). Se queda esta RPC (20261020184030) en lugar de
 * misPermisos() de @nexo/auth porque ya resuelve los permisos de la app en
 * una llamada. public.mis_permisos (20261021164649, aplicada el 2026-10-21)
 * daría lo mismo; migrar a ella es opcional. `cache` de React la
 * comparte entre el layout y la página del mismo request, con el cliente
 * único de contextoActual(). Si la RPC falla o no responde un arreglo, todo
 * queda en false (cerrado por defecto).
 */
const leerPermisos = cache(async (): Promise<Permisos> => {
  let codigos = new Set<string>();
  try {
    const { supabase, companyId } = await contextoActual();
    const { data, error } = await supabase.rpc("presupuesto_mis_permisos", { p_company_id: companyId });
    if (!error && Array.isArray(data)) codigos = new Set(data.filter((c): c is string => typeof c === "string"));
  } catch {
    codigos = new Set();
  }
  return Object.fromEntries(CLAVES.map((k) => [k, codigos.has(P[k])])) as Permisos;
});

/** Permisos del usuario actual, para ocultar o deshabilitar en la UI. No reemplaza a requirePermission. */
export function permisosDe(): Promise<Permisos> {
  return leerPermisos();
}

/**
 * Cliente, empresa y permisos para una página: sin llamar a Auth (el layout
 * ya validó la sesión; las RPC validan el JWT y el permiso en la base).
 */
export async function contextoDePagina(): Promise<Contexto & { permisos: Permisos }> {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  return { ...ctx, permisos };
}

/** "Ver presupuesto": mismo criterio que public.presupuesto_anual. */
export function puedeVerPresupuesto(p: Permisos): boolean {
  return p.equipo || p.metasVend || p.presupuesto;
}

/**
 * Para Server Actions: exige el permiso (el mismo código que exige la RPC)
 * antes de cualquier efecto. Fuera de un render, contextoActual() no
 * memoriza: cada acción usa su propio cliente.
 */
export async function contextoConPermiso(codigo: string): Promise<Contexto | { error: string }> {
  const ctx = await contextoActual();
  try {
    await requirePermission(ctx, codigo);
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { error: SIN_PERMISO };
    throw err;
  }
  return ctx;
}
