import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";

/**
 * Guard de modulo (norma v3.0): el middleware (ver
 * lib/supabase/middleware.ts) solo verifica que haya sesion — eso es
 * AUTENTICACION, no AUTORIZACION. Sin este chequeo, cualquier usuario
 * autenticado en el Supabase compartido de nexo-core (incluso de otra
 * empresa, o sin el modulo CRM habilitado) podria ver el shell del CRM con
 * solo escribir la URL. `crm.ver_modulo` es el permiso que el trigger
 * `trg_seed_module_permission` crea solo al registrar el modulo en
 * core.apps — aca es donde se hace cumplir.
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

  const [panelUrl, { data: { user } }] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-concreto">
      <Header panelUrl={panelUrl} userEmail={user?.email} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
