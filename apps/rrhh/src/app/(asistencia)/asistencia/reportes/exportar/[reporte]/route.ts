import { NextResponse, type NextRequest } from "next/server";
import { PermissionDeniedError, requirePermission, type PermissionContext } from "@nexo/permissions";
import { createServerClient } from "@nexo/supabase";
import { getCompanyId } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { P_ASISTENCIA } from "@/lib/permisos-asistencia";
import { hoyManagua } from "@/lib/fecha-managua";
import { prepararExportacion } from "@/lib/reportes-asistencia/datos";
import { esReporte, leerFiltros, nombreArchivo } from "@/lib/reportes-asistencia/formato";
import { generarPdf } from "@/lib/reportes-asistencia/pdf";

// jspdf usa su build de Node (Buffer); no corre en Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(status: number, message: string) {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** requirePermission (fail-closed) convertido en booleano, para responder 403 con un mensaje propio. */
async function exigir(ctx: PermissionContext, codigo: string): Promise<boolean> {
  try {
    await requirePermission(ctx, codigo);
    return true;
  } catch (err) {
    if (err instanceof PermissionDeniedError) return false;
    throw err;
  }
}

/**
 * GET /rrhh/asistencia/reportes/exportar/<reporte>?<filtros de la pantalla>
 *
 * Genera el PDF en el servidor. Valida sesión, empresa,
 * `asistencia.ver_modulo` y `rrhh.asistencia.reportes.exportar` antes de
 * consultar; las RPC vuelven a
 * validar permisos y filtros. Cada PDF entregado queda auditado por
 * `asistencia_registrar_exportacion` (formato "pdf"), cuya respuesta da la
 * empresa, el RUC y la emisión del encabezado y del pie.
 *
 * Errores en JSON `{ message }` (la pantalla los muestra con un toast):
 * 401 sin sesión, 403 sin permiso, 400 filtros, 404 reporte desconocido,
 * 422 más de 5000 filas, 500 error inesperado.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/asistencia/reportes/exportar/[reporte]">) {
  const { reporte } = await ctx.params;
  if (!esReporte(reporte)) return error(404, "Ese reporte no existe.");

  const companyId = getCompanyId();
  const supabase = await createServerClient<Database>();
  const ctxPermiso = { supabase, companyId };
  // Igual que el layout de Asistencia y el de impresión: sin acceso a la
  // app (asistencia.ver_modulo) tampoco se exporta, aunque el rol tenga el
  // permiso de exportar. Endpoint público: cada permiso se valida en el
  // servidor (requirePermission), nunca con la lista cacheada de la UI.
  const [{ data: auth }, veModulo, puedeExportar] = await Promise.all([
    supabase.auth.getUser(),
    exigir(ctxPermiso, P_ASISTENCIA.modulo),
    exigir(ctxPermiso, P_ASISTENCIA.reportesExportar),
  ]);
  if (!auth.user) return error(401, "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.");
  if (!veModulo) return error(403, "No tienes acceso a la app Asistencia. Pide acceso a tu administrador.");
  if (!puedeExportar) return error(403, "No tienes permiso para exportar reportes. Pide acceso a tu administrador.");

  const { filtros, error: errorFiltros } = leerFiltros(reporte, request.nextUrl.searchParams, hoyManagua());
  if (errorFiltros) return error(400, errorFiltros);

  const preparado = await prepararExportacion(supabase, companyId, reporte, filtros, "pdf");
  if (!preparado.ok) {
    const status =
      preparado.motivo === "denegado" ? 403 : preparado.motivo === "excede" ? 422 : preparado.motivo === "error" ? 500 : 400;
    return error(status, preparado.mensaje);
  }

  let pdf: ArrayBuffer;
  try {
    pdf = generarPdf(preparado.valor.documento);
  } catch (err) {
    console.error("Reportes de Asistencia: no se pudo generar el PDF", err);
    return error(500, "No se pudo generar el PDF. Intenta de nuevo.");
  }

  const archivo = nombreArchivo(reporte, preparado.valor.filtros.desde, preparado.valor.filtros.hasta);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
