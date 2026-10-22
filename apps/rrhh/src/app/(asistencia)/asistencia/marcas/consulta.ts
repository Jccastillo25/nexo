import type { SupabaseClient } from "@nexo/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { filtrosValidos, TAMANO_PAGINA_MARCAS, type FiltrosMarcas } from "./filtros";

export type MarcaRow = Database["public"]["Functions"]["consultar_marcas"]["Returns"][number];
export type MarcasResult = { ok: true; rows: MarcaRow[] } | { ok: false; message: string };

/**
 * Solo servidor (recibe el cliente con la sesión del request).
 *
 * Lectura de marcas (public.consultar_marcas, que vuelve a validar
 * `rrhh.asistencia.marcas.ver` y la empresa en la base). NO comprueba el
 * permiso por su cuenta: quien la llama ya lo hizo. La página usa la lista de
 * permisos cacheada del request; la Server Action `consultarMarcas`, que es un
 * endpoint público, llama antes a requirePermission.
 */
export async function leerMarcas(
  supabase: SupabaseClient<Database>,
  companyId: string,
  filtros: FiltrosMarcas
): Promise<MarcasResult> {
  if (!filtrosValidos(filtros)) {
    return { ok: false, message: "Revisa los filtros: rango máximo de 62 días y fechas válidas." };
  }
  const { data, error } = await supabase.rpc("consultar_marcas", {
    p_company_id: companyId,
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_empleado_id: filtros.empleadoId || undefined,
    p_contrato_id: filtros.contratoId || undefined,
    p_estado: filtros.estado || undefined,
    p_limit: TAMANO_PAGINA_MARCAS,
    p_offset: filtros.offset ?? 0,
  });
  if (error) {
    console.error("Marcas de Asistencia: no se pudo consultar consultar_marcas", error);
    return { ok: false, message: "No se pudieron consultar las marcas. Intenta de nuevo." };
  }
  return { ok: true, rows: data ?? [] };
}
