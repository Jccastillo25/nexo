import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { getPanelUrl, getPlatformSettings, sesionActual, signOut } from "@nexo/auth";
import { permisosDe } from "@/lib/permisos";
import { AGENCIA_NAV_ITEMS } from "@/lib/nav";

// El proxy autentica; este layout autoriza el módulo con el motor compartido.
// sesionActual y permisosDe quedan en caché del request: la página reutiliza
// los mismos permisos sin otra consulta.
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
      moduleLabel="Agencia digital"
      moduleHref={permisos.dashboard ? "/dashboard" : undefined}
      items={permisos.dashboard ? AGENCIA_NAV_ITEMS : []}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={ajustes.copyrightText}
    >
      {children}
    </NexoShell>
  );
}
