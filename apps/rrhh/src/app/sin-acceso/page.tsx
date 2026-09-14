import type { Metadata } from "next";
import { BackToPanelLink } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";
import { getPanelUrl } from "@/lib/panel";
import { getLogoUrl } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Sin acceso · RRHH",
};

/**
 * Se muestra cuando hay sesion valida pero sin el permiso `rrhh.ver_modulo`
 * para la empresa actual (ver el guard en app/(app)/layout.tsx). Vive
 * fuera del route group (app) a proposito: si estuviera adentro, el mismo
 * guard que redirige para aca volveria a redirigir, en loop infinito.
 * Mismo patron que apps/crm/src/app/sin-acceso/page.tsx.
 *
 * Nexo Enterprise UI (2026-09-07): restyle a tema claro — mismo sistema
 * visual en toda la suite (ajuste obligatorio §7).
 * Reconciliacion de navegacion (2026-09-14): "Volver a Nexo" (texto) se
 * reemplaza por el logo, mismo patron que la cabecera de NexoSidebar —
 * decision vigente, "Volver a Nexo" queda eliminado en toda la suite.
 */
export default async function SinAccesoPage() {
  const supabase = await createClient();
  const [panelUrl, logoUrl] = await Promise.all([getPanelUrl(), getLogoUrl(supabase)]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[var(--nexo-enterprise-bg)] px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Materiales J Castillo</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Sin acceso</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Tu cuenta no tiene el permiso <code>rrhh.ver_modulo</code> para
          esta empresa. Si crees que es un error, pedile a un administrador
          que te asigne el modulo RRHH.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <BackToPanelLink href={panelUrl} logoUrl={logoUrl} />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-4 py-2 text-xs uppercase tracking-wide text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
