import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { NEXO_NAV_ITEMS } from "@/lib/nav";
import { signOut } from "@/app/login/actions";

/**
 * Layout autenticado del panel Nexo — Nexo Enterprise UI (rediseño
 * 2026-09-07). El middleware (lib/supabase/middleware.ts) ya garantiza que
 * solo se llega hasta acá con sesión válida (redirige a /login si no la
 * hay) — no hace falta un guard de permiso adicional como en RRHH/CRM,
 * porque el panel en sí no es un "recurso" con permiso propio (visibilidad
 * ya está resuelta módulo por módulo dentro del dashboard).
 *
 * Sin `backHref`: apps/nexo YA ES el panel, no hay a dónde volver (a
 * diferencia de RRHH/CRM, que sí lo pasan).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: { user } }, settings] = await Promise.all([
    supabase.auth.getUser(),
    getPlatformSettings(supabase),
  ]);

  return (
    <NexoShell
      moduleLabel="Nexo"
      moduleHref="/"
      items={NEXO_NAV_ITEMS}
      userEmail={user?.email}
      onSignOut={signOut}
      settingsHref="/configuracion/marca"
      footerText={settings.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
