// Analizador del Excel para la pantalla Importar (solo navegador). Usa el Web
// Worker (analizar.worker.ts) para no congelar la pantalla; si el navegador no
// puede crearlo, el worker falla al cargar o no responde en TIEMPO_MAXIMO_MS,
// hace el mismo cálculo en el hilo principal, como antes. Así el importador
// nunca queda sin funcionar.
import type { HojaLeida } from "@/lib/metas/importacion";
import { analizarHojas, type PedidoAnalisis, type RespuestaAnalisis, type ResultadoLectura } from "./lectura";

/**
 * Tiempo máximo de espera de una respuesta del worker. El Excel completo se
 * analiza en ~2 s; si en 60 s no respondió (worker colgado), se termina y el
 * análisis pasa al hilo principal, como cuando el worker no se puede crear.
 */
const TIEMPO_MAXIMO_MS = 60_000;

export interface Analizador {
  /**
   * Analiza `hojas` con el tipo de cambio dado. Si el worker ya tiene esas
   * mismas hojas (mismo arreglo), solo manda el tipo de cambio. Rechaza solo
   * si el propio análisis falla (el mismo error que daría analizar()).
   */
  analizar(hojas: HojaLeida[], tipoCambio: number, hoy: string): Promise<ResultadoLectura>;
  /** Termina el worker (al salir de la pantalla). */
  terminar(): void;
}

export function crearAnalizador(): Analizador {
  // undefined: todavía no se intentó crear; null: no disponible (se usa el respaldo).
  let worker: Worker | null | undefined;
  let hojasEnWorker: HojaLeida[] | null = null;
  let ultimoId = 0;
  const pendientes = new Map<number, (r: RespuestaAnalisis | null) => void>();

  /** Cierra el worker actual. `fallo`: no se vuelve a intentar (todo pasa al respaldo). */
  function cerrar(fallo: boolean) {
    worker?.terminate();
    worker = fallo ? null : undefined;
    hojasEnWorker = null;
    for (const resolver of pendientes.values()) resolver(null);
    pendientes.clear();
  }
  const descartar = () => cerrar(true);

  function obtenerWorker(): Worker | null {
    if (worker !== undefined) return worker;
    try {
      const w = new Worker(new URL("./analizar.worker.ts", import.meta.url));
      w.addEventListener("message", (evento: MessageEvent<RespuestaAnalisis>) => {
        const resolver = pendientes.get(evento.data.id);
        if (!resolver) return;
        pendientes.delete(evento.data.id);
        resolver(evento.data);
      });
      // No se pudo cargar el script del worker, o la respuesta no se pudo leer: respaldo.
      w.addEventListener("error", (evento) => {
        evento.preventDefault();
        console.error("importar: el worker de análisis falló; se analiza en el hilo principal", evento.message);
        descartar();
      });
      w.addEventListener("messageerror", () => descartar());
      worker = w;
    } catch (err) {
      console.error("importar: no se pudo crear el worker de análisis", err);
      worker = null;
    }
    return worker;
  }

  async function analizar(hojas: HojaLeida[], tipoCambio: number, hoy: string): Promise<ResultadoLectura> {
    const w = obtenerWorker();
    if (w) {
      const id = ++ultimoId;
      const respuesta = await new Promise<RespuestaAnalisis | null>((resolver) => {
        const limite = setTimeout(() => {
          if (!pendientes.has(id)) return;
          console.error("importar: el worker de análisis no respondió a tiempo; se analiza en el hilo principal");
          // Termina el worker y resuelve con null todo lo pendiente (este pedido incluido).
          descartar();
        }, TIEMPO_MAXIMO_MS);
        pendientes.set(id, (r) => {
          clearTimeout(limite);
          resolver(r);
        });
        const pedido: PedidoAnalisis = { id, tipoCambio, hoy, hojas: hojasEnWorker === hojas ? undefined : hojas };
        try {
          w.postMessage(pedido);
          hojasEnWorker = hojas;
        } catch (err) {
          console.error("importar: no se pudo enviar el archivo al worker", err);
          pendientes.delete(id);
          clearTimeout(limite);
          resolver(null);
        }
      });
      if (respuesta?.ok) return { analisis: respuesta.analisis, origen: respuesta.origen };
      if (respuesta && respuesta.motivo === "error") throw new Error(respuesta.mensaje);
      // Worker caído o sin las hojas: se calcula aquí abajo.
    }
    // Respaldo en el hilo principal: deja pintar el estado "Leyendo…" antes (síncrono, ~2 s con el Excel completo).
    await new Promise((r) => setTimeout(r, 0));
    return analizarHojas(hojas, tipoCambio, hoy);
  }

  return { analizar, terminar: () => cerrar(false) };
}
