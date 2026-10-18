"use server";

import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { filtrosValidos, type FiltrosMarcas } from "./filtros";
import type { Database } from "@/lib/supabase/database.types";

export type MarcaRow = Database["public"]["Functions"]["consultar_marcas"]["Returns"][number];
export type MarcasResult = { ok: true; rows: MarcaRow[] } | { ok: false; message: string };

export async function consultarMarcas(filtros: FiltrosMarcas): Promise<MarcasResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();
  try {
    await requirePermission({ supabase, companyId }, "rrhh.asistencia.marcas.ver");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: "Sin permiso para ver marcas." };
    throw err;
  }
  if (!filtrosValidos(filtros)) return { ok: false, message: "Revisa los filtros: rango máximo de 62 días y fechas válidas." };
  const { data, error } = await supabase.rpc("consultar_marcas", {
    p_company_id: companyId, p_desde: filtros.desde, p_hasta: filtros.hasta,
    p_empleado_id: filtros.empleadoId || undefined, p_contrato_id: filtros.contratoId || undefined,
    p_estado: filtros.estado || undefined, p_limit: 50, p_offset: filtros.offset ?? 0,
  });
  if (error) return { ok: false, message: "No se pudieron consultar las marcas. Intenta de nuevo." };
  return { ok: true, rows: data ?? [] };
}
