import Link from "next/link";
import type { Metadata } from "next";
import { getCategoryColor, getCategoryIcon } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { VisibleApp } from "@/lib/supabase/database.types";
import { signOut } from "@/app/login/actions";

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
 * App Launcher de Nexo — decisión vigente (2026-09-17): "/" es
 * EXCLUSIVAMENTE el selector de aplicaciones, sin ningún chrome de módulo.
 * Antes (reconciliación 2026-09-14) esta página vivía dentro de
 * `(app)/page.tsx`, envuelta por `NexoShell` (sidebar + topbar con
 * breadcrumb/buscador/menú de usuario con "Configuración de marca") — eso
 * seguía mostrando, aunque fuera mínimo, un sidebar/topbar/menú de módulo
 * en la propia raíz. Se movió a la raíz de `app/` (fuera del grupo
 * `(app)`) para que NO herede ese layout — el middleware
 * (lib/supabase/middleware.ts) sigue protegiendo esta ruta igual, la
 * sesión no depende de estar dentro de `(app)`. Header propio, mínimo:
 * "Nexo" (texto fijo, sin link — ya estamos en el inicio) + correo +
 * cerrar sesión, sin dropdown, sin buscador, sin enlace a Configuración
 * (esa ruta sigue funcionando, solo que ya no se muestra en el Launcher —
 * ver `(app)/configuracion/marca`, que conserva su propio NexoShell).
 */
export default async function PanelPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [{ data: apps, error }, { data: { user } }] = await Promise.all([
    supabase.rpc("get_visible_apps", { p_company_id: companyId }),
    supabase.auth.getUser(),
  ]);

  const groups = groupByCategory(apps ?? []);

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold tracking-tight text-neutral-900">Nexo</span>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          {user?.email && <span className="hidden sm:inline">{user.email}</span>}
          <form action={signOut}>
            <button type="submit" className="text-neutral-500 hover:text-neutral-900">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Aplicaciones</h1>
          <p className="text-sm text-neutral-500">Elegí una aplicación para continuar.</p>
        </div>

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
      </main>
    </div>
  );
}
