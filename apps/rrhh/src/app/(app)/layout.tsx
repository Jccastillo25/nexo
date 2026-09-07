import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { NexoShell } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { RRHH_NAV_ITEMS } from "@/lib/nav";
import { signOut } from "./actions";

/**
 * Guard de modulo (norma v3.0): el proxy (ver lib/supabase/middleware.ts)
 * solo verifica que haya sesion — eso es AUTENTICACION, no AUTORIZACION.
 * Sin este chequeo, cualquier usuario autenticado en el Supabase
 * compartido de nexo-core podria ver el shell de RRHH con solo escribir
 * la URL. `rrhh.ver_modulo` es el permiso que el trigger
 * `trg_seed_module_permission` ya creo solo al registrar 'rrhh' en
 * core.apps (verificado en remoto antes de escribir este archivo) — aca
 * es donde se hace cumplir. Mismo patron que apps/crm/src/app/(app)/layout.tsx.
 *
 * Nexo Enterprise UI (2026-09-07): NexoShell reemplaza a AppShell + Header +
 * AppSidebar (retirados) — un solo componente compartido arma el sidebar
 * azul persistente + topbar con breadcrumb automatico a partir de
 * RRHH_NAV_ITEMS.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const canSeeModule = await hasPermission(
    { supabase, companyId: getCompanyId() },
    "rrhh.ver_modulo"
  );
  if (!canSeeModule) {
    redirect("/sin-acceso");
  }

  const [panelUrl, {
    data: { user },
  }] = await Promise.all([getPanelUrl(), supabase.auth.getUser()]);

  return (
    <NexoShell
      moduleLabel="RRHH"
      moduleHref="/dashboard"
      items={RRHH_NAV_ITEMS}
      userEmail={user?.email}
      onSignOut={signOut}
      backHref={panelUrl}
    >
      {children}
    </NexoShell>
  );
}
