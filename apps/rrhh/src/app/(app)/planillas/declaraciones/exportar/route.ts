import type { NextRequest } from "next/server";
import { P } from "@/lib/permisos-rrhh";
import { consultarRpc, exigirEnRuta, respuestaError } from "@/lib/planilla/servidor";
import { REGIMEN, TIPO_DECLARACION, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import { aPorcentaje } from "@/lib/planilla/formato";
import { esMes, etiquetaMes, primerDiaMes } from "@/lib/planilla/periodos";
import { aCsv, respuestaCsv, type CeldaCsv } from "@/lib/planilla/csv";
import type { DeclaracionInatec, DeclaracionInss, DeclaracionIr, Resultado } from "@/lib/planilla/tipos";

export const dynamic = "force-dynamic";

const GENERICO = "No se pudo generar la declaración. Intenta de nuevo.";

function estadoDe(fallo: Extract<Resultado<unknown>, { ok: false }>): number {
  return fallo.motivo === "denegado" ? 403 : fallo.motivo === "negocio" ? 400 : 500;
}

/**
 * GET /rrhh/planillas/declaraciones/exportar?tipo=inss|inatec|ir&mes=YYYY-MM
 *
 * CSV de revisión de la declaración del mes (A5). Endpoint público: valida
 * sesión, rrhh.ver_modulo, declaraciones.generar y reportes.exportar en el
 * servidor (exigirEnRuta, nunca la lista cacheada de la UI) ANTES de leer
 * los parámetros o consultar; la RPC vuelve a validar el permiso y audita la
 * generación. Sin cálculo: las cifras son las de la RPC. El texto se protege
 * contra inyección de fórmulas en aCsv.
 *
 * Errores en JSON `{ message }` (BotonExportarCsv los muestra en un toast):
 * 401 sin sesión, 403 sin permiso, 400 parámetros o regla de negocio,
 * 404 sin datos, 500 error inesperado.
 */
export async function GET(request: NextRequest) {
  const acceso = await exigirEnRuta([P.declaracionesGenerar, P.planillaExportar], {
    sinPermiso: "No tienes permiso para exportar declaraciones. Pide acceso a tu administrador.",
  });
  if (!acceso.ok) return acceso.respuesta;

  const tipo = request.nextUrl.searchParams.get("tipo");
  const mes = request.nextUrl.searchParams.get("mes");
  if (!esClaveDe(TIPO_DECLARACION, tipo)) return respuestaError(400, "Indica el tipo de declaración: INSS, INATEC o IR.");
  if (!esMes(mes)) return respuestaError(400, "Indica el mes de la declaración.");

  const args = { p_mes: primerDiaMes(mes) };
  const sinDatos = `No hay datos para declarar en ${etiquetaMes(mes).toLowerCase()}.`;
  let encabezados: string[];
  let filas: CeldaCsv[][];

  if (tipo === "inss") {
    const r = await consultarRpc<DeclaracionInss[]>(acceso.ctx, "planilla_declaracion_inss", args, "csv: declaracion_inss", GENERICO);
    if (!r.ok) return respuestaError(estadoDe(r), r.mensaje);
    const datos = Array.isArray(r.valor) ? r.valor : [];
    if (datos.length === 0) return respuestaError(404, sinDatos);
    encabezados = ["Persona", "Cédula", "N.º INSS", "Días", "Salario INSS", "INSS laboral", "INSS patronal"];
    filas = datos.map((f) => [
      f.empleado_nombre,
      f.documento_identidad,
      f.numero_inss,
      f.dias,
      f.salario_inss,
      f.inss_laboral,
      f.inss_patronal,
    ]);
  } else if (tipo === "inatec") {
    const r = await consultarRpc<DeclaracionInatec[]>(
      acceso.ctx,
      "planilla_declaracion_inatec",
      args,
      "csv: declaracion_inatec",
      GENERICO
    );
    if (!r.ok) return respuestaError(estadoDe(r), r.mensaje);
    const datos = Array.isArray(r.valor) ? r.valor : [];
    if (datos.length === 0) return respuestaError(404, sinDatos);
    encabezados = ["Base", "Tasa (%)", "Monto", "Empleados"];
    filas = datos.map((f) => [f.base, aPorcentaje(f.tasa), f.monto, f.empleados]);
  } else {
    const r = await consultarRpc<DeclaracionIr[]>(acceso.ctx, "planilla_declaracion_ir", args, "csv: declaracion_ir", GENERICO);
    if (!r.ok) return respuestaError(estadoDe(r), r.mensaje);
    const datos = Array.isArray(r.valor) ? r.valor : [];
    if (datos.length === 0) return respuestaError(404, sinDatos);
    encabezados = ["Persona", "Cédula", "Régimen", "Renta bruta", "INSS laboral", "Renta neta", "IR retenido"];
    filas = datos.map((f) => [
      f.empleado_nombre,
      f.documento_identidad,
      etiqueta(REGIMEN, f.regimen),
      f.renta_bruta,
      f.inss_laboral,
      f.renta_neta,
      f.ir_retenido,
    ]);
  }

  return respuestaCsv(`declaracion-${tipo}-${mes}.csv`, aCsv(encabezados, filas));
}
