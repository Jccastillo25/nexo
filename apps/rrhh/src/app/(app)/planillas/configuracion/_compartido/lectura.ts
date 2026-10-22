import "server-only";

import { falloDeRpc } from "@/lib/planilla/servidor";
import type { Resultado } from "@/lib/planilla/tipos";

/**
 * Lectura directa de una tabla de Planilla (RLS por permiso, solo SELECT;
 * contrato §2) convertida en `Resultado`, igual que `consultarRpc`: el error
 * se revisa ANTES de tomar las filas (nunca se toman sin mirar el error) y se
 * traduce con falloDeRpc (42501 → denegado, P0001 → negocio, otro → error
 * genérico con console.error). No lanza.
 *
 * `consulta` es el builder de supabase-js ya armado (siempre filtrado por
 * `company_id` del servidor).
 */
export async function leerFilas<T>(
  consulta: PromiseLike<{ data: unknown; error: unknown }>,
  contexto: string,
  generico?: string
): Promise<Resultado<T[]>> {
  try {
    const { data, error } = await consulta;
    if (error) return falloDeRpc(error, contexto, generico);
    // Sin error, PostgREST devuelve siempre un arreglo (vacío si no hay filas).
    return { ok: true, valor: Array.isArray(data) ? (data as T[]) : [] };
  } catch (err) {
    return falloDeRpc(err, contexto, generico);
  }
}

/**
 * Igual que `leerFilas`, con el conteo exacto (`select(..., { count: "exact" })`):
 * si `conteo` es mayor que las filas recibidas, la API recortó el resultado
 * (límite de filas) y la pantalla debe decirlo en vez de sumar de menos.
 */
export async function leerFilasContadas<T>(
  consulta: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>,
  contexto: string,
  generico?: string
): Promise<Resultado<{ filas: T[]; conteo: number | null }>> {
  try {
    const { data, error, count } = await consulta;
    if (error) return falloDeRpc(error, contexto, generico);
    return {
      ok: true,
      valor: { filas: Array.isArray(data) ? (data as T[]) : [], conteo: typeof count === "number" ? count : null },
    };
  } catch (err) {
    return falloDeRpc(err, contexto, generico);
  }
}

/** Igual que `leerFilas`, para una sola fila (`maybeSingle`): null si no existe. */
export async function leerFila<T>(
  consulta: PromiseLike<{ data: unknown; error: unknown }>,
  contexto: string,
  generico?: string
): Promise<Resultado<T | null>> {
  try {
    const { data, error } = await consulta;
    if (error) return falloDeRpc(error, contexto, generico);
    return { ok: true, valor: (data ?? null) as T | null };
  } catch (err) {
    return falloDeRpc(err, contexto, generico);
  }
}

/** Primer valor de un parámetro de `searchParams` (texto, arreglo o nada). */
export function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
