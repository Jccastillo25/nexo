import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { getCopyrightText } from "@/lib/platform-settings";
import { AGENCIA_NAV_ITEMS } from "@/lib/nav";
import { signOut } from "@/app/login/actions";

// El proxy autentica; el layout y la página autorizan con el motor compartido.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const canSeeModule = await hasPermission({ supabase, companyId }, "agencia.ver_modulo");
  if (!canSeeModule) redirect("/agencia/sin-acceso");

  const [panelUrl, { data: { user } }, copyrightText, canViewDashboard] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
    getCopyrightText(supabase),
    hasPermission({ supabase, companyId }, "agencia.dashboard.resumen.ver"),
  ]);

  return (
    <NexoShell
      moduleLabel="Agencia digital"
      moduleHref={canViewDashboard ? "/dashboard" : undefined}
      items={canViewDashboard ? AGENCIA_NAV_ITEMS : []}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={copyrightText}
    >
      {children}
    </NexoShell>
  );
}
