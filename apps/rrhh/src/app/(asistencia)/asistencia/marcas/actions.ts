"use server";

import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { contextoActual } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { P_ASISTENCIA } from "@/lib/permisos-asistencia";
import { leerMarcas, type MarcasResult } from "./consulta";
import type { FiltrosMarcas } from "./filtros";

/**
 * Consulta de marcas desde el navegador (filtros y paginación). Es un
 * endpoint público: valida el permiso con requirePermission antes de leer,
 * aunque la página ya lo haya comprobado con la lista cacheada.
 */
export async function consultarMarcas(filtros: FiltrosMarcas): Promise<MarcasResult> {
  const { supabase, companyId } = await contextoActual<Database>();
  try {
    await requirePermission({ supabase, companyId }, P_ASISTENCIA.marcasVer);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { ok: false, message: "No tienes permiso para ver las marcas. Pide acceso a quien administra Nexo." };
    }
    throw err;
  }
  return leerMarcas(supabase, companyId, filtros);
}
