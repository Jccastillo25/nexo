import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { atencionNav } from "@/lib/nav";
import type { Database } from "@/lib/supabase/database.types";

// El proxy autentica; este layout autoriza el módulo con el motor compartido.
// Una sola etapa: permisos, sesión, URL del panel y marca en paralelo.
// sesionActual y permisosDe quedan en caché del request: la página los
// reutiliza sin otra llamada a Auth ni otra consulta de permisos.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [permisos, { user }, panelUrl, ajustes] = await Promise.all([
    permisosDe(),
    sesionActual<Database>(),
    getPanelUrl(),
    getPlatformSettings(),
  ]);

  if (!permisos.modulo) redirect("/sin-acceso");

  return (
    <NexoShell
      moduleLabel="Atención"
      moduleHref="/dashboard"
      items={atencionNav({
        puedeConfigurar: permisos.puestosGestionar || permisos.pantallasGestionar,
        puedeMisMetricas: permisos.misMetricas,
        puedeReportes: permisos.reportes,
      })}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={ajustes.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
