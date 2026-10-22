/**
 * Formato de montos, tarifas, días y parámetros de Planilla. Módulo PURO:
 * sirve en Server Components, Server Actions, Route Handlers y componentes
 * cliente. Complementa `@nexo/ui/formato` (moneda, fechaCorta, fechaHora,
 * porcentaje): las fechas y los montos de 2 decimales se formatean allí.
 *
 * Regla: los montos que se muestran son los de la RPC. Aquí solo se
 * presentan; las únicas sumas permitidas son las de presentación
 * (`sumarMontos`, en centavos enteros) y las conversiones de entrada
 * (`aFraccion`). Ningún cálculo de planilla vive en la vista.
 */
import { moneda } from "@nexo/ui/formato";
import { nombreMes } from "./periodos";
import type { UnidadLinea, UnidadParametro } from "./tipos";

const LOCALE = "es-NI";
const SIN_DATO = "—";

type Numero = number | string | null | undefined;

/** Número o texto numérico de Postgres → número finito, o null. */
export function num(valor: Numero): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

const formatos = new Map<string, Intl.NumberFormat>();

function formato(min: number, max: number): Intl.NumberFormat {
  const clave = `${min}-${max}`;
  let f = formatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });
    formatos.set(clave, f);
  }
  return f;
}

function conSigno(n: number, texto: string, f: Intl.NumberFormat): string {
  // Un valor que redondea a 0 no lleva signo ("-0.00" confunde).
  return n < 0 && texto !== f.format(0) ? `-${texto}` : texto;
}

/**
 * Tarifa o base con 2 a 4 decimales, para salarios diarios y bases de
 * cálculo: 378.3333 → "C$ 378.3333"; 11350 → "C$ 11,350.00".
 */
export function tarifa(valor: Numero): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  const f = formato(2, 4);
  const absoluto = f.format(Math.abs(n));
  return n < 0 && absoluto !== f.format(0) ? `-C$ ${absoluto}` : `C$ ${absoluto}`;
}

/** Número con hasta `max` decimales (sin ceros sobrantes): decimal(2.5) → "2.5"; decimal(1234) → "1,234". */
export function decimal(valor: Numero, max = 2): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  const f = formato(0, Math.max(0, Math.min(6, Math.trunc(max))));
  return conSigno(n, f.format(Math.abs(n)), f);
}

/** Días con hasta 2 decimales: "1 día", "2.5 días", "-1.5 días". */
export function diasTexto(valor: Numero, max = 2): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  return `${decimal(n, max)} ${Math.abs(n) === 1 ? "día" : "días"}`;
}

/** Horas con hasta 2 decimales: "1 hora", "3.5 horas". */
export function horasTexto(valor: Numero, max = 2): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  return `${decimal(n, max)} ${Math.abs(n) === 1 ? "hora" : "horas"}`;
}

/**
 * Cantidad de una línea con su unidad: días, horas, monto (C$) o número.
 * Sin cantidad → "—".
 */
export function cantidadConUnidad(cantidad: Numero, unidad: UnidadLinea | string | null | undefined): string {
  const n = num(cantidad);
  if (n === null) return SIN_DATO;
  if (unidad === "dias") return diasTexto(n, 4);
  if (unidad === "horas") return horasTexto(n);
  if (unidad === "monto") return moneda(n);
  return decimal(n, 4);
}

/** Diferencia con signo: "+C$ 120.00", "-C$ 80.50", "C$ 0.00". */
export function montoConSigno(valor: Numero): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  const texto = moneda(n);
  return n > 0 && texto !== moneda(0) ? `+${texto}` : texto;
}

/**
 * Fracción como porcentaje con decimales fijos (para tasas de ley):
 * 0.215 → "21.50 %", 0.1 → "10.00 %". Para KPIs y variaciones, usa
 * `porcentaje()` de @nexo/ui.
 */
export function porcentajeExacto(fraccion: Numero, decimales = 2): string {
  const n = num(fraccion);
  if (n === null) return SIN_DATO;
  const d = Math.max(0, Math.min(4, Math.trunc(decimales)));
  const f = formato(d, Math.max(d, 4));
  return `${conSigno(n, f.format(Math.abs(n * 100)), f)} %`;
}

/**
 * Valor de un parámetro de ley según su unidad: porcentaje "21.50 %", monto
 * en C$, número tal cual; `aguinaldo_mes_inicio` como nombre de mes.
 */
export function valorParametro(valor: Numero, unidad: UnidadParametro | string, codigo?: string): string {
  const n = num(valor);
  if (n === null) return SIN_DATO;
  if (codigo === "aguinaldo_mes_inicio" && Number.isInteger(n) && n >= 1 && n <= 12) return nombreMes(n, true);
  if (unidad === "porcentaje") return porcentajeExacto(n);
  if (unidad === "monto") return moneda(n);
  return decimal(n, 4);
}

function aCentavos(valor: Numero): number | null {
  if (typeof valor === "string") {
    // Texto de un numeric: se convierte sin pasar por coma flotante.
    const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(valor.trim());
    if (m) {
      const decimales = (m[3] ?? "").padEnd(3, "0");
      let centavos = Number(m[2]) * 100 + Number(decimales.slice(0, 2));
      if (Number(decimales[2]) >= 5) centavos += 1;
      return m[1] ? -centavos : centavos;
    }
  }
  const n = num(valor);
  return n === null ? null : Math.round(n * 100);
}

/**
 * Suma de presentación de montos ya calculados por la RPC, en centavos
 * enteros (evita 0.1 + 0.2). Los valores vacíos o no numéricos se ignoran.
 * Lista vacía → 0: la vista decide si muestra "—" (p. ej. mes sin planillas).
 */
export function sumarMontos(valores: Iterable<Numero>): number {
  let total = 0;
  for (const v of valores) {
    const c = aCentavos(v);
    if (c !== null) total += c;
  }
  return total / 100;
}

/** Suma de cantidades (días, horas) con `dec` decimales exactos. */
export function sumarCantidades(valores: Iterable<Numero>, dec = 4): number {
  const escala = 10 ** Math.max(0, Math.min(6, Math.trunc(dec)));
  let total = 0;
  for (const v of valores) {
    const n = num(v);
    if (n !== null) total += Math.round(n * escala);
  }
  return total / escala;
}

/**
 * Variación relativa (fracción) para comparar con el período anterior:
 * (actual − anterior) / anterior. Null si falta un valor o si el anterior
 * es 0 o negativo (no hay base de comparación).
 */
export function variacion(actual: Numero, anterior: Numero): number | null {
  const a = num(actual);
  const b = num(anterior);
  if (a === null || b === null || b <= 0) return null;
  return (a - b) / b;
}

/** Entrada en % (0 a 100) → fracción que espera la RPC: 21.5 → 0.215. */
export function aFraccion(pct: number): number {
  return Number((pct / 100).toFixed(6));
}

/** Fracción de la base → % para precargar un formulario: 0.215 → 21.5. */
export function aPorcentaje(fraccion: Numero): number | null {
  const n = num(fraccion);
  return n === null ? null : Number((n * 100).toFixed(4));
}
