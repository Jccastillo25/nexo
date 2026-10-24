import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { flotillaNav } from "@/lib/nav";

// El proxy autentica; este layout autoriza el módulo con el motor compartido.
// sesionActual y permisosDe quedan en caché del request: la página los
// reutiliza sin otra llamada a Auth ni otra consulta de permisos.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [permisos, { user }, panelUrl, ajustes] = await Promise.all([
    permisosDe(),
    sesionActual(),
    getPanelUrl(),
    getPlatformSettings(),
  ]);

  if (!permisos.modulo) redirect("/sin-acceso");

  return (
    <NexoShell
      moduleLabel="Flotilla"
      moduleHref="/dashboard"
      items={flotillaNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={ajustes.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
