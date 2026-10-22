// Análisis del Excel ya leído: lo usan el Web Worker (analizar.worker.ts) y,
// como respaldo, el hilo principal (analizador.ts). Es el mismo cálculo en
// los dos casos (analizar() de lib/metas/importacion, con sus pruebas), así
// que el resultado no cambia por correr en segundo plano.
import { analizar, numeroFactura, type Analisis, type HojaLeida } from "@/lib/metas/importacion";

export interface ResultadoLectura {
  analisis: Analisis;
  /** `${fila}|${NÚMERO}` → hoja de origen, para ubicar cada error en el Excel. */
  origen: Map<string, string>;
}

/** Para cada fila con número de factura de las hojas reconocidas, la hoja de la que sale. */
export function mapaOrigen(hojas: HojaLeida[], analisis: Analisis): Map<string, string> {
  const mapa = new Map<string, string>();
  analisis.hojas.forEach((h, idx) => {
    const hoja = hojas[idx];
    if (!h.reconocida || h.filaEncabezado === null || !hoja || !h.columnas.numero) return;
    const encabezado = hoja.filas[h.filaEncabezado - 1] ?? [];
    const col = encabezado.findIndex((c) => String(c ?? "").trim() === h.columnas.numero);
    if (col < 0) return;
    for (let i = h.filaEncabezado; i < hoja.filas.length; i++) {
      const n = numeroFactura(hoja.filas[i]?.[col]);
      if (n) mapa.set(`${i + 1}|${n.toUpperCase()}`, h.nombre);
    }
  });
  return mapa;
}

/** analizar() + mapaOrigen(): todo lo que la pantalla necesita del archivo. */
export function analizarHojas(hojas: HojaLeida[], tipoCambio: number, hoy: string): ResultadoLectura {
  const analisis = analizar(hojas, { tipoCambio, hoy });
  return { analisis, origen: mapaOrigen(hojas, analisis) };
}

/** Mensaje del hilo principal al worker. Sin `hojas`, el worker usa las últimas que recibió. */
export interface PedidoAnalisis {
  id: number;
  hojas?: HojaLeida[];
  tipoCambio: number;
  hoy: string;
}

/** Respuesta del worker. */
export type RespuestaAnalisis =
  | ({ id: number; ok: true } & ResultadoLectura)
  | { id: number; ok: false; motivo: "sin_hojas" | "error"; mensaje: string };
