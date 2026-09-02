import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import KioskClient from "./kiosk-client";

export const metadata: Metadata = {
  title: "Kiosco · RRHH",
};

/**
 * Server Component wrapper — vive fuera del route group (app) a
 * proposito: sin ShellBar/Sidebar, sin el guard de sesion de
 * (app)/layout.tsx (ver proxy.ts, que excluye /kiosco del chequeo de
 * auth). Es una terminal fisica, no una pantalla de admin.
 */
export default async function KioscoPage() {
  const kioskoId = process.env.NEXO_KIOSKO_ID;
  let kioskoNombre: string | undefined;

  if (kioskoId) {
    // Best-effort: si el schema "rrhh" todavia no esta expuesto en Data
    // API (ver .env.local.example) o el dispositivo no existe, la
    // terminal igual funciona — solo pierde el nombre en el encabezado.
    const supabase = createAnonClient();
    const { data } = await supabase
      .schema("rrhh")
      .from("kiosko_dispositivos")
      .select("nombre")
      .eq("id", kioskoId)
      .maybeSingle();
    kioskoNombre = data?.nombre;
  }

  return <KioskClient kioskoNombre={kioskoNombre} />;
}
