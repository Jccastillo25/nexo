import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import KioskClient, { type ModoKiosco } from "./kiosk-client";
import { leerTokenTerminal } from "./terminal-cookie";

export const metadata: Metadata = {
  title: "Kiosco · RRHH",
};

/**
 * Server Component wrapper — vive fuera del route group (app) a
 * proposito: sin ShellBar/Sidebar, sin el guard de sesion de
 * (app)/layout.tsx (ver proxy.ts, que excluye /kiosco del chequeo de
 * auth). Es una terminal fisica, no una pantalla de admin.
 *
 * De dónde sale el dispositivo (enrolamiento de terminales, 2026-10-17):
 * 1. Con cookie `nexo_terminal`: estado_terminal(token). Con cookie nunca se
 *    usa la env, aunque el token esté revocado.
 * 2. Sin cookie y con NEXO_KIOSKO_ID: modo heredado, sin cambios.
 * 3. Sin cookie y sin env: pantalla "Terminal sin asignar".
 * `?asignar=1` (enlace del panel de Dispositivos) muestra la asignación aunque
 * exista la env, para poder enrolar equipos durante la transición. Con
 * cookie no cambia nada: manda el token.
 * El token no se pasa al componente cliente: solo el modo y el nombre.
 */
export default async function KioscoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = await leerTokenTerminal();
  const forzarAsignacion = (await searchParams).asignar === "1";

  if (token) {
    const { data, error } = await createAnonClient().rpc("estado_terminal", { p_token: token });
    const res = !error && data && typeof data === "object" && !Array.isArray(data) ? data : null;
    const nombre = typeof res?.nombre === "string" ? res.nombre : undefined;
    let modo: ModoKiosco;
    if (!res) {
      // Falla de red/consulta: se muestra el teclado; si el token ya no
      // sirve, la marca responde terminal_no_autorizada y pasa a asignación.
      modo = "pin";
    } else if (res.estado === "asignada") {
      modo = "pin";
    } else if (res.estado === "no_disponible") {
      modo = "no_disponible";
    } else {
      modo = "asignar";
    }
    return <KioskClient modo={modo} kioskoNombre={nombre} />;
  }

  const kioskoId = process.env.NEXO_KIOSKO_ID;
  if (!kioskoId || forzarAsignacion) return <KioskClient modo="asignar" />;

  // Modo heredado (NEXO_KIOSKO_ID). Best-effort: si el schema "rrhh"
  // todavia no esta expuesto en Data API (ver .env.local.example) o el
  // dispositivo no existe, la terminal igual funciona — solo pierde el
  // nombre en el encabezado.
  const supabase = createAnonClient();
  const { data } = await supabase
    .schema("rrhh")
    .from("kiosko_dispositivos")
    .select("nombre")
    .eq("id", kioskoId)
    .maybeSingle();

  return <KioskClient modo="pin" kioskoNombre={data?.nombre} />;
}
