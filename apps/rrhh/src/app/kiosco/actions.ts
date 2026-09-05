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
 * junto con el bloqueo a 3 fallos consecutivos por empleado + comparacion
 * bcrypt. Esta Map vive en memoria de UNA instancia de funcion
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
  ok: boolean;
  message: string;
  tipo?: "entrada" | "salida";
}

/**
 * Recibe el PIN del NumPad, inyecta el kiosko_id (NUNCA lo manda el
 * cliente — sale de la variable de entorno de este deployment, ver
 * .env.local.example) y llama al RPC anon-callable
 * public.registrar_marca_kiosko. Sin sesion de Supabase Auth a proposito
 * (createAnonClient) — ver el comentario en lib/supabase/server.ts.
 */
export async function marcarAsistencia(pin: string): Promise<MarcarResult> {
  const kioskoId = process.env.NEXO_KIOSKO_ID;
  if (!kioskoId) {
    return {
      ok: false,
      message: "Kiosko no configurado (falta NEXO_KIOSKO_ID en este deployment).",
    };
  }

  if (!/^[0-9]{4}$/.test(pin)) {
    return { ok: false, message: "PIN inválido." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const rl = checkRateLimit(`${kioskoId}:${ip}`);
  if (!rl.ok) {
    return { ok: false, message: rl.message };
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("registrar_marca_kiosko", {
    p_pin: pin,
    p_kiosko_id: kioskoId,
  });

  if (error) {
    // Mensaje generico a proposito — mismo criterio anti-enumeracion que
    // rrhh.fn_validar_acceso_operativo: no revelar si el PIN es
    // incorrecto, el empleado no existe, o el kiosko esta inactivo.
    return { ok: false, message: "PIN incorrecto o kiosko inactivo." };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, message: "No se pudo registrar la marca." };
  }

  return {
    ok: true,
    // A proposito: sin empleadoNombre. rrhh.fn_registrar_marca_kiosko ya
    // no devuelve datos personales del empleado (2026-09-05, regla
    // obligatoria del kiosko anonimo) — el feedback en pantalla es solo
    // el tipo de marca, nunca la identidad de quien marco.
    message: row.tipo === "entrada" ? "Entrada registrada" : "Salida registrada",
    tipo: row.tipo as "entrada" | "salida",
  };
}
