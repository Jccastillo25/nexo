"use server";

/**
 * Server Actions de la corrida de planilla (paquete Nómina): crear, calcular,
 * aprobar, pagar, anular e importar de Asistencia.
 *
 * Cada una: `prepararAccion` (contexto del servidor + requirePermission
 * ANTES de cualquier efecto) → validación de formato (uuid, fecha ISO,
 * números finitos, listas cerradas) → RPC `planilla_*` con `p_company_id` del
 * servidor (`accionRpc`) → revalidatePath. Toda la lógica y la autorización
 * real están en las RPC (security definer + core.fn_exigir_permiso), las
 * mismas que usará Nexo Mobile. Los errores llegan ya traducidos: P0001 tal
 * cual (texto de la RPC), 42501 → "Tu rol no permite realizar esta acción.",
 * el resto genérico con el detalle en el log.
 */
import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { validarMotivo } from "@/lib/planilla/estados";
import { num } from "@/lib/planilla/formato";
import { esFechaIso } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import type { ItemImportarAsistencia, MetodoPago, TotalesPlanilla } from "@/lib/planilla/tipos";

const NO_VALIDA = "La planilla indicada no es válida. Recarga la página e intenta de nuevo.";

function revalidarPlanilla(id: string) {
  revalidatePath(RUTA.detalle(id));
  revalidatePath(RUTA.periodos());
  revalidatePath(RUTA.resumen());
}

// ---------------------------------------------------------------- crear

export interface CrearPlanillaInput {
  tipoId: string;
  inicio: string;
  fin: string;
  /** "YYYY-MM-DD" o null. */
  fechaPago: string | null;
  /** uuid de la planilla anulada que se reemplaza, o null. */
  reemplazaA: string | null;
}

/** Crea la planilla en borrador (`planilla_crear`). Devuelve su uuid. */
export async function crearPlanilla(input: CrearPlanillaInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.planillaGenerar, "crearPlanilla");
  if (!prep.ok) return prep;

  const datos = (typeof input === "object" && input !== null ? input : {}) as Partial<Record<keyof CrearPlanillaInput, unknown>>;
  const { tipoId, inicio, fin } = datos;
  const fechaPago = datos.fechaPago ?? null;
  const reemplazaA = datos.reemplazaA ?? null;
  if (!esUuid(tipoId)) return { ok: false, message: "Elige el tipo de planilla." };
  if (!esFechaIso(inicio) || !esFechaIso(fin) || fin < inicio) return { ok: false, message: "Indica un período válido." };
  if (fechaPago !== null && !esFechaIso(fechaPago)) return { ok: false, message: "La fecha de pago no es válida." };
  if (fechaPago !== null && fechaPago < inicio) {
    return { ok: false, message: "La fecha de pago no puede ser anterior al período." };
  }
  if (reemplazaA !== null && !esUuid(reemplazaA)) return { ok: false, message: NO_VALIDA };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_crear",
    {
      p_planilla_tipo_id: tipoId,
      p_periodo_inicio: inicio,
      p_periodo_fin: fin,
      p_fecha_pago: fechaPago,
      p_reemplaza_a: reemplazaA,
    },
    "crearPlanilla",
    "No se pudo crear la planilla. Intenta de nuevo."
  );
  if (!r.ok) return r;
  if (!esUuid(r.data)) {
    console.error("crearPlanilla: la RPC no devolvió un uuid", r.data);
    return { ok: false, message: "No se pudo crear la planilla. Intenta de nuevo." };
  }
  revalidatePath(RUTA.periodos());
  revalidatePath(RUTA.resumen());
  if (reemplazaA) revalidatePath(RUTA.detalle(reemplazaA));
  return { ok: true, data: r.data };
}

// ---------------------------------------------------------------- calcular

/** Personas y neto que devolvió la RPC (null si la respuesta no los trae: el aviso se muestra sin cifras). */
export interface ResultadoCalculo {
  empleados: number | null;
  neto: number | null;
}

/** Calcula o recalcula la planilla (`planilla_calcular`). Devuelve personas y neto para el aviso. */
export async function calcularPlanilla(id: string): Promise<ActionResult<ResultadoCalculo>> {
  const prep = await prepararAccion(P.planillaGenerar, "calcularPlanilla");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: NO_VALIDA };

  const r = await accionRpc<Partial<TotalesPlanilla>>(
    prep.ctx,
    "planilla_calcular",
    { p_planilla_id: id },
    "calcularPlanilla",
    "No se pudo calcular la planilla. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidarPlanilla(id);
  const tot = typeof r.data === "object" && r.data !== null ? r.data : {};
  return { ok: true, data: { empleados: num(tot.empleados), neto: num(tot.neto) } };
}

// ---------------------------------------------------------------- aprobar

/** Aprueba la planilla (`planilla_aprobar`). La RPC rechaza a quien la generó o calculó. */
export async function aprobarPlanilla(id: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.planillaAprobar, "aprobarPlanilla");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: NO_VALIDA };

  const r = await accionRpc(
    prep.ctx,
    "planilla_aprobar",
    { p_planilla_id: id },
    "aprobarPlanilla",
    "No se pudo aprobar la planilla. Intenta de nuevo."
  );
  if (r.ok) revalidarPlanilla(id);
  return r.ok ? { ok: true } : r;
}

// ---------------------------------------------------------------- pagar

export interface PagarPlanillaInput {
  metodo: MetodoPago;
  referencia: string | null;
  fecha: string;
}

const METODOS: readonly MetodoPago[] = ["cheque", "transferencia"];

/** Marca la planilla aprobada como pagada (`planilla_pagar`). No cambia montos. */
export async function pagarPlanilla(id: string, input: PagarPlanillaInput): Promise<ActionResult> {
  const prep = await prepararAccion(P.planillaPagar, "pagarPlanilla");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: NO_VALIDA };

  const datos = (typeof input === "object" && input !== null ? input : {}) as Partial<Record<keyof PagarPlanillaInput, unknown>>;
  const metodo = datos.metodo;
  if (typeof metodo !== "string" || !METODOS.includes(metodo as MetodoPago)) {
    return { ok: false, message: "Indica el método de pago: cheque o transferencia." };
  }
  const referencia = typeof datos.referencia === "string" ? datos.referencia.trim() : null;
  if (referencia !== null && referencia.length > 120) {
    return { ok: false, message: "La referencia admite hasta 120 caracteres." };
  }
  if (!esFechaIso(datos.fecha)) return { ok: false, message: "Indica la fecha de pago." };

  const r = await accionRpc(
    prep.ctx,
    "planilla_pagar",
    { p_planilla_id: id, p_metodo_pago: metodo, p_referencia: referencia || null, p_fecha_pago: datos.fecha },
    "pagarPlanilla",
    "No se pudo marcar la planilla como pagada. Intenta de nuevo."
  );
  if (r.ok) revalidarPlanilla(id);
  return r.ok ? { ok: true } : r;
}

// ---------------------------------------------------------------- anular

/** Anula la planilla con motivo (`planilla_anular`); sus novedades vuelven a quedar pendientes. */
export async function anularPlanilla(id: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.planillaAnular, "anularPlanilla");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: NO_VALIDA };
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  const problema = validarMotivo(texto);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_anular",
    { p_planilla_id: id, p_motivo: texto },
    "anularPlanilla",
    "No se pudo anular la planilla. Intenta de nuevo."
  );
  if (r.ok) {
    revalidarPlanilla(id);
    revalidatePath(RUTA.novedades());
  }
  return r.ok ? { ok: true } : r;
}

// ---------------------------------------------------------------- importar de Asistencia

const CONCEPTOS_ASISTENCIA: readonly ItemImportarAsistencia["concepto_codigo"][] = ["HORAS_EXTRA", "AUSENCIA"];
const MAX_FILAS = 1000;

/**
 * Importa las horas extra y ausencias elegidas (`planilla_asistencia_importar`).
 * Exige también `rrhh.asistencia.reportes.ver` (la RPC lee marcas). Idempotente:
 * lo ya importado no se duplica. Devuelve cuántas novedades nuevas creó
 * (null si la respuesta de la RPC no trae el número).
 */
export async function importarAsistencia(
  id: string,
  items: readonly ItemImportarAsistencia[]
): Promise<ActionResult<number | null>> {
  const prep = await prepararAccion([P.novedadesCrear, P.asistenciaReportesVer], "importarAsistencia");
  if (!prep.ok) return prep;
  if (!esUuid(id)) return { ok: false, message: NO_VALIDA };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, message: "Elige al menos una fila para importar." };
  if (items.length > MAX_FILAS) return { ok: false, message: `Puedes importar hasta ${MAX_FILAS} filas a la vez.` };

  // Se arma cada fila de nuevo, solo con los cuatro campos que admite la RPC.
  const limpias: ItemImportarAsistencia[] = [];
  for (const bruto of items) {
    const it = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Partial<Record<keyof ItemImportarAsistencia, unknown>>;
    const cantidad = typeof it.cantidad === "number" ? it.cantidad : Number.NaN;
    if (
      !esUuid(it.contrato_id) ||
      !esFechaIso(it.fecha) ||
      typeof it.concepto_codigo !== "string" ||
      !CONCEPTOS_ASISTENCIA.includes(it.concepto_codigo as ItemImportarAsistencia["concepto_codigo"]) ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      return { ok: false, message: "Hay filas no válidas. Vuelve a cargar la propuesta e intenta de nuevo." };
    }
    limpias.push({
      contrato_id: it.contrato_id,
      fecha: it.fecha,
      concepto_codigo: it.concepto_codigo as ItemImportarAsistencia["concepto_codigo"],
      cantidad,
    });
  }

  const r = await accionRpc<number>(
    prep.ctx,
    "planilla_asistencia_importar",
    { p_planilla_id: id, p_items: limpias },
    "importarAsistencia",
    "No se pudieron importar las novedades. Intenta de nuevo."
  );
  if (!r.ok) return r;
  revalidatePath(RUTA.importarAsistencia(id));
  revalidatePath(RUTA.detalle(id));
  revalidatePath(RUTA.novedades());
  return { ok: true, data: num(r.data) };
}
