// Lectura del reporte de facturas de AG Negocio para Metas de ventas
// (docs/plan/19-presupuesto.md; reglas del plan 15). El usuario sube el Excel
// tal como sale de AG Negocio, sin depurar: varias hojas (por año, "Dashboard", "compras", "PPTO"...),
// filas de títulos y de totales, encabezados repetidos, fechas en texto,
// montos con símbolo de moneda y facturas repetidas entre hojas.
//
// Funciones puras, sin imports: las usan la pantalla Importar (navegador) y
// apps/presupuesto/scripts/validar-excel.mjs (Node, para revisar un archivo sin tocar
// la base). Devuelven las filas que espera public.presupuesto_importar_facturas.

export type Celda = string | number | boolean | Date | null | undefined;

export interface HojaLeida {
  nombre: string;
  filas: Celda[][];
}

/** Una fila lista para public.presupuesto_importar_facturas. */
export interface FilaFactura {
  fila: number;
  fecha: string;
  vencimiento: string | null;
  numero: string;
  cliente: string | null;
  anulada: boolean;
  total_cs: number;
  total_usd: number;
  vendedor: string;
}

export type TipoAviso =
  | "resumen"
  | "sin_numero"
  | "sin_fecha"
  | "fecha_futura"
  | "sin_vendedor"
  | "sin_total"
  | "anulada_sin_total"
  | "usd_calculado"
  | "cs_calculado"
  | "duplicada_igual"
  | "duplicada_distinta"
  | "vencimiento_invalido";

export interface Aviso {
  tipo: TipoAviso;
  hoja: string;
  fila: number;
  numero: string | null;
  detalle?: string;
}

/** Qué pasa con cada tipo de aviso: si la fila se importa y cómo se le explica al usuario. */
export const AVISOS: Record<TipoAviso, { mensaje: string; seImporta: boolean }> = {
  resumen: { mensaje: "Fila de totales o de resumen: se ignoró.", seImporta: false },
  sin_numero: { mensaje: "Sin número de factura: se ignoró.", seImporta: false },
  sin_fecha: { mensaje: "Fecha vacía o que no se entiende: se ignoró.", seImporta: false },
  fecha_futura: { mensaje: "Fecha posterior al próximo mes: se ignoró.", seImporta: false },
  sin_vendedor: { mensaje: "Sin vendedor: se ignoró.", seImporta: false },
  sin_total: { mensaje: "Sin total en C$ ni en US$: se ignoró.", seImporta: false },
  anulada_sin_total: { mensaje: "Anulada sin total: se guarda en 0 (no suma a ventas).", seImporta: true },
  usd_calculado: { mensaje: "Sin total en US$: se calculó con el tipo de cambio.", seImporta: true },
  cs_calculado: { mensaje: "Sin total en C$: se calculó con el tipo de cambio.", seImporta: true },
  duplicada_igual: { mensaje: "Factura repetida con los mismos datos: se importa una sola vez.", seImporta: false },
  duplicada_distinta: { mensaje: "Factura repetida con datos distintos: se usa la última que aparece.", seImporta: true },
  // Caso real (2026-10-20): factura 52372-A con vencimiento en el año 20233.
  // El vencimiento no cuenta para las metas, así que la venta no se pierde.
  vencimiento_invalido: { mensaje: "Vencimiento imposible (por ejemplo, año 20233): se importa sin vencimiento.", seImporta: true },
};

export interface HojaAnalizada {
  nombre: string;
  reconocida: boolean;
  motivo: string | null;
  filaEncabezado: number | null;
  columnas: Partial<Record<Columna, string>>;
  facturas: number;
}

export interface ResumenAnual {
  anio: number;
  facturas: number;
  anuladas: number;
  total_cs: number;
  total_usd: number;
}

export interface ResumenVendedor {
  vendedor: string;
  facturas: number;
  total_usd: number;
  primera: string;
  ultima: string;
}

export interface Analisis {
  hojas: HojaAnalizada[];
  facturas: FilaFactura[];
  avisos: Aviso[];
  porAnio: ResumenAnual[];
  porVendedor: ResumenVendedor[];
  fechaMin: string | null;
  fechaMax: string | null;
  /** Tipo de cambio C$/US$ implícito en las filas que traen los dos totales (mediana). */
  tipoCambioDetectado: number | null;
}

export interface OpcionesAnalisis {
  /** C$ por US$ para las filas que traen un solo total y ninguna columna de tipo de cambio. */
  tipoCambio: number;
  /** Fecha de hoy (YYYY-MM-DD); se aceptan facturas hasta 31 días después. */
  hoy?: string;
}

// ---------------------------------------------------------------------------
// Limpieza de celdas
// ---------------------------------------------------------------------------

/** Minúsculas, sin acentos ni signos de puntuación sueltos, espacios simples. Conserva "$". */
export function normalizar(v: Celda): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[°º.:#*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto limpio con espacios simples; vacío o "." es null. */
export function texto(v: Celda): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" || s === "." || s === "-" ? null : s;
}

/**
 * Número de una celda: acepta 1,605.00 · C$ 1,605 · US$ 43.82 · (100) como
 * negativo · 1.605,50 (coma decimal) · "-". Devuelve null si no es número.
 */
export function numero(v: Celda): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v instanceof Date) return null;
  let s = texto(v);
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()\s]/g, "").replace(/^-/, "").replace(/^(c\$|us\$|usd|nio|cs|\$)/i, "").replace(/(c\$|us\$|usd|nio|\$)$/i, "");
  const negativoTrasMoneda = s.startsWith("-"); // "C$ -100"
  s = s.replace(/^-/, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  // Coma decimal (1.605,50 o 43,82) si la última separación es una coma con 1-2 decimales.
  if (/,\d{1,2}$/.test(s) && (!s.includes(".") || s.lastIndexOf(",") > s.lastIndexOf("."))) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Punto de miles sin decimales (1.605 o 1.605.000): en montos de AG Negocio no hay 3 decimales.
    s = s.replace(/\./g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (negativo || negativoTrasMoneda ? -n : n) : null;
}

// Años que acepta la base para una fecha de factura (1900–2100). Fuera de ese
// rango es un error de captura: toISOString daría "+020233-08-03".
const anioValido = (y: number) => y >= 1900 && y <= 2100;

const iso = (y: number, m: number, d: number): string | null => {
  if (y < 100) y += 2000;
  if (!anioValido(y)) return null;
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return f.toISOString().slice(0, 10);
};

/**
 * Fecha de una celda (YYYY-MM-DD): objeto Date, número de serie de Excel o
 * texto (2026-09-29, 29/09/2026, 29-09-26, con o sin hora). Día/mes como en
 * Nicaragua.
 */
export function fecha(v: Celda): string | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) || !anioValido(v.getUTCFullYear()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000).toISOString().slice(0, 10);
    return null;
  }
  const s = texto(v);
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]);
  const n = numero(s);
  return n !== null && Number.isInteger(n) ? fecha(n) : null;
}

/** Sí/No de AG Negocio: "Sí", "si", "S", "1", "x", "Anulada", true. */
export function siNo(v: Celda): boolean {
  if (v === true) return true;
  if (typeof v === "number") return v === 1;
  const s = normalizar(v);
  return ["si", "s", "yes", "y", "1", "true", "x", "anulada", "anulado", "anulada si"].includes(s);
}

/**
 * Número de factura como texto, en mayúsculas y sin espacios: 59057 (número)
 * → "59057", " 83460-a " → "83460-A". La RPC identifica la factura por este
 * texto exacto, así que el criterio de mayúsculas es el mismo en las dos capas.
 */
export function numeroFactura(v: Celda): string | null {
  if (typeof v === "number") return String(v);
  const s = texto(v);
  return s ? s.replace(/\s+/g, "").toUpperCase() : null;
}

// "Total", "Totales", "Subtotal 001", "SUBTOTAL001", "Gran total", "Resumen", "Suma".
const PALABRAS_RESUMEN = /^((sub ?)?total(es)?|gran total|resumen|suma)(?![a-z])/;

// ---------------------------------------------------------------------------
// Encabezados
// ---------------------------------------------------------------------------

export type Columna =
  | "fecha"
  | "vencimiento"
  | "numero"
  | "cliente"
  | "anulada"
  | "total_cs"
  | "total_usd"
  | "total"
  | "moneda"
  | "tipo_cambio"
  | "vendedor";

// Orden: los más específicos primero (vencimiento antes que fecha; totales con moneda antes que "total").
const ENCABEZADOS: [Columna, (h: string) => boolean][] = [
  ["vencimiento", (h) => /^(fecha (de )?)?(vencimiento|vence|expiracion)\b/.test(h)],
  ["fecha", (h) => /^fecha( (de )?(factura|facturacion|emision|documento|venta))?$/.test(h)],
  ["numero", (h) =>
    /^(n|no|num|numero|nro)( de)? (factura|fact|documento|doc)$/.test(h)
    || /^(factura|fact|documento) (n|no|num|numero|nro)$/.test(h)
    || /^(factura|numero|documento|no documento|n documento)$/.test(h)],
  ["cliente", (h) => /^(cliente|nombre (del )?cliente|razon social)\b/.test(h)],
  ["anulada", (h) => /^(anulada|anulado|anulacion|estado)$/.test(h)],
  ["total_usd", (h) => /^(total|monto|importe|venta)( neta)? ?(en )?(usd|us\$|u\$s|\$|dolares)$/.test(h)],
  ["total_cs", (h) => /^(total|monto|importe|venta)( neta)? ?(en )?(c\$|cs|cordobas|nio)$/.test(h)],
  ["total", (h) => /^(total|monto|importe|total factura|total neto|venta neta)$/.test(h)],
  ["moneda", (h) => /^moneda$/.test(h)],
  ["tipo_cambio", (h) => /^(tipo de cambio|tasa de cambio|tasa|tc|t\/c)$/.test(h)],
  ["vendedor", (h) => /^(vendedor|vendedora|vendedor\/a|agente|agente de ventas|ejecutivo|ejecutivo de ventas|asesor)$/.test(h)],
];

function mapear(encabezado: Celda[]): { mapa: Partial<Record<Columna, number>>; nombres: Partial<Record<Columna, string>> } {
  const mapa: Partial<Record<Columna, number>> = {};
  const nombres: Partial<Record<Columna, string>> = {};
  encabezado.forEach((celda, i) => {
    const h = normalizar(celda);
    if (!h) return;
    const hit = ENCABEZADOS.find(([col, test]) => mapa[col] === undefined && test(h));
    if (hit) {
      mapa[hit[0]] = i;
      nombres[hit[0]] = String(celda).trim();
    }
  });
  return { mapa, nombres };
}

const tieneTotal = (m: Partial<Record<Columna, number>>) =>
  m.total_cs !== undefined || m.total_usd !== undefined || m.total !== undefined;

const esFacturas = (m: Partial<Record<Columna, number>>) =>
  m.fecha !== undefined && m.numero !== undefined && m.vendedor !== undefined && tieneTotal(m);

const NOMBRES_COLUMNA: Record<Columna, string> = {
  fecha: "Fecha",
  vencimiento: "Vencimiento",
  numero: "N.º de factura",
  cliente: "Cliente",
  anulada: "Anulada",
  total_cs: "Total C$",
  total_usd: "Total US$",
  total: "Total",
  moneda: "Moneda",
  tipo_cambio: "Tipo de cambio",
  vendedor: "Vendedor",
};

/** Busca la fila de encabezados de facturas en las primeras 40 filas de la hoja. */
export function detectarEncabezado(hoja: Celda[][]): {
  fila: number | null;
  mapa: Partial<Record<Columna, number>>;
  nombres: Partial<Record<Columna, string>>;
  motivo: string | null;
} {
  let mejor: { fila: number; mapa: Partial<Record<Columna, number>>; n: number } | null = null;
  let proveedor = false;
  for (let i = 0; i < Math.min(hoja.length, 40); i++) {
    const fila = hoja[i] ?? [];
    if (fila.some((c) => /^proveedor\b/.test(normalizar(c)))) proveedor = true;
    const { mapa, nombres } = mapear(fila);
    if (esFacturas(mapa)) return { fila: i, mapa, nombres, motivo: null };
    const n = Object.keys(mapa).length;
    if (!mejor || n > mejor.n) mejor = { fila: i, mapa, n };
  }
  if (proveedor) return { fila: null, mapa: {}, nombres: {}, motivo: "Parece de compras (tiene Proveedor): no se importa." };
  if (!mejor || mejor.n < 2) return { fila: null, mapa: {}, nombres: {}, motivo: "No tiene una tabla de facturas." };
  const faltan = (["fecha", "numero", "vendedor"] as Columna[]).filter((c) => mejor!.mapa[c] === undefined).map((c) => NOMBRES_COLUMNA[c]);
  if (!tieneTotal(mejor.mapa)) faltan.push("Total");
  return { fila: null, mapa: {}, nombres: {}, motivo: `No tiene una tabla de facturas (faltan: ${faltan.join(", ")}).` };
}

// ---------------------------------------------------------------------------
// Análisis completo
// ---------------------------------------------------------------------------

const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function sumarDias(isoFecha: string, dias: number): string {
  const f = new Date(`${isoFecha}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function analizar(hojas: HojaLeida[], opciones: OpcionesAnalisis): Analisis {
  const hoy = opciones.hoy ?? new Date().toISOString().slice(0, 10);
  const limite = sumarDias(hoy, 31);
  const tcDefecto = opciones.tipoCambio;
  if (!(tcDefecto > 0)) throw new Error("El tipo de cambio debe ser mayor que 0.");

  const avisos: Aviso[] = [];
  const hojasAnalizadas: HojaAnalizada[] = [];
  const porNumero = new Map<string, { f: FilaFactura; hoja: string }>();
  const tcImplicitos: number[] = [];

  for (const hoja of hojas) {
    const det = detectarEncabezado(hoja.filas);
    const info: HojaAnalizada = {
      nombre: hoja.nombre,
      reconocida: det.fila !== null,
      motivo: det.motivo,
      filaEncabezado: det.fila === null ? null : det.fila + 1,
      columnas: det.nombres,
      facturas: 0,
    };
    hojasAnalizadas.push(info);
    if (det.fila === null) continue;

    const m = det.mapa;
    const celda = (fila: Celda[], col: Columna) => (m[col] === undefined ? null : fila[m[col]!]);
    const encabezadoNorm = (hoja.filas[det.fila] ?? []).map(normalizar).join("|");

    for (let i = det.fila + 1; i < hoja.filas.length; i++) {
      const fila = hoja.filas[i] ?? [];
      const numFila = i + 1;
      if (fila.every((c) => texto(c) === null && !(c instanceof Date) && typeof c !== "number")) continue;
      if (fila.map(normalizar).join("|") === encabezadoNorm) continue; // encabezado repetido (reportes paginados)

      const num = numeroFactura(celda(fila, "numero"));
      const aviso = (tipo: TipoAviso, detalle?: string) => avisos.push({ tipo, hoja: hoja.nombre, fila: numFila, numero: num, detalle });

      if (!num) {
        // Totales del reporte: dicen "Total" o solo traen montos.
        const llenas = fila.filter((c) => texto(c) !== null || typeof c === "number");
        const esResumen = fila.some((c) => /\b(total|totales|subtotal|resumen|suma)\b/.test(normalizar(c)))
          || llenas.every((c) => numero(c) !== null);
        aviso(esResumen ? "resumen" : "sin_numero");
        continue;
      }
      // Subtotales con fecha y vendedor ("Total" o "Subtotal 001" en la columna
      // del número, "Total Edith" en la del vendedor): nunca son facturas. La
      // columna Cliente no se mira: un cliente puede llamarse "Totales S.A.".
      if (PALABRAS_RESUMEN.test(normalizar(celda(fila, "numero"))) || PALABRAS_RESUMEN.test(normalizar(celda(fila, "vendedor")))) {
        aviso("resumen");
        continue;
      }
      const f = fecha(celda(fila, "fecha"));
      if (!f) {
        aviso("sin_fecha", texto(celda(fila, "fecha")) ?? undefined);
        continue;
      }
      if (f > limite) {
        aviso("fecha_futura", f);
        continue;
      }
      const vendedor = texto(celda(fila, "vendedor"));
      if (!vendedor) {
        aviso("sin_vendedor");
        continue;
      }

      let cs = numero(celda(fila, "total_cs"));
      let usd = numero(celda(fila, "total_usd"));
      const unico = numero(celda(fila, "total"));
      if (cs === null && usd === null && unico !== null) {
        const moneda = normalizar(celda(fila, "moneda"));
        if (/^(usd|us\$|\$|dolar|dolares|2)$/.test(moneda)) usd = unico;
        else cs = unico;
      }
      // AG Negocio llena con 0 la columna de la otra moneda: una factura en C$
      // trae "Total USD" = 0 (y al revés). Ese 0 no es un monto: se calcula.
      // También con montos negativos (devoluciones), aunque al 20/10/2026 no
      // había ninguno en los datos.
      if (cs !== null && usd !== null) {
        if (usd === 0 && cs !== 0) usd = null;
        else if (cs === 0 && usd !== 0) cs = null;
      }
      const anulada = siNo(celda(fila, "anulada"));
      if (cs === null && usd === null) {
        if (!anulada) {
          aviso("sin_total");
          continue;
        }
        cs = 0;
        usd = 0;
        aviso("anulada_sin_total");
      }
      const tcFila = numero(celda(fila, "tipo_cambio"));
      const tc = tcFila !== null && tcFila > 1 ? tcFila : tcDefecto;
      if (usd === null) {
        usd = cs! / tc;
        aviso("usd_calculado");
      } else if (cs === null) {
        cs = usd * tc;
        aviso("cs_calculado");
      } else if (usd > 0 && cs > 0) {
        tcImplicitos.push(cs / usd);
      }

      const celdaVenc = celda(fila, "vencimiento");
      const vencimiento = fecha(celdaVenc);
      if (vencimiento === null && (celdaVenc instanceof Date || texto(celdaVenc) !== null)) {
        aviso("vencimiento_invalido", celdaVenc instanceof Date ? celdaVenc.toISOString() : texto(celdaVenc) ?? undefined);
      }

      const factura: FilaFactura = {
        fila: numFila,
        fecha: f,
        vencimiento,
        numero: num,
        cliente: texto(celda(fila, "cliente"))?.slice(0, 200) ?? null,
        anulada,
        total_cs: redondear(cs!, 2),
        total_usd: redondear(usd, 4),
        vendedor: vendedor.slice(0, 160),
      };

      const clave = num.toUpperCase();
      const previa = porNumero.get(clave);
      if (previa) {
        const p = previa.f;
        const igual = p.fecha === factura.fecha && p.total_cs === factura.total_cs && p.anulada === factura.anulada
          && normalizar(p.vendedor) === normalizar(factura.vendedor);
        if (igual) {
          aviso("duplicada_igual", `también en ${previa.hoja}, fila ${p.fila}`);
          continue;
        }
        aviso("duplicada_distinta", `reemplaza ${previa.hoja}, fila ${p.fila}`);
      }
      porNumero.set(clave, { f: factura, hoja: hoja.nombre });
    }
  }

  const facturas = [...porNumero.values()].map((x) => x.f).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  for (const h of hojasAnalizadas) h.facturas = [...porNumero.values()].filter((x) => x.hoja === h.nombre).length;

  const anios = new Map<number, ResumenAnual>();
  const vendedores = new Map<string, ResumenVendedor>();
  for (const f of facturas) {
    const anio = +f.fecha.slice(0, 4);
    const a = anios.get(anio) ?? { anio, facturas: 0, anuladas: 0, total_cs: 0, total_usd: 0 };
    if (f.anulada) a.anuladas++;
    else {
      a.facturas++;
      a.total_cs += f.total_cs;
      a.total_usd += f.total_usd;
    }
    anios.set(anio, a);
    if (f.anulada) continue;
    const clave = f.vendedor.replace(/\s+/g, " ").trim();
    const v = vendedores.get(clave) ?? { vendedor: clave, facturas: 0, total_usd: 0, primera: f.fecha, ultima: f.fecha };
    v.facturas++;
    v.total_usd += f.total_usd;
    if (f.fecha < v.primera) v.primera = f.fecha;
    if (f.fecha > v.ultima) v.ultima = f.fecha;
    vendedores.set(clave, v);
  }

  const tcDetectado = mediana(tcImplicitos);
  return {
    hojas: hojasAnalizadas,
    facturas,
    avisos,
    porAnio: [...anios.values()].sort((a, b) => a.anio - b.anio).map((a) => ({ ...a, total_cs: redondear(a.total_cs, 2), total_usd: redondear(a.total_usd, 2) })),
    porVendedor: [...vendedores.values()].sort((a, b) => b.total_usd - a.total_usd).map((v) => ({ ...v, total_usd: redondear(v.total_usd, 2) })),
    fechaMin: facturas[0]?.fecha ?? null,
    fechaMax: facturas.at(-1)?.fecha ?? null,
    tipoCambioDetectado: tcDetectado === null ? null : redondear(tcDetectado, 4),
  };
}

/** Avisos agrupados por tipo, en orden: primero lo que deja filas fuera. */
export function agruparAvisos(avisos: Aviso[]): { tipo: TipoAviso; mensaje: string; seImporta: boolean; lista: Aviso[] }[] {
  const grupos = new Map<TipoAviso, Aviso[]>();
  for (const a of avisos) (grupos.get(a.tipo) ?? grupos.set(a.tipo, []).get(a.tipo)!).push(a);
  return [...grupos.entries()]
    .map(([tipo, lista]) => ({ tipo, ...AVISOS[tipo], lista }))
    .sort((a, b) => Number(a.seImporta) - Number(b.seImporta) || b.lista.length - a.lista.length);
}

/** Parte las facturas en lotes para la RPC (1000 filas ≈ 250 KB y ~1 s en la base). */
export function lotes<T>(filas: T[], tamano = 1000): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano) r.push(filas.slice(i, i + tamano));
  return r;
}

/** Tipo de cambio que usa el Excel de presupuesto 2026 (US$ = C$ × 0.0273043). */
export const TIPO_CAMBIO_POR_DEFECTO = 36.6243;
