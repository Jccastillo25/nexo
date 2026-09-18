import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { getCopyrightText } from "@/lib/platform-settings";
import { CRM_NAV_ITEMS } from "@/lib/nav";
import { signOut } from "@/app/login/actions";

/**
 * Guard de modulo (norma v3.0): el middleware (ver
 * lib/supabase/middleware.ts) solo verifica que haya sesion — eso es
 * AUTENTICACION, no AUTORIZACION. Sin este chequeo, cualquier usuario
 * autenticado en el Supabase compartido de nexo-core (incluso de otra
 * empresa, o sin el modulo CRM habilitado) podria ver el shell del CRM con
 * solo escribir la URL. `crm.ver_modulo` es el permiso que el trigger
 * `trg_seed_module_permission` crea solo al registrar el modulo en
 * core.apps — aca es donde se hace cumplir.
 *
 * Nexo Enterprise UI (2026-09-07): NexoShell reemplaza al grid manual +
 * Header + AppSidebar (retirados) — mismo componente compartido que RRHH,
 * cero duplicacion de shell entre modulos (ajuste obligatorio §8).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const canSeeModule = await hasPermission(
    { supabase, companyId: getCompanyId() },
    "crm.ver_modulo"
  );
  if (!canSeeModule) {
    redirect("/sin-acceso");
  }

  const [panelUrl, {
    data: { user },
  }, copyrightText] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
    getCopyrightText(supabase),
  ]);

  return (
    <NexoShell
      moduleLabel="CRM"
      moduleHref="/dashboard"
      items={CRM_NAV_ITEMS}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
      footerText={copyrightText}
    >
      {children}
    </NexoShell>
  );
}
