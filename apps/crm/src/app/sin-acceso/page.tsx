import type { Metadata } from "next";
import { BackToPanelLink } from "@nexo/ui";
import { signOut } from "@/app/login/actions";
import { getPanelUrl } from "@/lib/panel";

export const metadata: Metadata = {
  title: "Sin acceso · Panel de clientes",
};

/**
 * Se muestra cuando hay sesion valida pero sin el permiso `crm.ver_modulo`
 * para la empresa actual (ver el guard en app/(app)/layout.tsx). Vive fuera
 * del route group (app) a proposito: si estuviera adentro, el mismo guard
 * que redirige para aca volveria a redirigir, en loop infinito.
 */
export default async function SinAccesoPage() {
  const panelUrl = await getPanelUrl();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
          Materiales J Castillo
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Sin acceso
        </h1>
        <p className="mt-4 text-sm text-neutral-500">
          Tu cuenta no tiene el permiso <code>crm.ver_modulo</code> para esta
          empresa. Si crees que es un error, pedile a un administrador que te
          asigne el módulo CRM.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <BackToPanelLink
            href={panelUrl}
            label="Volver a Nexo"
            className="text-xs uppercase tracking-wide text-neutral-500 transition-colors hover:text-blue-600"
          />
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
