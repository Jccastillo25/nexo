/**
 * Acceso a las RPC de reportes de Asistencia (solo servidor: páginas,
 * vista de impresión y Route Handler del PDF). Toda la lógica de cálculo y
 * de autorización está en Postgres (security definer, 42501/22023), para
 * que Nexo Mobile use las mismas RPC; aquí solo se adaptan parámetros y se
 * traducen los errores a mensajes legibles (nunca el texto crudo).
 */
import type { SupabaseClient } from "@nexo/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import { armarDocumento, type DocumentoReporte } from "./documento";
import {
  entero,
  errorDeRpc,
  filtrosParaAuditoria,
  MAX_FILAS_EXPORTACION,
  resolverContrato,
  type MotivoError,
} from "./formato";
import type { DatosReporte, Emision, FiltrosReporte, OpcionesReporte, Reporte, Totales } from "./tipos";

/** Cliente con la sesión del usuario (contextoActual de @nexo/auth o createServerClient de @nexo/supabase). */
export type Cliente = SupabaseClient<Database>;

export type Fallo = { ok: false; motivo: MotivoError | "excede" | "seleccion"; mensaje: string };
export type Resultado<T> = { ok: true; valor: T } | Fallo;

type RespuestaRpc = { data: Json | null; error: { code?: string; message?: string } | null };

function fallo(error: RespuestaRpc["error"], contexto: string): Fallo {
  const traducido = errorDeRpc(error);
  if (traducido.motivo === "error") console.error(`Reportes de Asistencia: falló ${contexto}`, error);
  return { ok: false, ...traducido };
}

const vacio = (v: string) => (v ? v : undefined);

export async function obtenerOpciones(supabase: Cliente, companyId: string): Promise<Resultado<OpcionesReporte>> {
  const { data, error } = (await supabase.rpc("asistencia_reporte_opciones", { p_company_id: companyId })) as RespuestaRpc;
  if (error || !data) return fallo(error, "asistencia_reporte_opciones");
  const o = data as unknown as Partial<OpcionesReporte>;
  return {
    ok: true,
    valor: { departamentos: o.departamentos ?? [], puestos: o.puestos ?? [], empleados: o.empleados ?? [] },
  };
}

/**
 * Consulta un reporte. La tarjeta usa el reporte diario con un contrato e
 * incluye los días no laborables; `filtros.contratoId` ya debe venir
 * resuelto (ver `resolverContrato`).
 */
export async function consultarReporte(
  supabase: Cliente,
  companyId: string,
  reporte: Reporte,
  filtros: FiltrosReporte,
  pagina: { limit: number; offset: number }
): Promise<Resultado<DatosReporte>> {
  const comunes = {
    p_company_id: companyId,
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_departamento_id: vacio(filtros.departamentoId),
    p_puesto_id: vacio(filtros.puestoId),
    p_empleado_id: vacio(filtros.empleadoId),
  };
  let respuesta: RespuestaRpc;
  switch (reporte) {
    case "diaria":
      respuesta = (await supabase.rpc("asistencia_reporte_diario", {
        ...comunes,
        p_estado: vacio(filtros.estado),
        p_incluir_no_laborables: filtros.incluirNoLaborables,
        p_limit: pagina.limit,
        p_offset: pagina.offset,
      })) as RespuestaRpc;
      break;
    case "tarjeta":
      respuesta = (await supabase.rpc("asistencia_reporte_diario", {
        ...comunes,
        p_contrato_id: vacio(filtros.contratoId),
        p_incluir_no_laborables: true,
        p_limit: pagina.limit,
        p_offset: pagina.offset,
      })) as RespuestaRpc;
      break;
    case "resumen":
      respuesta = (await supabase.rpc("asistencia_reporte_resumen", comunes)) as RespuestaRpc;
      break;
    case "tardanzas":
      respuesta = (await supabase.rpc("asistencia_reporte_tardanzas", {
        ...comunes,
        p_tipo: vacio(filtros.tipo),
        p_limit: pagina.limit,
        p_offset: pagina.offset,
      })) as RespuestaRpc;
      break;
    case "incidencias":
      respuesta = (await supabase.rpc("asistencia_reporte_incidencias", {
        ...comunes,
        p_tipo: vacio(filtros.tipo),
        p_limit: pagina.limit,
        p_offset: pagina.offset,
      })) as RespuestaRpc;
      break;
  }
  if (respuesta.error || !respuesta.data) return fallo(respuesta.error, `el reporte ${reporte}`);
  const crudo = respuesta.data as unknown as { total?: number; totales?: Totales; filas?: unknown[] };
  return {
    ok: true,
    valor: {
      reporte,
      total: Number(crudo.total ?? 0),
      totales: crudo.totales ?? {},
      filas: crudo.filas ?? [],
    } as DatosReporte,
  };
}

export async function registrarExportacion(
  supabase: Cliente,
  companyId: string,
  reporte: Reporte,
  formato: "pdf" | "impresion",
  filtros: FiltrosReporte,
  filas: number
): Promise<Resultado<Emision>> {
  const { data, error } = (await supabase.rpc("asistencia_registrar_exportacion", {
    p_company_id: companyId,
    p_reporte: reporte,
    p_formato: formato,
    p_filtros: filtrosParaAuditoria(reporte, filtros),
    p_filas: filas,
  })) as RespuestaRpc;
  if (error || !data) {
    const f = fallo(error, "asistencia_registrar_exportacion");
    return f.motivo === "denegado"
      ? { ...f, mensaje: "No tienes permiso para exportar reportes. Pide acceso a tu administrador." }
      : f;
  }
  return { ok: true, valor: data as unknown as Emision };
}

export const MENSAJE_SELECCION_TARJETA = "Elige la persona y, si tiene varios contratos, el contrato de la tarjeta.";

/**
 * Prepara un reporte para el PDF o la vista de impresión: consulta hasta
 * 5000 filas, corta si hay más (motivo "excede"), registra la exportación
 * (auditoría + datos del encabezado) y arma el documento.
 */
export async function prepararExportacion(
  supabase: Cliente,
  companyId: string,
  reporte: Reporte,
  filtrosEntrada: FiltrosReporte,
  formato: "pdf" | "impresion"
): Promise<Resultado<{ documento: DocumentoReporte; filtros: FiltrosReporte }>> {
  const limite = { limit: MAX_FILAS_EXPORTACION, offset: 0 };
  let filtros = filtrosEntrada;
  let opciones: OpcionesReporte | null = null;
  let datos: Resultado<DatosReporte>;

  if (reporte === "tarjeta") {
    const o = await obtenerOpciones(supabase, companyId);
    if (!o.ok) return o;
    opciones = o.valor;
    const contrato = resolverContrato(opciones.empleados, filtros.empleadoId, filtros.contratoId);
    if (contrato.estado !== "ok") return { ok: false, motivo: "seleccion", mensaje: MENSAJE_SELECCION_TARJETA };
    filtros = { ...filtros, contratoId: contrato.contratoId };
    datos = await consultarReporte(supabase, companyId, reporte, filtros, limite);
  } else {
    const [o, d] = await Promise.all([
      obtenerOpciones(supabase, companyId),
      consultarReporte(supabase, companyId, reporte, filtros, limite),
    ]);
    // Sin opciones el documento sale igual: los filtros dicen "seleccionado".
    opciones = o.ok ? o.valor : null;
    datos = d;
  }
  if (!datos.ok) return datos;
  if (datos.valor.total > MAX_FILAS_EXPORTACION) {
    return {
      ok: false,
      motivo: "excede",
      mensaje: `El reporte tiene ${entero(datos.valor.total)} filas y el máximo para exportar es ${entero(MAX_FILAS_EXPORTACION)}. Acota el rango de fechas o los filtros.`,
    };
  }

  const emision = await registrarExportacion(supabase, companyId, reporte, formato, filtros, datos.valor.filas.length);
  if (!emision.ok) return emision;

  return {
    ok: true,
    valor: { documento: armarDocumento({ datos: datos.valor, filtros, opciones, emision: emision.valor }), filtros },
  };
}
