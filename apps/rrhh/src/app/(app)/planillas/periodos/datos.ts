import "server-only";

/**
 * Lecturas de tablas de Planilla para las pantallas del paquete Nómina
 * (Resumen, lista, nueva planilla). Todo lo que calcula o cambia algo va por
 * RPC (`lib/planilla/servidor.ts`); aquí solo se leen filas que la RLS ya
 * protege (`rrhh.planillas` con planilla.ver, `rrhh.planilla_tipos` y
 * `rrhh.conceptos` con conceptos.ver).
 *
 * `database.types.ts` todavía no trae las columnas de PL2a (totales,
 * planilla_tipo_id…), por eso el cliente se usa sin tipos generados y cada
 * resultado se tipa con `lib/planilla/tipos.ts`.
 *
 * "Sin datos" es distinto de "falló": cada lectura devuelve un `Resultado`;
 * el detalle técnico queda en el log del servidor.
 */
import type { Contexto } from "@nexo/auth";
import { MENSAJE_GENERICO, MENSAJE_SIN_PERMISO } from "@nexo/permissions";
import type { Periodo } from "@/lib/planilla/periodos";
import { consultarRpc } from "@/lib/planilla/servidor";
import type { Concepto, Linea, PlanillaDetalle, PlanillaFila, PlanillaTipo, Renglon, Resultado } from "@/lib/planilla/tipos";

/** Columnas de `rrhh.planillas` que usan los listados y el Resumen. */
export const COLUMNAS_LISTA = "id, planilla_tipo_id, periodo_inicio, periodo_fin, fecha_pago, estado, totales, created_at";

export type PlanillaLista = Pick<
  PlanillaFila,
  "id" | "planilla_tipo_id" | "periodo_inicio" | "periodo_fin" | "fecha_pago" | "estado" | "totales" | "created_at"
>;

export type TipoPlanillaResumen = Pick<PlanillaTipo, "id" | "nombre" | "clase" | "frecuencia" | "activo">;

export type ConceptoNovedad = Pick<Concepto, "id" | "codigo" | "nombre" | "tipo" | "metodo" | "activo" | "permite_novedad" | "orden">;

interface RespuestaTabla {
  data: unknown;
  error: unknown;
  count?: number | null;
}

function codigoDe(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

/** Error de una lectura de tabla → `Resultado` fallido (42501 = denegado; el resto, genérico + log). */
export function falloDeTabla(error: unknown, contexto: string): Extract<Resultado<never>, { ok: false }> {
  console.error(contexto, error);
  if (codigoDe(error) === "42501") return { ok: false, motivo: "denegado", mensaje: MENSAJE_SIN_PERMISO };
  return { ok: false, motivo: "error", mensaje: MENSAJE_GENERICO };
}

/** Filas de una lectura de tabla. Sin error, un resultado vacío es `[]` (nunca se confunde con un fallo). */
export function filasDe<T>(res: RespuestaTabla, contexto: string): Resultado<T[]> {
  if (res.error) return falloDeTabla(res.error, contexto);
  return { ok: true, valor: (Array.isArray(res.data) ? res.data : []) as T[] };
}

/** Conteo (`count: "exact", head: true`) de una lectura de tabla. */
export function conteoDe(res: RespuestaTabla, contexto: string): Resultado<number> {
  if (res.error) return falloDeTabla(res.error, contexto);
  return { ok: true, valor: typeof res.count === "number" ? res.count : 0 };
}

/** Cliente del schema `rrhh` con la sesión del usuario (la RLS filtra por permiso). */
export function tablasRrhh(ctx: Contexto) {
  return ctx.supabase.schema("rrhh");
}

/** Tipos de planilla de la empresa (exige conceptos.ver por RLS; sin él la lista llega vacía). */
export async function tiposDePlanilla(ctx: Contexto): Promise<Resultado<TipoPlanillaResumen[]>> {
  const res = await tablasRrhh(ctx)
    .from("planilla_tipos")
    .select("id, nombre, clase, frecuencia, activo")
    .eq("company_id", ctx.companyId)
    .order("nombre", { ascending: true });
  return filasDe<TipoPlanillaResumen>(res, "planilla_tipos: listado");
}

/**
 * Período de la última planilla NO anulada de un tipo (para proponer el
 * siguiente con `periodoSiguiente`). Null si el tipo todavía no tiene
 * ninguna.
 */
export async function ultimoPeriodoDelTipo(ctx: Contexto, tipoId: string): Promise<Resultado<Periodo | null>> {
  const res = await tablasRrhh(ctx)
    .from("planillas")
    .select("periodo_inicio, periodo_fin")
    .eq("company_id", ctx.companyId)
    .eq("planilla_tipo_id", tipoId)
    .neq("estado", "anulada")
    .order("periodo_fin", { ascending: false })
    .limit(1);
  const filas = filasDe<{ periodo_inicio: string; periodo_fin: string }>(res, "planillas: último período del tipo");
  if (!filas.ok) return filas;
  const ultima = filas.valor[0];
  return { ok: true, valor: ultima ? { inicio: ultima.periodo_inicio, fin: ultima.periodo_fin } : null };
}

// ---------------------------------------------------------------- detalle (RPC)

/** Mensaje exacto con el que la RPC responde a un id que no existe en la empresa. */
const NO_ENCONTRADA = "Planilla no encontrada.";

function lista<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}

function textos(valor: unknown): string[] {
  return lista<unknown>(valor).filter((x): x is string => typeof x === "string");
}

/**
 * `planilla_detalle(p_planilla_id)` (planilla.ver): fila completa de la
 * planilla con tipo, empresa y renglones con sus líneas. Devuelve
 * `"no-encontrada"` si la RPC no la encuentra (la página hace `notFound()`).
 * Normaliza las listas (renglones, líneas, avisos) para que la vista nunca
 * lea `undefined`; los montos no se tocan.
 */
export async function detallePlanilla(ctx: Contexto, id: string): Promise<Resultado<PlanillaDetalle> | "no-encontrada"> {
  const r = await consultarRpc<PlanillaDetalle>(ctx, "planilla_detalle", { p_planilla_id: id }, "planilla_detalle");
  if (!r.ok) return r.motivo === "negocio" && r.mensaje === NO_ENCONTRADA ? "no-encontrada" : r;
  const d = r.valor;
  if (!d || typeof d !== "object" || !d.planilla) {
    console.error("planilla_detalle: respuesta sin planilla", d);
    return { ok: false, motivo: "error", mensaje: MENSAJE_GENERICO };
  }
  const totales = typeof d.planilla.totales === "object" && d.planilla.totales !== null ? d.planilla.totales : {};
  return {
    ok: true,
    valor: {
      planilla: { ...d.planilla, totales: { ...totales, avisos: textos(totales.avisos) } },
      empresa: d.empresa ?? null,
      renglones: lista<Renglon>(d.renglones).map((rg) => ({
        ...rg,
        avisos: textos(rg.avisos),
        lineas: lista<Linea>(rg.lineas),
      })),
    },
  };
}

/** Conceptos que admiten novedades (exige conceptos.ver por RLS). */
export async function conceptosDeNovedad(ctx: Contexto): Promise<Resultado<ConceptoNovedad[]>> {
  const res = await tablasRrhh(ctx)
    .from("conceptos")
    .select("id, codigo, nombre, tipo, metodo, activo, permite_novedad, orden")
    .eq("company_id", ctx.companyId)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  return filasDe<ConceptoNovedad>(res, "conceptos: listado para novedades");
}
