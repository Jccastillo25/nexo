import type { Metadata } from "next";
import { BackToPanelLink } from "@nexo/ui";
import { signOut } from "@/app/(app)/actions";
import { getPanelUrl } from "@/lib/panel";

export const metadata: Metadata = {
  title: "Sin acceso · RRHH",
};

/**
 * Se muestra cuando hay sesion valida pero sin el permiso `rrhh.ver_modulo`
 * para la empresa actual (ver el guard en app/(app)/layout.tsx). Vive
 * fuera del route group (app) a proposito: si estuviera adentro, el mismo
 * guard que redirige para aca volveria a redirigir, en loop infinito.
 * Mismo patron que apps/crm/src/app/sin-acceso/page.tsx, con los tokens
 * dark/glass de este modulo en vez de la paleta clara de CRM.
 */
export default async function SinAccesoPage() {
  const panelUrl = await getPanelUrl();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--nexo-bg)] px-4 py-16">
      <div className="nexo-glass w-full max-w-sm rounded-2xl p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          Materiales J Castillo
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Sin acceso</h1>
        <p className="mt-4 text-sm text-white/60">
          Tu cuenta no tiene el permiso <code>rrhh.ver_modulo</code> para
          esta empresa. Si crees que es un error, pedile a un administrador
          que te asigne el modulo RRHH.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <BackToPanelLink
            href={panelUrl}
            label="Volver a Nexo"
            className="text-xs uppercase tracking-wide text-white/50 transition-colors hover:text-[var(--nexo-accent-hover)]"
          />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-[var(--nexo-border)] px-4 py-2 text-xs uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
