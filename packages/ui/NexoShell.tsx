"use client";

// Orquestador del rediseño Nexo Enterprise UI (2026-09-07) — sustituye a
// AppShell + ShellBar + Sidebar + el Header/AppSidebar que cada modulo
// duplicaba (ver docs/DESIGN_SYSTEM.md). Un solo Client Component que:
//
//   - resuelve el breadcrumb automaticamente a partir del arbol de
//     navegacion (`items`) + el pathname actual — ninguna pagina arma su
//     propio "Nexo / RRHH / Expedientes / Empleados" a mano;
//   - comparte el estado de collapse (desktop) y Drawer (mobile/tablet)
//     entre NexoSidebar y el boton de menu de NexoTopbar;
//   - monta <ToastProvider> una sola vez, para que cualquier pantalla del
//     modulo pueda usar useToast() sin volver a envolver nada.
//
// El chequeo de permiso de MODULO (ej. "rrhh.ver_modulo") sigue viviendo en
// el (app)/layout.tsx de cada app (Server Component, ahi es donde
// corresponde el redirect a /sin-acceso) — ese layout arma `items` con los
// permisos de RECURSO ya resueltos server-side y le pasa el resultado a
// este componente, que solo se encarga de la interactividad del shell.
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Footer } from "./Footer";
import { NexoSidebar } from "./NexoSidebar";
import { NexoTopbar } from "./NexoTopbar";
import { ToastProvider } from "./Toast";
import { resolveBreadcrumbTrail, type NexoNavItem } from "./nexo-nav";

export interface NexoShellProps {
  moduleLabel: string;
  moduleHref?: string;
  items: NexoNavItem[];
  userEmail?: string | null;
  onSignOut?: () => void | Promise<void>;
  settingsHref?: string;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  /** URL absoluta del panel — omitir solo en apps/nexo, que ya es el panel. */
  backHref?: string;
  /** Texto de copyright (core.platform_settings.copyright_text) — omitir
   * para no mostrar footer. */
  footerText?: string;
  /** core.platform_settings.logo_url — se muestra en el topbar; sin
   * configurar, NexoTopbar cae al wordmark "Nexo" por defecto. */
  logoUrl?: string | null;
  children: React.ReactNode;
}

export function NexoShell({
  moduleLabel,
  moduleHref,
  items,
  userEmail,
  onSignOut,
  settingsHref,
  onSearch,
  searchPlaceholder,
  backHref,
  footerText,
  logoUrl,
  children,
}: NexoShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const trail = resolveBreadcrumbTrail(items, pathname);
  const breadcrumb = [
    { label: moduleLabel, href: moduleHref },
    ...trail.map((item) => ({ label: item.label, href: item.href })),
  ];

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--nexo-enterprise-bg)]">
        <NexoSidebar
          items={items}
          moduleLabel={moduleLabel}
          moduleHref={moduleHref}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          backHref={backHref}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <NexoTopbar
            breadcrumb={breadcrumb}
            userEmail={userEmail}
            onSignOut={onSignOut}
            settingsHref={settingsHref}
            onSearch={onSearch}
            searchPlaceholder={searchPlaceholder}
            onMenuClick={() => setMobileOpen(true)}
            logoUrl={logoUrl}
          />
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          {footerText && <Footer text={footerText} />}
        </div>
      </div>
    </ToastProvider>
  );
}
