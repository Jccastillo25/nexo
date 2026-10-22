import type { Metadata } from "next";
import { createAnonClient } from "@nexo/supabase";
import type { Database } from "@/lib/supabase/database.types";
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
 * 1. Con cookie `nexo_terminal`: estado_terminal(token).
 * 2. Sin cookie: pantalla "Terminal sin asignar", que canjea el código de
 *    asignación generado en Asistencia → Configuración → Dispositivos.
 * El modo heredado por variable de entorno (un dispositivo fijo por
 * despliegue) se retiró el 2026-10-20 (N7/H5 de la revisión integral): esa
 * variable no existía en el proyecto de Vercel y a la RPC que usaba se le
 * revoca el acceso público. El enlace viejo `?asignar=1` se ignora.
 * El token no se pasa al componente cliente: solo el modo y el nombre.
 *
 * Kernel (2026-10-20): cliente anónimo de @nexo/supabase, sin cookies ni
 * sesión (no arrastra la de un administrador que tenga el navegador
 * abierto). Las RPC del kiosco son ejecutables por `anon` a propósito.
 */
export default async function KioscoPage() {
  const token = await leerTokenTerminal();
  if (!token) return <KioskClient modo="asignar" />;

  const { data, error } = await createAnonClient<Database>().rpc("estado_terminal", { p_token: token });
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
