"use server";

import { headers } from "next/headers";
import { createAnonClient as crearClienteAnonimo } from "@nexo/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { borrarTokenTerminal, guardarTokenTerminal, leerTokenTerminal } from "./terminal-cookie";
import { ACCIONES, RESULTADO_ACCION, esAccion, type Accion } from "./acciones";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
// Marcas (P4c, 2026-10-17): solo cuentan las vistas previas (una por PIN
// digitado) y la clave es la IP, que comparten todas las personas de una
// misma terminal. Con 8 por minuto, 10 personas marcando en el mismo minuto
// quedaban frenadas; el tope sigue el límite D7 de la base (30 vistas previas
// por minuto). Los PINes inválidos siguen frenados en Postgres (8 por minuto).
const MAX_PREVIEWS_PER_WINDOW = 30;
// Confirmaciones (botón) por minuto e IP: cada persona confirma una vez por
// PIN digitado, así que el doble de las vistas previas sobra.
const MAX_COMMITS_PER_WINDOW = 60;
const MIN_INTERVAL_MS = 600; // debounce estricto entre intentos consecutivos

/**
 * Cliente anónimo del kernel (2026-10-20), sin cookies ni sesión: la
 * credencial del kiosco es el token de la terminal + el PIN, validados por
 * RPC security definer ejecutables por `anon`.
 */
function createAnonClient() {
  return crearClienteAnonimo<Database>();
}

/**
 * Freno TEMPRANO de fuerza bruta a nivel de Server Action, por IP —
 * pedido explicitamente ("rate-limiting basico o debounce estricto...
 * antes de que toque la base de datos"). NO es la defensa autoritativa:
 * desde 2026-09-05 esa es el limite persistente en Postgres de
 * rrhh.kiosko_rate_limits (8 PINes invalidos por kiosko en 1 minuto ->
 * bloqueo de 5 minutos), aplicado dentro de rrhh.fn_registrar_marca_kiosko,
 * la función interna a la que llega registrar_marca_terminal
 * (security definer, supabase/migrations/20260905000005_rrhh_public_auth_hardening.sql)
 * con comparación bcrypt. Esta Map vive en memoria de UNA instancia de funcion
 * serverless: se resetea en cada cold start, no se comparte entre
 * instancias, y no protege una llamada RPC directa que se salte esta
 * Server Action por completo — por eso el limite real vive en la base de
 * datos, no aca. Esta Map sigue siendo util como freno rapido por IP
 * (reduce ruido antes de gastar un round-trip a Postgres), no se quita.
 */
const attempts = new Map<
  string,
  { count: number; windowStart: number; lastAttempt: number }
>();

function checkRateLimit(
  key: string,
  max: number = MAX_ATTEMPTS_PER_WINDOW,
  conIntervaloMinimo: boolean = true
): { ok: true } | { ok: false; message: string; rapido?: boolean } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, lastAttempt: now });
    return { ok: true };
  }

  if (conIntervaloMinimo && now - entry.lastAttempt < MIN_INTERVAL_MS) {
    return { ok: false, message: "Muy rápido — espera un segundo.", rapido: true };
  }

  if (entry.count >= max) {
    return { ok: false, message: "Demasiados intentos. Espera un minuto." };
  }

  entry.count += 1;
  entry.lastAttempt = now;
  return { ok: true };
}

async function ipDeLaSolicitud() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export type MotivoRechazo = "sin_acciones" | "revision" | "accion_no_disponible";

export interface MarcarResult {
  estado: "acciones" | "registrada" | "rechazada" | "error" | "terminal_no_autorizada";
  message: string;
  /** Con `acciones`: las marcas válidas ahora, sin repetir. */
  acciones?: Accion[];
  /** Con `registrada`. */
  tipo?: Accion;
  /** Con `registrada`: hora del servidor (ISO). */
  marcadoEn?: string;
  /** Con `rechazada`, cuando la base indica el motivo. */
  motivo?: MotivoRechazo;
}

const MENSAJE_MOTIVO: Record<MotivoRechazo, string> = {
  sin_acciones: "Ya registraste todas tus marcas de hoy.",
  revision: "Tus marcas de hoy necesitan revisión. Avisa a RRHH.",
  accion_no_disponible: "Esa marca ya no está disponible. Digita tu PIN de nuevo.",
};

function esMotivo(value: unknown): value is MotivoRechazo {
  return value === "sin_acciones" || value === "revision" || value === "accion_no_disponible";
}

/**
 * Marca con PIN en dos fases con el mismo `solicitudId` (P4c, 2026-10-17):
 * `accion = null` es la vista previa (devuelve las acciones válidas sin
 * escribir) y `accion` con un tipo registra la marca (el botón es la
 * confirmación). Desde el enrolamiento de terminales (2026-10-17) el
 * dispositivo sale de la cookie `nexo_terminal` (registrar_marca_terminal).
 * Sin cookie no se marca: la pantalla queda en "Terminal sin asignar". El
 * camino heredado por variable de entorno se retiró el 2026-10-20 (N7/H5).
 */
export async function marcarAsistencia(pin: string, solicitudId: string, accion: Accion | null): Promise<MarcarResult> {
  const token = await leerTokenTerminal();
  const rechazado: MarcarResult = { estado: "rechazada", message: "No fue posible registrar la marcación." };
  if (!token) {
    return { estado: "terminal_no_autorizada", message: "Esta terminal no está asignada. Pide un código de asignación." };
  }
  if (typeof pin !== "string" || !/^[0-9]{4}$/.test(pin) ||
      typeof solicitudId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(solicitudId) ||
      !(accion === null || esAccion(accion))) return rechazado;
  // Freno por IP en dos contadores (la clave nunca incluye el token):
  // - vistas previas (una por PIN digitado): tope MAX_PREVIEWS_PER_WINDOW e
  //   intervalo mínimo entre envíos;
  // - confirmaciones (el botón): contador propio, tope más alto y sin
  //   intervalo mínimo, para que llamar directo a la action con `accion` no
  //   sirva para saltarse el freno (revisión 2026-10-17, hallazgo #2).
  const base = "terminal:" + (await ipDeLaSolicitud());
  const rl = accion === null
    ? checkRateLimit("previa:" + base, MAX_PREVIEWS_PER_WINDOW)
    : checkRateLimit("confirma:" + base, MAX_COMMITS_PER_WINDOW, false);
  if (!rl.ok) return { estado: "error", message: rl.message };
  const { data, error } = await createAnonClient().rpc("registrar_marca_terminal", {
    p_token: token, p_pin: pin, p_solicitud_id: solicitudId, p_accion: accion,
  });
  if (error) return { estado: "error", message: "No se pudo confirmar el resultado. Reintenta el mismo envío." };
  if (!data || typeof data !== "object" || Array.isArray(data)) return rechazado;
  if (data.estado === "terminal_no_autorizada") {
    await borrarTokenTerminal();
    return { estado: "terminal_no_autorizada", message: "Esta terminal ya no está autorizada. Pide un código nuevo." };
  }
  if (data.estado === "acciones") {
    const acciones = Array.isArray(data.acciones) ? data.acciones : [];
    // Fallo cerrado: una lista vacía o con un tipo desconocido no muestra botones.
    if (acciones.length === 0 || !acciones.every(esAccion)) return rechazado;
    return { estado: "acciones", message: "", acciones: ACCIONES.filter((a) => acciones.includes(a)) };
  }
  if (data.estado === "registrada" && esAccion(data.tipo)) {
    // Renueva la vigencia de 400 días de la cookie con cada marca: una terminal
    // en uso no pierde su asignación.
    await guardarTokenTerminal(token);
    return {
      estado: "registrada",
      message: RESULTADO_ACCION[data.tipo],
      tipo: data.tipo,
      marcadoEn: typeof data.marcado_en === "string" ? data.marcado_en : undefined,
    };
  }
  if (data.estado === "rechazada" && esMotivo(data.motivo)) {
    return { estado: "rechazada", message: MENSAJE_MOTIVO[data.motivo], motivo: data.motivo };
  }
  return rechazado;
}

export interface CanjeResult {
  estado: "asignada" | "rechazado" | "limitado" | "error";
  /** Nombre del dispositivo, solo con `asignada`. */
  nombre?: string;
}

/**
 * Canjea el código de asignación en esta terminal (sin sesión). Si es
 * válido, guarda el token en la cookie httpOnly y devuelve solo el estado y
 * el nombre del dispositivo: el token nunca viaja al navegador ni se loguea.
 * La respuesta es idéntica para código inexistente, vencido o usado; el
 * límite autoritativo de intentos vive en rrhh.fn_canjear_codigo_terminal.
 */
export async function canjearCodigo(codigo: unknown): Promise<CanjeResult> {
  if (typeof codigo !== "string") return { estado: "rechazado" };
  const limpio = codigo.replace(/[\s-]/g, "");
  if (!/^[0-9]{10}$/.test(limpio)) return { estado: "rechazado" };
  const rl = checkRateLimit("canje:" + (await ipDeLaSolicitud()));
  // El freno corto (doble envío) no es "demasiados intentos": se informa como error para reintentar.
  if (!rl.ok) return { estado: rl.rapido ? "error" : "limitado" };
  const { data, error } = await createAnonClient().rpc("canjear_codigo_terminal", { p_codigo: limpio });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return { estado: "error" };
  if (data.estado === "asignada" && typeof data.token === "string" && typeof data.nombre === "string") {
    await guardarTokenTerminal(data.token);
    return { estado: "asignada", nombre: data.nombre };
  }
  if (data.estado === "limitado") return { estado: "limitado" };
  return { estado: "rechazado" };
}
