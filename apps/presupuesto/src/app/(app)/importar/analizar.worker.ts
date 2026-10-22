// Web Worker del importador: analiza el Excel de AG Negocio fuera del hilo
// principal. Con el archivo completo (~47 000 facturas) el análisis tarda unos
// 2 s; en el hilo principal congelaba la pantalla, aquí no.
//
// Guarda las últimas hojas recibidas: "Recalcular" con otro tipo de cambio
// solo manda el número, no vuelve a copiar todo el libro.
//
// Tipos del DOM a propósito (no la lib "webworker", que choca con "dom" en el
// mismo proyecto): addEventListener y postMessage existen igual en un worker.
import type { HojaLeida } from "@/lib/metas/importacion";
import { analizarHojas, type PedidoAnalisis, type RespuestaAnalisis } from "./lectura";

let hojas: HojaLeida[] | null = null;

addEventListener("message", (evento: MessageEvent<PedidoAnalisis>) => {
  const { id, tipoCambio, hoy } = evento.data;
  if (evento.data.hojas) hojas = evento.data.hojas;

  let respuesta: RespuestaAnalisis;
  if (!hojas) {
    respuesta = { id, ok: false, motivo: "sin_hojas", mensaje: "El análisis no tiene el archivo." };
  } else {
    try {
      respuesta = { id, ok: true, ...analizarHojas(hojas, tipoCambio, hoy) };
    } catch (err) {
      respuesta = { id, ok: false, motivo: "error", mensaje: err instanceof Error ? err.message : String(err) };
    }
  }
  postMessage(respuesta);
});
