import { headers } from "next/headers";

/**
 * URL absoluta del panel (apps/nexo) para el logo del shell y el cierre de
 * sesión. Mismo patrón que apps/atencion/src/lib/panel.ts.
 */
export async function getPanelUrl(): Promise<string> {
  if (process.env.NEXO_PANEL_URL) return process.env.NEXO_PANEL_URL;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
