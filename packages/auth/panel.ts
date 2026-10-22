import { headers } from "next/headers";

/**
 * URL absoluta del panel (apps/nexo): logo del shell ("volver a Nexo") y
 * destino del cierre de sesión. Por defecto, el origen de la propia petición,
 * correcto en producción porque Multi-Zones sirve todo bajo el mismo dominio
 * público. NEXO_PANEL_URL es el override para desarrollo local (puertos
 * distintos) o para entrar directo al *.vercel.app de un módulo.
 */
export async function getPanelUrl(): Promise<string> {
  if (process.env.NEXO_PANEL_URL) return process.env.NEXO_PANEL_URL;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
