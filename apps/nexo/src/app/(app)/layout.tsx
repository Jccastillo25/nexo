import { NexoShell } from "@nexo/ui";
import { getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { nexoNav } from "@/lib/nav";
import { permisosDe } from "@/lib/permisos";
import { exigirPasswordDefinitiva } from "@/lib/perfil";

/**
 * Layout autenticado del panel Nexo — Nexo Enterprise UI (rediseño
 * 2026-09-07). El proxy (src/proxy.ts, @nexo/supabase) ya garantiza que
 * solo se llega hasta acá con sesión válida (redirige a /login si no la
 * hay) — no hace falta un guard de permiso adicional como en RRHH, porque
 * el panel en sí no es un "recurso" con permiso propio: cada pantalla de
 * Configuración valida el suyo.
 *
 * Kernel (2026-10-20): sesionActual y permisosDe quedan en caché del
 * request, así la página los reutiliza sin otra llamada a Auth ni otra
 * consulta de permisos.
 *
 * Sin `backHref`: apps/nexo YA ES el panel, no hay a dónde volver (a
 * diferencia de los módulos, que sí lo pasan).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, settings, permisos] = await Promise.all([
    sesionActual<Database>(),
    getPlatformSettings(),
    permisosDe(),
    exigirPasswordDefinitiva(),
  ]);

  return (
    <NexoShell
      moduleLabel="Nexo"
      moduleHref="/"
      items={nexoNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      settingsHref={permisos.marcaEditar ? "/configuracion/marca" : undefined}
      footerText={settings.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
