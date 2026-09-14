import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, getCategoryColor, getCategoryIcon } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
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

/**
 * App Launcher de Nexo — reconciliacion de navegacion 2026-09-14 (ver
 * docs/status-log/). Reemplaza al dashboard "Torre de Control"
 * (2026-09-07): decision vigente del usuario, "/" es exclusivamente un
 * selector de aplicaciones, no un dashboard global — responde una sola
 * pregunta ("¿a que aplicacion quiero entrar?"), sin KPIs, actividad ni
 * "pendientes" cruzados entre modulos. Esos widgets (DashboardHero,
 * MetricCard, ActivityFeed) se retiraron de esta pagina, no se llevaron a
 * ningun otro lado — no existe todavia una fuente real de esos datos
 * (regla "cero datos mock"), y aunque existiera, un KPI cruzado no es
 * responsabilidad del Launcher.
 */
export default async function PanelPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const { data: apps, error } = await supabase.rpc("get_visible_apps", { p_company_id: companyId });

  const groups = groupByCategory(apps ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Aplicaciones" description="Elegí una aplicación para continuar." />

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar la lista de módulos: {error.message}
        </p>
      )}

      {!error && groups.length === 0 && (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
          No tenés ningún módulo habilitado todavía. Esto es DENY BY
          DEFAULT funcionando como se espera — pedile a un owner/admin
          que te agregue una membresía en{" "}
          <code>core.company_memberships</code> o un permiso explícito en{" "}
          <code>core.user_permissions</code>.
        </p>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-6">
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
                      <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
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
      )}
    </div>
  );
}
