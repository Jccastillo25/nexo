import { redirect } from "next/navigation";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { getCopyrightText } from "@/lib/platform-settings";
import { permisosDe } from "@/lib/permisos";
import { productosNav } from "@/lib/nav";
import { signOut } from "@/app/login/actions";

// El proxy autentica; este layout autoriza el módulo con el motor compartido.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const permisos = await permisosDe(supabase, companyId);

  if (!permisos.modulo || !permisos.ver) redirect("/sin-acceso");

  const [panelUrl, { data: { user } }, copyrightText] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
    getCopyrightText(supabase),
  ]);

  return (
    <NexoShell
      moduleLabel="Productos"
      moduleHref={permisos.dashboard ? "/dashboard" : "/catalogo"}
      items={productosNav(permisos)}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={copyrightText}
    >
      {children}
    </NexoShell>
  );
}
