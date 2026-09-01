import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { Footer } from "@nexo/ui";
import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPanelUrl } from "@/lib/panel";
import { getCopyrightText } from "@/lib/platform-settings";

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

  const [panelUrl, { data: { user } }, copyrightText] = await Promise.all([
    getPanelUrl(),
    supabase.auth.getUser(),
    getCopyrightText(supabase),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-100">
      <Header panelUrl={panelUrl} userEmail={user?.email} />
      {/* Sidebar es un dock flotante (position: fixed), no ocupa espacio en
          el flujo — este pl-24 le deja el margen para que el contenido no
          quede tapado por el dock colapsado (w-16 + left-4). El item activo
          lo calcula AppSidebar (Client Component, usePathname). */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 pl-24 sm:px-6 sm:pl-28">
        <AppSidebar />
        {children}
      </main>
      <Footer text={copyrightText} />
    </div>
  );
}
