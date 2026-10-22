/**
 * Sumas de presentación del Resumen de planilla (B1). Módulo PURO.
 *
 * Solo suma montos que la RPC ya calculó y guardó en `rrhh.planillas.totales`
 * (con `sumarMontos`, en centavos enteros: D14, aceptado por el
 * coordinador). Ningún cálculo de planilla vive aquí.
 *
 * "Planillas del mes" = `periodo_fin` dentro del mes **y** estado calculada,
 * aprobada o pagada. Un borrador no tiene totales y una anulada no cuenta.
 *
 * El costo del empleador del mes NO suma la planilla de aguinaldo: ese costo
 * ya se provisiona cada mes en las planillas ordinarias (contarlo otra vez lo
 * duplicaría). El neto a pagar sí la incluye, y el aguinaldo se informa
 * aparte (`aguinaldo`).
 */
import { sumarMontos } from "@/lib/planilla/formato";
import { mesDe } from "@/lib/planilla/periodos";
import type { ClasePlanilla, EstadoPlanilla, TotalesPlanilla } from "@/lib/planilla/tipos";

export interface FilaResumen {
  planilla_tipo_id: string;
  estado: EstadoPlanilla;
  periodo_fin: string;
  totales: Partial<TotalesPlanilla> | null;
}

export interface TotalesMes {
  /** Planillas que cuentan en el mes (incluido el aguinaldo). */
  planillas: number;
  /** De ellas, las que siguen calculadas (sin aprobar). */
  sinAprobar: number;
  /** Planillas que entran en el costo (todas menos las de aguinaldo). */
  ordinarias: number;
  /** Σ totales.costo_total (devengado + aportes patronales + provisiones) SIN el aguinaldo. */
  costo: number;
  /** Σ neto, con el aguinaldo. */
  neto: number;
  /** Σ neto de las planillas ya pagadas (con el aguinaldo). */
  netoPagado: number;
  aportes: number;
  provisiones: number;
  /** Aguinaldo del mes: su neto y si ya está todo pagado; null si no hubo planilla de aguinaldo. */
  aguinaldo: { neto: number; pagado: boolean } | null;
  /** Hay planillas cuyo tipo no se conoce (sin permiso o sin lectura de los tipos): el costo podría incluir aguinaldo. */
  claseDesconocida: boolean;
}

const CUENTAN: ReadonlySet<EstadoPlanilla> = new Set<EstadoPlanilla>(["calculada", "aprobada", "pagada"]);

/**
 * Totales del mes "YYYY-MM"; null si no hay planillas que cuenten (la vista
 * muestra "—", nunca C$ 0.00). `claseDe` da la clase del tipo de cada
 * planilla, o null si no se conoce (entonces cuenta como ordinaria y se
 * marca `claseDesconocida`).
 */
export function totalesDelMes(
  filas: readonly FilaResumen[],
  mes: string,
  claseDe: (f: FilaResumen) => ClasePlanilla | null
): TotalesMes | null {
  const delMes = filas.filter((f) => CUENTAN.has(f.estado) && mesDe(f.periodo_fin) === mes);
  if (delMes.length === 0) return null;
  const tot = (f: FilaResumen): Partial<TotalesPlanilla> => f.totales ?? {};
  const clases = delMes.map(claseDe);
  const aguinaldos = delMes.filter((_, i) => clases[i] === "aguinaldo");
  const ordinarias = delMes.filter((_, i) => clases[i] !== "aguinaldo");
  return {
    planillas: delMes.length,
    sinAprobar: delMes.filter((f) => f.estado === "calculada").length,
    ordinarias: ordinarias.length,
    costo: sumarMontos(ordinarias.map((f) => tot(f).costo_total)),
    neto: sumarMontos(delMes.map((f) => tot(f).neto)),
    netoPagado: sumarMontos(delMes.filter((f) => f.estado === "pagada").map((f) => tot(f).neto)),
    aportes: sumarMontos(delMes.map((f) => tot(f).aportes)),
    provisiones: sumarMontos(delMes.map((f) => tot(f).provisiones)),
    aguinaldo:
      aguinaldos.length > 0
        ? {
            neto: sumarMontos(aguinaldos.map((f) => tot(f).neto)),
            pagado: aguinaldos.every((f) => f.estado === "pagada"),
          }
        : null,
    claseDesconocida: clases.some((c) => c === null),
  };
}
