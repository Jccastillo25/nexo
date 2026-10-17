// Lectura de los Excel del ERP (docs/plan/14-productos.md §1 y §4.4).
// Funciones puras: reciben las filas ya leídas del .xlsx (read-excel-file)
// y devuelven las filas JSON que espera public.productos_importar.

export type Celda = string | number | boolean | Date | null | undefined | unknown;
export type Hoja = Celda[][];

export interface Nivel {
  nombre: string;
  erp: string | null;
}

export interface FilaImportacion {
  fila: number;
  erp_id: number | null;
  codigo: string;
  nombre: string;
  codigo_barras: string | null;
  es_servicio: boolean;
  inventariable: boolean;
  exento_ventas: boolean;
  exento_compras: boolean;
  descontinuado_ventas: boolean;
  descontinuado_compras: boolean;
  cuenta_ingreso: string | null;
  cuenta_inventario: string | null;
  cuenta_costo: string | null;
  unidad: string | null;
  fecha_ingreso: string | null;
  existencia_minima: number | null;
  existencia_maxima: number | null;
  proveedor: string | null;
  marca: string | null;
  clase: Nivel | null;
  tipo: Nivel | null;
  categoria: Nivel | null;
  descripcion: string | null;
  codigo_sac: string | null;
  centro_costo: string | null;
  centro_costo_unico: boolean;
  lote_por_vencimiento: boolean;
  plazo_vencimiento_dias: number | null;
  margen_dias_vencer: number | null;
  costo_moneda: "NIO" | "USD";
  costo_referencia: number | null;
  notas: string | null;
  peso: number | null;
}

export interface Aviso {
  fila: number;
  codigo: string;
  nombre: string;
  mensaje: string;
}

const norm = (v: Celda) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Texto limpio: espacios simples; "." o vacío = null (así marca el ERP lo vacío). */
export function texto(v: Celda): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" || s === "." ? null : s;
}

/** Número del Excel: acepta 1,020.94, (8,038.67) como negativo y N/A como vacío. */
export function numero(v: Celda): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = texto(v);
  if (!s || /^n\/?a$/i.test(s)) return null;
  const negativo = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[(),\s]/g, ""));
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

const si = (v: Celda) => {
  const s = norm(v);
  return s === "1" || s === "si" || s === "true" || v === true;
};

/** Fecha del Excel: objeto Date o número de serie (días desde 1899-12-30). */
export function fecha(v: Celda): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const n = typeof v === "number" ? v : numero(v);
  if (n && n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
  const s = texto(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** "Construccion (004)" → {Construccion, 004}; "Lisas  (003) (4 Pies)" → {Lisas (4 Pies), 003}. */
export function nivel(v: Celda): Nivel | null {
  const s = texto(v);
  if (!s) return null;
  const codigos = [...s.matchAll(/\(\s*(\d+-?)\s*\)/g)];
  const ultimo = codigos.at(-1);
  const nombre = (ultimo ? s.slice(0, ultimo.index) + s.slice(ultimo.index! + ultimo[0].length) : s).replace(/\s+/g, " ").trim();
  if (!nombre || nombre === ".") return null;
  return { nombre, erp: ultimo ? ultimo[1] : null };
}

type Columna = keyof Pick<
  FilaImportacion,
  | "nombre" | "codigo" | "codigo_barras" | "exento_ventas" | "exento_compras" | "descontinuado_ventas"
  | "descontinuado_compras" | "es_servicio" | "cuenta_ingreso" | "cuenta_inventario" | "cuenta_costo"
  | "unidad" | "fecha_ingreso" | "existencia_minima" | "existencia_maxima" | "proveedor" | "marca" | "descripcion"
  | "codigo_sac" | "centro_costo" | "centro_costo_unico" | "lote_por_vencimiento" | "plazo_vencimiento_dias"
  | "margen_dias_vencer" | "costo_moneda" | "costo_referencia" | "notas" | "peso"
> | "no_inventariable" | "clase" | "tipo" | "categoria" | "erp_id";

// Encabezados de la plantilla del ERP (en orden de prioridad: los más específicos primero).
const ENCABEZADOS: [Columna, (h: string) => boolean][] = [
  ["nombre", (h) => h.startsWith("nombre del producto")],
  ["codigo", (h) => h.startsWith("codigo del producto")],
  ["codigo_barras", (h) => h.startsWith("codigo de barra")],
  ["exento_ventas", (h) => h.startsWith("exento de ventas")],
  ["exento_compras", (h) => h.startsWith("exento de compras")],
  ["descontinuado_compras", (h) => h.startsWith("descontinuado para compras")],
  ["descontinuado_ventas", (h) => h.startsWith("descontinuado")],
  ["es_servicio", (h) => h.startsWith("es servicio")],
  ["no_inventariable", (h) => h.startsWith("no inventariable")],
  ["cuenta_ingreso", (h) => h.startsWith("cuenta de ingresos")],
  ["cuenta_inventario", (h) => h.startsWith("cuenta de inventario")],
  ["cuenta_costo", (h) => h.startsWith("cuenta de costos")],
  ["unidad", (h) => h.startsWith("unidad de medida")],
  ["fecha_ingreso", (h) => h.startsWith("fecha de ingreso")],
  ["existencia_minima", (h) => h.startsWith("existencia minima")],
  ["existencia_maxima", (h) => h.startsWith("existencia maxima")],
  ["proveedor", (h) => h.startsWith("proveedor")],
  ["marca", (h) => h.startsWith("marca")],
  ["clase", (h) => h.startsWith("clase")],
  ["tipo", (h) => h.startsWith("tipo de producto")],
  ["categoria", (h) => h.startsWith("categoria de producto")],
  ["descripcion", (h) => h.startsWith("descripcion")],
  ["codigo_sac", (h) => h.startsWith("codigo sac")],
  ["centro_costo_unico", (h) => h.startsWith("centro de costo unico")],
  ["centro_costo", (h) => h.startsWith("centro de costo")],
  ["lote_por_vencimiento", (h) => h.startsWith("activar lote")],
  ["plazo_vencimiento_dias", (h) => h.startsWith("plazo de vencimiento")],
  ["margen_dias_vencer", (h) => h.startsWith("margen de dias")],
  ["costo_moneda", (h) => h.startsWith("tipo de moneda") && h.includes("costo")],
  ["costo_referencia", (h) => h.startsWith("costo de referencia")],
  ["notas", (h) => h.startsWith("notas")],
  ["peso", (h) => h.startsWith("peso")],
  ["erp_id", (h) => h.includes("producto id")],
];

function mapear(encabezado: Celda[]): Partial<Record<Columna, number>> {
  const mapa: Partial<Record<Columna, number>> = {};
  encabezado.forEach((celda, i) => {
    const h = norm(celda).replace(/^\*+/, "");
    if (!h) return;
    const hit = ENCABEZADOS.find(([col, test]) => mapa[col] === undefined && test(h));
    if (hit) mapa[hit[0]] = i;
  });
  return mapa;
}

export type TipoArchivo = "plantilla" | "consolidado" | "desconocido";

/** Encuentra la fila de encabezados y dice qué archivo es. */
export function detectar(hoja: Hoja): { tipo: TipoArchivo; fila: number } {
  for (let i = 0; i < Math.min(hoja.length, 30); i++) {
    const celdas = hoja[i].map(norm);
    if (celdas.some((c) => c.startsWith("nombre del producto")) && celdas.some((c) => c.startsWith("codigo del producto"))) {
      return { tipo: "plantilla", fila: i };
    }
    if (celdas[0] === "codigo" && celdas[1] === "producto" && celdas.includes("costo")) {
      return { tipo: "consolidado", fila: i };
    }
  }
  return { tipo: "desconocido", fila: -1 };
}

/** Costo real por código desde el "Consolidado de productos". */
export function leerConsolidado(hoja: Hoja, filaEncabezado: number): Map<string, number> {
  const encabezado = hoja[filaEncabezado].map(norm);
  const iCodigo = encabezado.indexOf("codigo");
  const iCosto = encabezado.indexOf("costo");
  const costos = new Map<string, number>();
  for (const fila of hoja.slice(filaEncabezado + 1)) {
    const codigo = texto(fila[iCodigo]);
    const costo = numero(fila[iCosto]);
    if (codigo && costo !== null) costos.set(codigo.toUpperCase(), costo);
  }
  return costos;
}

/** Filas de la plantilla de importación del ERP, limpias y cruzadas con el costo del consolidado. */
export function leerPlantilla(
  hoja: Hoja,
  filaEncabezado: number,
  costos: Map<string, number> | null
): { filas: FilaImportacion[]; avisos: Aviso[] } {
  const m = mapear(hoja[filaEncabezado]);
  const celda = (fila: Celda[], col: Columna) => (m[col] === undefined ? null : fila[m[col]!]);
  const filas: FilaImportacion[] = [];
  const avisos: Aviso[] = [];

  hoja.slice(filaEncabezado + 1).forEach((fila, idx) => {
    const numFila = filaEncabezado + idx + 2; // número de fila del Excel (1-based)
    const codigo = texto(celda(fila, "codigo"));
    const nombre = texto(celda(fila, "nombre"));
    if (!codigo && !nombre) return; // fila vacía
    const aviso = (mensaje: string) => avisos.push({ fila: numFila, codigo: codigo ?? "", nombre: nombre ?? "", mensaje });

    const esServicio = si(celda(fila, "es_servicio"));
    const clase = nivel(celda(fila, "clase"));
    let tipo = nivel(celda(fila, "tipo"));
    let categoria = nivel(celda(fila, "categoria"));
    if (!clase && (tipo || categoria)) {
      aviso("Tiene tipo o categoría pero no clase: se importa sin clasificar.");
      tipo = null;
      categoria = null;
    } else if (!tipo && categoria) {
      aviso("Tiene categoría pero no tipo: se importa solo con la clase.");
      categoria = null;
    }

    const costoPlantilla = numero(celda(fila, "costo_referencia"));
    const costoConsolidado = codigo ? costos?.get(codigo.toUpperCase()) ?? null : null;
    const costo = costoConsolidado ?? costoPlantilla;
    if (costoConsolidado === null && costos) aviso("No está en el consolidado: se usa el costo de la plantilla.");
    if (costo === null || costo <= 1) aviso("Sin costo real (vacío o C$ 1.00).");

    const r: FilaImportacion = {
      fila: numFila,
      erp_id: numero(celda(fila, "erp_id")),
      codigo: codigo ?? "",
      nombre: nombre ?? "",
      codigo_barras: texto(celda(fila, "codigo_barras")),
      es_servicio: esServicio,
      inventariable: !si(celda(fila, "no_inventariable")),
      exento_ventas: si(celda(fila, "exento_ventas")),
      exento_compras: si(celda(fila, "exento_compras")),
      descontinuado_ventas: si(celda(fila, "descontinuado_ventas")),
      descontinuado_compras: si(celda(fila, "descontinuado_compras")),
      cuenta_ingreso: texto(celda(fila, "cuenta_ingreso")),
      cuenta_inventario: texto(celda(fila, "cuenta_inventario")),
      cuenta_costo: texto(celda(fila, "cuenta_costo")),
      unidad: texto(celda(fila, "unidad"))?.toUpperCase() ?? null,
      fecha_ingreso: fecha(celda(fila, "fecha_ingreso")),
      existencia_minima: Math.max(0, numero(celda(fila, "existencia_minima")) ?? 0),
      existencia_maxima: Math.max(0, numero(celda(fila, "existencia_maxima")) ?? 0),
      proveedor: texto(celda(fila, "proveedor")),
      marca: texto(celda(fila, "marca")),
      clase,
      tipo,
      categoria,
      descripcion: texto(celda(fila, "descripcion")),
      codigo_sac: texto(celda(fila, "codigo_sac")),
      centro_costo: texto(celda(fila, "centro_costo")),
      centro_costo_unico: si(celda(fila, "centro_costo_unico")),
      lote_por_vencimiento: si(celda(fila, "lote_por_vencimiento")),
      plazo_vencimiento_dias: numero(celda(fila, "plazo_vencimiento_dias")),
      margen_dias_vencer: numero(celda(fila, "margen_dias_vencer")),
      costo_moneda: costoConsolidado === null && numero(celda(fila, "costo_moneda")) === 2 ? "USD" : "NIO",
      costo_referencia: costo !== null && costo >= 0 ? costo : null,
      notas: texto(celda(fila, "notas")),
      peso: (() => {
        const p = numero(celda(fila, "peso"));
        return p !== null && p >= 0 ? p : null;
      })(),
    };

    // Regla del ERP: un servicio no lleva clasificación, marca, proveedor, cuenta de costos ni existencias.
    if (esServicio) {
      if (r.clase || r.marca || r.proveedor || r.cuenta_costo || r.existencia_minima || r.existencia_maxima) {
        aviso("Es servicio: se quitan clasificación, marca, proveedor, cuenta de costos y existencias.");
      }
      Object.assign(r, { clase: null, tipo: null, categoria: null, marca: null, proveedor: null, cuenta_costo: null, existencia_minima: 0, existencia_maxima: 0, inventariable: false });
    } else if (!r.categoria) {
      aviso("Sin clasificación completa (clase › tipo › categoría).");
    }
    if (r.existencia_maxima && r.existencia_minima && r.existencia_minima > r.existencia_maxima) {
      aviso("Existencia mínima mayor que la máxima: se deja la máxima en 0 (sin tope).");
      r.existencia_maxima = 0;
    }
    filas.push(r);
  });

  if (costos) {
    const enPlantilla = new Set(filas.map((f) => f.codigo.toUpperCase()));
    for (const codigo of costos.keys()) {
      if (!enPlantilla.has(codigo)) avisos.push({ fila: 0, codigo, nombre: "", mensaje: "Está en el consolidado pero no en la plantilla: no se importa." });
    }
  }
  return { filas, avisos };
}

/** Encabezados y orden de la plantilla de importación del ERP (columnas A–AO). */
export const COLUMNAS_ERP = [
  "Nombre del Producto / Servicio *",
  "Código del Producto / Servicio *",
  "Código de barra",
  "Exento de Ventas: Vacío=No. 1=Si.",
  "Exento de Compras: Vacío=No. 1=Si.",
  "Descontinuado: Vacío=No. 1=Si.",
  "Descontinuado Para Compras: Vacío=No. 1=Sí.",
  "Es Servicio: Vacío=No. 1=Si",
  "No Inventariable Vacío=No, 1=Si",
  "Cuenta de Ingresos (Número de la cuenta) *",
  "Cuenta de Inventario (Número de la cuenta) *",
  "Cuenta de costos (Número de la cuenta) *",
  "Unidad de Medida *",
  "Tipo de Moneda: 1=C$. 2=$. *",
  "Fecha de Ingreso (aaaa-mm-dd). *",
  "Margen De Ganancia",
  "Precio de Venta *",
  "Precio Mínimo",
  "Existencia Mínima",
  "Existencia Máxima",
  "Proveedor (Nombre).",
  "Marca (Nombre)",
  "Clase (Nombre)",
  "Tipo de Producto (Nombre)",
  "Categoría de Producto (Nombre)",
  "Descuento Máximo",
  "Descuento Automático",
  "Porcentaje de comisión",
  "Descripción",
  "Código SAC",
  "Centro de costo",
  "Centro de costo único Vacío=No, 1=Si",
  "Activar Lote por fecha de vencimiento: Vacio=No, 1=Si",
  "Plazo de Vencimiento",
  "Margen de días a Vencerse",
  "Tipo de moneda “Costos de referencia” 1=C$ , 2=$",
  "Costo de referencia",
  "Notas",
  "Peso",
  "",
  "***Producto ID (no modificar valor, puede causar cambios no deseados)***",
] as const;

export interface FilaExportada {
  nombre: string;
  codigo: string;
  codigo_barras: string | null;
  exento_ventas: boolean;
  exento_compras: boolean;
  descontinuado_ventas: boolean;
  descontinuado_compras: boolean;
  es_servicio: boolean;
  no_inventariable: boolean;
  cuenta_ingreso: string | null;
  cuenta_inventario: string | null;
  cuenta_costo: string | null;
  unidad: string | null;
  fecha_ingreso: string | null;
  existencia_minima: number;
  existencia_maxima: number;
  proveedor: string | null;
  marca: string | null;
  clase: string | null;
  tipo: string | null;
  categoria: string | null;
  descripcion: string | null;
  codigo_sac: string | null;
  centro_costo: string | null;
  centro_costo_unico: boolean;
  lote_por_vencimiento: boolean;
  plazo_vencimiento_dias: number | null;
  margen_dias_vencer: number | null;
  costo_moneda: "NIO" | "USD" | null;
  costo_referencia: number | null;
  notas: string | null;
  peso: number | null;
  numero_id: number;
  erp_producto_id: number | null;
}

/** Una fila de la plantilla del ERP. Precios, márgenes y descuentos quedan vacíos: son de Listas de precios. */
export function filaErp(p: FilaExportada): (string | number | null)[] {
  const b = (v: boolean) => (v ? 1 : null);
  return [
    p.nombre, p.codigo, p.codigo_barras, b(p.exento_ventas), b(p.exento_compras), b(p.descontinuado_ventas),
    b(p.descontinuado_compras), b(p.es_servicio), b(p.no_inventariable), p.cuenta_ingreso, p.cuenta_inventario,
    p.cuenta_costo, p.unidad, 1, p.fecha_ingreso, null, null, null, p.existencia_minima, p.existencia_maxima,
    p.proveedor, p.marca, p.clase, p.tipo, p.categoria, null, null, null, p.descripcion, p.codigo_sac,
    p.centro_costo, b(p.centro_costo_unico), b(p.lote_por_vencimiento), p.plazo_vencimiento_dias,
    p.margen_dias_vencer, p.costo_moneda === null ? null : p.costo_moneda === "USD" ? 2 : 1, p.costo_referencia,
    p.notas, p.peso, null, p.erp_producto_id,
  ];
}
