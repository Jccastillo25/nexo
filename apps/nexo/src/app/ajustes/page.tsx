import { redirect } from "next/navigation";

/**
 * Nexo Enterprise UI (2026-09-07): la configuración de marca se reubicó a
 * Nexo → Configuración → Marca (/configuracion/marca). Este redirect
 * mantiene compatible cualquier enlace/marcador viejo a /ajustes.
 */
export default function AjustesRedirectPage() {
  redirect("/configuracion/marca");
}
