import { headers } from "next/headers";

/**
 * URL absoluta del panel (apps/nexo), para el "volver a Nexo" del shell de
 * este modulo (ver docs/DESIGN_SYSTEM.md). Mismo patron que
 * lib/supabase/middleware.ts: por defecto, el origin de la propia
 * request — correcto en produccion porque Multi-Zones sirve todo bajo el
 * mismo dominio publico. NEXO_PANEL_URL es el override para dev local
 * (puertos distintos) o acceso directo al deployment *.vercel.app de
 * este modulo.
 */
export async function getPanelUrl(): Promise<string> {
  if (process.env.NEXO_PANEL_URL) return process.env.NEXO_PANEL_URL;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
