import type { MarcarResult } from "./actions";

type Sender = (pin: string, id: string, confirmar: boolean) => Promise<MarcarResult>;
type Request = { pin: string; id: string; confirmar: boolean };

/** Una digitacion = un UUID. Reintentar/confirmar conserva el envio en memoria.
 * Cancelar y todo resultado definitivo descartan la credencial. Nunca persiste.
 */
export class KioskFlow {
  private request: Request | null = null;
  private flight: Promise<MarcarResult> | null = null;
  private send: Sender;
  private makeId: () => string;
  private last: MarcarResult | null = null;

  constructor(send: Sender, makeId: () => string = () => crypto.randomUUID()) {
    this.send = send;
    this.makeId = makeId;
  }
  get hasPending() { return this.request !== null; }
  get busy() { return this.flight !== null; }

  submit(pin: string): Promise<MarcarResult> {
    if (this.flight) return this.flight;
    if (this.request) return Promise.resolve({ estado: "error", message: "Confirma o cancela el envío pendiente." });
    this.request = { pin, id: this.makeId(), confirmar: false };
    return this.run();
  }
  confirm(): Promise<MarcarResult> {
    if (this.flight) return this.flight;
    if (this.request && this.last?.estado === "confirmacion_requerida") {
      this.request.confirmar = true;
      return this.run();
    }
    return Promise.resolve({ estado: "rechazada", message: "No hay una salida pendiente." });
  }
  retry(): Promise<MarcarResult> {
    if (this.flight) return this.flight;
    if (this.request && this.last?.estado === "error") return this.run();
    return Promise.resolve({ estado: "rechazada", message: "No hay un envío pendiente." });
  }
  cancel() {
    if (this.flight) return false;
    this.clear();
    return true;
  }
  clear() { this.request = null; this.last = null; }
  private run(): Promise<MarcarResult> {
    const request = this.request!;
    this.flight = Promise.resolve().then(() => this.send(request.pin, request.id, request.confirmar))
      .catch((): MarcarResult => ({ estado: "error", message: "Error de conexión. Reintenta el mismo envío." }))
      .then(result => {
        this.last = result;
        if (result.estado === "registrada" || result.estado === "rechazada") this.clear();
        return result;
      }).finally(() => { this.flight = null; });
    return this.flight;
  }
}
