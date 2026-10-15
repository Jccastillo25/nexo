import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { getCopyrightText } from "@/lib/platform-settings";
import { atencionNav } from "@/lib/nav";
import { signOut } from "@/app/login/actions";

// El proxy autentica; este layout autoriza el módulo con el motor compartido.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  if (!(await hasPermission(ctx, "atencion.ver_modulo"))) redirect("/sin-acceso");

  const [panelUrl, { data: { user } }, copyrightText, puestos, pantallas, misMetricas, reportes] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
    getCopyrightText(supabase),
    hasPermission(ctx, "atencion.configuracion.puesto.gestionar"),
    hasPermission(ctx, "atencion.configuracion.pantalla.gestionar"),
    hasPermission(ctx, "atencion.reportes.mis_metricas.ver"),
    hasPermission(ctx, "atencion.reportes.turno.ver"),
  ]);

  return (
    <NexoShell
      moduleLabel="Atención"
      moduleHref="/dashboard"
      items={atencionNav({
        puedeConfigurar: puestos || pantallas,
        puedeMisMetricas: misMetricas,
        puedeReportes: reportes,
      })}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={copyrightText}
    >
      {children}
    </NexoShell>
  );
}
