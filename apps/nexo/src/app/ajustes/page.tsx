import type { Metadata } from "next";
import { ShellBar } from "@nexo/ui";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getPlatformSettings } from "@/lib/platform-settings";
import { signOut } from "@/app/login/actions";
import AjustesForm from "./AjustesForm";

export const metadata: Metadata = {
  title: "Ajustes de marca · Nexo",
};

/**
 * Editor de core.platform_settings (logo, imagen de fondo del login,
 * textos, bullets, copyright de toda la plataforma) — pedido explicito del
 * usuario: "el login tiene que ser completamente editable". Guardado por
 * permiso "nexo.configuracion.editar" (norma v3.0) — ver
 * supabase/migrations/20260830000011_platform_settings.sql.
 */
export default async function AjustesPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canEdit, { data: userData }, settings] = await Promise.all([
    hasPermission({ supabase, companyId }, "nexo.configuracion.editar"),
    supabase.auth.getUser(),
    getPlatformSettings(supabase),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-100">
      <ShellBar
        title="Ajustes"
        titleHref="/"
        userEmail={userData.user?.email}
        onSignOut={signOut}
        showSearch={false}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Configuración de marca
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Logo, imagen de fondo, textos y bullets del login, y el
            copyright que se muestra en toda la plataforma.
          </p>
        </div>

        {canEdit ? (
          <AjustesForm initial={settings} />
        ) : (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
            Tu cuenta no tiene el permiso <code>nexo.configuracion.editar</code>{" "}
            para esta empresa.
          </p>
        )}
      </main>
    </div>
  );
}
