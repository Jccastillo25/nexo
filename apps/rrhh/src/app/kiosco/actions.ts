"use server";

import { headers } from "next/headers";
import { createAnonClient } from "@/lib/supabase/server";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const MIN_INTERVAL_MS = 600; // debounce estricto entre intentos consecutivos

/**
 * Freno TEMPRANO de fuerza bruta a nivel de Server Action, por IP —
 * pedido explicitamente ("rate-limiting basico o debounce estricto...
 * antes de que toque la base de datos"). NO es la defensa autoritativa:
 * desde 2026-09-05 esa es el limite persistente en Postgres de
 * rrhh.kiosko_rate_limits (8 PINes invalidos por kiosko en 1 minuto ->
 * bloqueo de 5 minutos), aplicado dentro de rrhh.fn_registrar_marca_kiosko
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

function checkRateLimit(key: string): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, lastAttempt: now });
    return { ok: true };
  }

  if (now - entry.lastAttempt < MIN_INTERVAL_MS) {
    return { ok: false, message: "Muy rápido — esperá un segundo." };
  }

  if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { ok: false, message: "Demasiados intentos. Esperá un minuto." };
  }

  entry.count += 1;
  entry.lastAttempt = now;
  return { ok: true };
}

export interface MarcarResult {
  estado: "registrada" | "confirmacion_requerida" | "rechazada" | "error";
  message: string;
  tipo?: "entrada" | "salida";
}

export async function marcarAsistencia(pin: string, solicitudId: string, confirmarSalida: boolean): Promise<MarcarResult> {
  const kioskoId = process.env.NEXO_KIOSKO_ID;
  const rechazado: MarcarResult = { estado: "rechazada", message: "No fue posible registrar la marcación." };
  if (!kioskoId || typeof pin !== "string" || !/^[0-9]{4}$/.test(pin) ||
      typeof solicitudId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(solicitudId) ||
      typeof confirmarSalida !== "boolean") return rechazado;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const rl = checkRateLimit(kioskoId + ":" + ip);
  if (!rl.ok) return { estado: "error", message: rl.message };
  const { data, error } = await createAnonClient().rpc("registrar_marca_kiosko", {
    p_pin: pin, p_kiosko_id: kioskoId, p_solicitud_id: solicitudId, p_confirmar_salida: confirmarSalida,
  });
  if (error) return { estado: "error", message: "No se pudo confirmar el resultado. Reintenta el mismo envío." };
  if (!data || typeof data !== "object" || Array.isArray(data)) return rechazado;
  if (data.estado === "confirmacion_requerida") return { estado: "confirmacion_requerida", message: "¿Registrar salida?" };
  if (data.estado === "registrada" && (data.tipo === "entrada" || data.tipo === "salida")) {
    return { estado: "registrada", message: data.tipo === "entrada" ? "Entrada registrada" : "Salida registrada", tipo: data.tipo };
  }
  return rechazado;
}
