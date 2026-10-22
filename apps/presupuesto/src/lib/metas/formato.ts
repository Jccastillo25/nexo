// Formato propio de Presupuesto. Los montos y las fechas salen del formato de
// la suite (@nexo/ui/formato: es-NI, hora de Managua); aquí solo queda lo que
// es regla de esta app (C$ sin decimales, porcentaje truncado, umbral de
// riesgo). Funciones puras: sirven en servidor, en cliente y en `node --test`.
//
// `@nexo/ui/formato` está declarado en los `exports` de @nexo/ui, así que lo
// resuelven Next, TypeScript y `node --test` (ritmo.test.ts carga este archivo).
import { fechaCorta, moneda } from "@nexo/ui/formato";
import type { StatusTone } from "@nexo/ui";

const LOCALE = "es-NI";

const fmtCompacto = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const fmtPct = new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** "US$ 12,345.67": moneda() de la suite en dólares, con 2 decimales. */
export function usd(v: number | string | null | undefined): string {
  return moneda(v, "USD");
}

/** "C$ 452,100": moneda() de la suite en córdobas; esta app los muestra sin decimales (son de referencia). */
export function cs(v: number | string | null | undefined): string {
  return moneda(v, "NIO", { decimales: 0 });
}

/** C$ de referencia: US$ × tipo de cambio de la RPC. */
export function csReferencia(montoUsd: number | null | undefined, tipoCambio: number | null | undefined): string {
  if (montoUsd === null || montoUsd === undefined) return "—";
  if (tipoCambio === null || tipoCambio === undefined || !(Number(tipoCambio) > 0)) return "C$ no disponible";
  return cs(Number(montoUsd) * Number(tipoCambio));
}

/** "US$ 1.2 mil" para ejes de gráficos. */
export function usdCompacto(v: number): string {
  return `US$ ${fmtCompacto.format(v)}`;
}

/**
 * Fracción → "85 %" / "99.5 %". Trunca hacia abajo a 1 decimal del %: 0.9996
 * se ve "99.9 %", nunca "100 %" sin estar Cumplida (estadoCumplimiento usa ≥ 1).
 */
export function pct(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined || !Number.isFinite(fraccion)) return "—";
  return fmtPct.format(Math.floor(fraccion * 1000 + 1e-9) / 1000);
}

/** Variación con signo: "+12.3 %", "−4 %", "0 %". */
export function pctSigno(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined || !Number.isFinite(fraccion)) return "—";
  const redondeada = Math.round(fraccion * 1000) / 1000;
  if (redondeada === 0) return fmtPct.format(0);
  return `${redondeada > 0 ? "+" : "−"}${fmtPct.format(Math.abs(redondeada))}`;
}

/** Leyenda de frescura de los datos (fecha de la última factura importada). */
export function datosHasta(ultimaFactura: string | null | undefined): string {
  return ultimaFactura ? `Facturas importadas hasta el ${fechaCorta(ultimaFactura)}` : "Todavía no hay facturas importadas";
}

/**
 * El mes elegido es posterior al mes del corte (última factura importada, o
 * no hay facturas): lo vendido en el año no llega hasta ese mes, así que la
 * meta acumulada a la fecha no es comparable.
 */
export function mesPosteriorAlCorte(corte: string | null | undefined, anio: number, mes: number): boolean {
  const m = /^(\d{4})-(\d{2})/.exec(corte ?? "");
  if (!m) return true;
  return anio * 12 + mes > Number(m[1]) * 12 + Number(m[2]);
}

/** Texto numérico escrito por el usuario: "3,093,113.11", "US$ 500", "32". Null si no es número. */
export function leerNumero(s: string): number | null {
  const limpio = s.replace(/US\$|C\$|\$|%/gi, "").replace(/[\s,]/g, "");
  if (limpio === "" || !/^-?\d*(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Vendido / meta; null cuando no hay meta (o es 0). */
export function cumplimiento(vendido: number, meta: number | null | undefined): number | null {
  return meta === null || meta === undefined || !(Number(meta) > 0) ? null : Number(vendido) / Number(meta);
}

/**
 * Desde esta fracción de la meta (o del ritmo) un estado es "En riesgo" y no
 * "Baja"/"No llega". Un solo umbral para toda la app: cumplimiento, ritmo,
 * proyección y acumulado del año.
 */
export const UMBRAL_RIESGO = 0.9;

/** Estado de cumplimiento: ≥100 % Cumplida, 90–99.9 % En riesgo (UMBRAL_RIESGO), <90 % Baja, sin meta Sin meta. */
export function estadoCumplimiento(fraccion: number | null): { label: string; tone: StatusTone } {
  if (fraccion === null) return { label: "Sin meta", tone: "neutral" };
  if (fraccion >= 1) return { label: "Cumplida", tone: "positive" };
  if (fraccion >= UMBRAL_RIESGO) return { label: "En riesgo", tone: "warning" };
  return { label: "Baja", tone: "negative" };
}

/** "001 · Edith Saballo" */
export function etiquetaVendedor(codigo: string, nombre: string): string {
  return codigo === nombre ? codigo : `${codigo} · ${nombre}`;
}

/** Días desde la última factura: "hoy", "ayer", "hace 12 días", "hace 3 meses". */
export function haceDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || !Number.isFinite(dias)) return "—";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 60) return `hace ${dias} días`;
  if (dias < 730) return `hace ${Math.floor(dias / 30)} meses`;
  return `hace ${Math.floor(dias / 365)} años`;
}

/** Duración legible: "1 min 05 s", "12 s". */
export function duracion(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}
