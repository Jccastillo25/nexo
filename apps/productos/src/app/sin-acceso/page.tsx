import type { Metadata } from "next";
import { BackToPanelLink } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { getPanelUrl } from "@/lib/panel";
import { getLogoUrl } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Sin acceso · Productos",
};

/** Sesión válida sin `productos.ver_modulo`. Fuera de (app) para no entrar en loop con su guard. */
export default async function SinAccesoPage() {
  const supabase = await createClient();
  const [panelUrl, logoUrl] = await Promise.all([getPanelUrl(), getLogoUrl(supabase)]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Sin acceso</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Tu rol no incluye la aplicación Productos. Pedile a un administrador que la agregue a tu rol en
          Configuración → Roles.
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
