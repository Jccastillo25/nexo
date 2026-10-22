// Formato de fechas, horas, montos y porcentajes para toda la suite (Nexo
// Enterprise UI v2, 2026-10-20) — reemplaza los formateadores copiados en
// cada app (2 formatos de C$, fechas ISO crudas en pantalla).
//
// Funciones puras, sin Next ni React: sirven en Server Components, en
// componentes cliente y en Nexo Mobile. Mobile (o cualquier codigo que no
// quiera cargar el barril de componentes) importa directo:
//   import { moneda, fechaCorta } from "@nexo/ui/formato";
//
// Reglas:
//   - locale es-NI: "1,234.50" (coma de miles, punto decimal);
//   - fechas y horas SIEMPRE en hora de Managua (America/Managua, UTC−6, sin
//     horario de verano), sin importar la zona del servidor (Vercel corre en
//     UTC) ni la del navegador;
//   - una fecha sin hora ("2026-10-20", columna `date` de Postgres) se toma
//     como ese dia en Managua, nunca se corre al dia anterior;
//   - sin valor (null, undefined, "", NaN) devuelven "—".

const LOCALE = "es-NI";
export const ZONA_HORARIA = "America/Managua";
const SIN_DATO = "—";

export type Moneda = "NIO" | "USD";
export type FechaEntrada = Date | string | number | null | undefined;

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aFecha(valor: FechaEntrada): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  // Nicaragua no usa horario de verano desde 2006: la medianoche de Managua
  // es siempre T00:00-06:00.
  const d =
    typeof valor === "string" && SOLO_FECHA.test(valor)
      ? new Date(`${valor}T00:00:00-06:00`)
      : valor instanceof Date
        ? valor
        : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

const fmtFecha = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});
const fmtHora = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit", timeZone: ZONA_HORARIA });

/** "20/10/2026" (dd/mm/aaaa, dia de Managua). */
export function fechaCorta(valor: FechaEntrada): string {
  const d = aFecha(valor);
  return d ? fmtFecha.format(d) : SIN_DATO;
}

/** "20/10/2026, 9:05 a. m." (hora de Managua). */
export function fechaHora(valor: FechaEntrada): string {
  const d = aFecha(valor);
  return d ? fmtFechaHora.format(d) : SIN_DATO;
}

/** "9:05 a. m." (hora de Managua). */
export function hora(valor: FechaEntrada): string {
  const d = aFecha(valor);
  return d ? fmtHora.format(d) : SIN_DATO;
}

const fmtMonto2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMonto0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const SIMBOLO: Record<Moneda, string> = { NIO: "C$", USD: "US$" };

/**
 * "C$ 1,234.50" / "US$ 1,234.50"; con { decimales: 0 }, "C$ 1,235".
 * Negativos: "-C$ 1,234.50". Acepta el texto numerico de Postgres (numeric).
 */
export function moneda(
  valor: number | string | null | undefined,
  tipo: Moneda = "NIO",
  opciones: { decimales?: 0 | 2 } = {}
): string {
  const n = aNumero(valor);
  if (n === null) return SIN_DATO;
  const fmt = opciones.decimales === 0 ? fmtMonto0 : fmtMonto2;
  const absoluto = fmt.format(Math.abs(n));
  // Un monto que redondea a 0 no lleva signo ("-C$ 0.00" confunde).
  const negativo = n < 0 && absoluto !== fmt.format(0);
  return `${negativo ? "-" : ""}${SIMBOLO[tipo]} ${absoluto}`;
}

const fmtEntero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** "1,234" (redondeado). */
export function entero(valor: number | string | null | undefined): string {
  const n = aNumero(valor);
  return n === null ? SIN_DATO : fmtEntero.format(n);
}

const fmtPorcentaje = new Map<number, Intl.NumberFormat>();

/**
 * Recibe una FRACCION: 0.123 → "12.3%". `decimales` (por defecto 1) es el
 * maximo; los ceros sobrantes no se muestran (0.5 → "50%"). Con
 * { signo: true } antepone "+" a los positivos, para variaciones: "+12.3%".
 */
export function porcentaje(
  fraccion: number | string | null | undefined,
  opciones: { decimales?: number; signo?: boolean } = {}
): string {
  const n = aNumero(fraccion);
  if (n === null) return SIN_DATO;
  const decimales = Math.max(0, Math.min(4, Math.trunc(opciones.decimales ?? 1)));
  let fmt = fmtPorcentaje.get(decimales);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: decimales });
    fmtPorcentaje.set(decimales, fmt);
  }
  const texto = fmt.format(n);
  return opciones.signo && n > 0 && texto !== fmt.format(0) ? `+${texto}` : texto;
}
