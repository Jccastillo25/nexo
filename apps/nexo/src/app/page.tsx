import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@nexo/permissions";
import { AppTileIcon } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { VisibleApp } from "@/lib/supabase/database.types";
import { signOut } from "@/app/login/actions";
import { exigirPasswordDefinitiva } from "@/lib/perfil";

export const metadata: Metadata = {
  title: "Nexo",
};

// Grilla plana de iconos al estilo de la pantalla de inicio de Odoo (pedido
// del usuario 2026-10-17, con captura): sin secciones por categoría, un
// mosaico blanco con el icono a color de la app y el nombre debajo.
const tileClass =
  "flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08),0_6px_16px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_6px_rgba(15,23,42,0.1),0_14px_24px_-8px_rgba(15,23,42,0.25)]";
const itemClass =
  "group flex w-[104px] flex-col items-center gap-2 rounded-xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function AppTile({ app }: { app: VisibleApp }) {
  // Cambio de zona: <a> plano para cargar la aplicación completa, sin prefetch
  // ni navegación cliente con los recursos de Nexo (Multi-Zones).
  return (
    <a href={app.route} className={itemClass}>
      <span className={tileClass}>
        <AppTileIcon icon={app.icon} category={app.category} className="h-12 w-12" />
      </span>
      <span className="text-[13px] leading-tight text-neutral-700">{app.name}</span>
    </a>
  );
}

// Tarjeta "Configuración" del Launcher (decisión del usuario 2026-10-14:
// "tiene que existir en el dashboard", al estilo de Ajustes en Odoo). Lleva
// a la primera pantalla de Configuración que el usuario puede ver; sin
// ningún permiso de administración, la tarjeta no aparece. Mostrarla no
// autoriza nada: cada pantalla valida su propio permiso en el servidor.
const DESTINOS_CONFIGURACION = [
  { code: "nexo.administracion.usuarios.ver", href: "/configuracion/usuarios" },
  { code: "nexo.administracion.roles.ver", href: "/configuracion/roles" },
  { code: "nexo.administracion.sucursales.ver", href: "/configuracion/sucursales" },
  { code: "nexo.administracion.auditoria.ver", href: "/configuracion/auditoria" },
  { code: "nexo.configuracion.editar", href: "/configuracion/marca" },
] as const;

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

  const [{ data: apps, error }, { data: { user } }, , permisosConfig] = await Promise.all([
    supabase.rpc("get_visible_apps", { p_company_id: companyId }),
    supabase.auth.getUser(),
    exigirPasswordDefinitiva(supabase),
    Promise.all(DESTINOS_CONFIGURACION.map((d) => hasPermission({ supabase, companyId }, d.code))),
  ]);

  const lista = apps ?? [];
  const configuracionHref = DESTINOS_CONFIGURACION.find((_, i) => permisosConfig[i])?.href;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-slate-50 to-sky-100">
      <header className="flex items-center justify-between border-b border-white/60 bg-white/60 px-4 py-3 backdrop-blur sm:px-6">
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

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="sr-only">Aplicaciones</h1>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudo cargar la lista de módulos: {error.message}
          </p>
        )}

        {!error && lista.length === 0 && !configuracionHref && (
          <p className="rounded-md border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
            No tenés ninguna aplicación habilitada todavía. Pedile a un
            administrador que te asigne un rol con acceso a las aplicaciones
            que necesitás (Configuración → Usuarios).
          </p>
        )}

        {(lista.length > 0 || configuracionHref) && (
          <div className="grid grid-cols-[repeat(auto-fill,104px)] justify-center gap-x-4 gap-y-7 sm:gap-x-8">
            {lista.map((app) => (
              <AppTile key={app.slug} app={app} />
            ))}
            {configuracionHref && (
              <Link href={configuracionHref} className={itemClass}>
                <span className={tileClass}>
                  <AppTileIcon icon="settings" className="h-12 w-12" />
                </span>
                <span className="text-[13px] leading-tight text-neutral-700">Configuración</span>
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
