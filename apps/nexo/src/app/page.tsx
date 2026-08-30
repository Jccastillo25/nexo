import Link from "next/link";
import type { Metadata } from "next";
import { ShellBar, getCategoryColor, getCategoryIcon } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { signOut } from "./login/actions";
import type { VisibleApp } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Nexo",
};

// Agrupa por categoria, preservando el orden de primera aparicion — mismo
// patron visual que la grilla de apps de Odoo (secciones tituladas:
// Finanzas, Ventas, Cadena de suministro...). Ver docs/planning/DISENO_UX_UI.md.
function groupByCategory(apps: VisibleApp[]): [string, VisibleApp[]][] {
  const groups = new Map<string, VisibleApp[]>();
  for (const app of apps) {
    const key = app.category ?? "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(app);
  }
  return Array.from(groups.entries());
}

export default async function PanelPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: apps, error } = await supabase.rpc("get_visible_apps", {
    p_company_id: companyId,
  });

  const groups = groupByCategory(apps ?? []);

  return (
    <div className="flex min-h-full flex-col">
      <ShellBar title="Nexo" userEmail={user?.email} onSignOut={signOut} />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudo cargar la lista de módulos: {error.message}
          </p>
        )}

        {!error && groups.length === 0 && (
          <p className="rounded-md border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
            No tienes ningún módulo habilitado todavía. Esto es DENY BY
            DEFAULT funcionando como se espera — pedile a un owner/admin
            que te agregue una membresía en{" "}
            <code>core.company_memberships</code> o un permiso explícito en{" "}
            <code>core.user_permissions</code>.
          </p>
        )}

        {groups.map(([category, categoryApps]) => (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-400">
              {category}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {categoryApps.map((app) => {
                const color = getCategoryColor(app.category);
                const AppIcon = getCategoryIcon(app.category);
                return (
                  <Link
                    key={app.slug}
                    href={app.route}
                    className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white p-5 text-center transition-shadow hover:shadow-md"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-lg ${color.bg} ${color.text}`}
                    >
                      <AppIcon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-medium">{app.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
