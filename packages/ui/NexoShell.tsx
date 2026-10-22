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
//
// v2 (2026-10-20):
//   - el sidebar colapsado se recuerda en localStorage (con try/catch: en
//     modo privado o con el almacenamiento bloqueado queda en memoria). Se
//     lee con useSyncExternalStore, asi el HTML del servidor (expandido) no
//     choca con la hidratacion; otras pestañas se sincronizan por "storage";
//   - el Drawer movil se cierra solo al cambiar de ruta (su estado guarda la
//     ruta en la que se abrio) y devuelve el foco al boton de menu;
//   - enlace "Saltar al contenido" para teclado.
import { usePathname } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore } from "react";
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
  children: React.ReactNode;
}

const CLAVE_COLAPSADO = "nexo:sidebar-colapsado";
// Respaldo cuando localStorage no esta disponible. Solo se escribe desde un
// clic en el navegador (nunca en el servidor).
let colapsadoEnMemoria = false;
const suscriptores = new Set<() => void>();

function leerColapsado(): boolean {
  try {
    const guardado = window.localStorage.getItem(CLAVE_COLAPSADO);
    return guardado === null ? colapsadoEnMemoria : guardado === "1";
  } catch {
    return colapsadoEnMemoria;
  }
}

function guardarColapsado(valor: boolean) {
  colapsadoEnMemoria = valor;
  try {
    window.localStorage.setItem(CLAVE_COLAPSADO, valor ? "1" : "0");
  } catch {
    // Modo privado o almacenamiento bloqueado: queda en memoria.
  }
  suscriptores.forEach((avisar) => avisar());
}

function suscribirColapsado(avisar: () => void) {
  suscriptores.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    suscriptores.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
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
  children,
}: NexoShellProps) {
  const pathname = usePathname();
  const sidebarId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const collapsed = useSyncExternalStore(suscribirColapsado, leerColapsado, () => false);

  // El Drawer recuerda en que ruta se abrio: al navegar a otra queda
  // cerrado sin un efecto. Si se vuelve a esa ruta con "atras/adelante", el
  // estado viejo se descarta aca mismo para que no se reabra.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  if (drawerPath !== null && drawerPath !== pathname) setDrawerPath(null);
  const mobileOpen = drawerPath === pathname;

  const trail = resolveBreadcrumbTrail(items, pathname);
  const breadcrumb = [
    { label: moduleLabel, href: moduleHref },
    ...trail.map((item) => ({ label: item.label, href: item.href })),
  ];

  return (
    <ToastProvider>
      <a
        href="#contenido-principal"
        className="sr-only z-[70] rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        Saltar al contenido
      </a>
      <div className="flex min-h-screen bg-[var(--nexo-enterprise-bg)]">
        <NexoSidebar
          id={sidebarId}
          items={items}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={() => guardarColapsado(!collapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setDrawerPath(null)}
          returnFocusRef={menuButtonRef}
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
            onMenuClick={() => setDrawerPath(pathname)}
            menuButtonRef={menuButtonRef}
            menuExpanded={mobileOpen}
            menuControls={sidebarId}
          />
          <main
            id="contenido-principal"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
          >
            {children}
          </main>
          {footerText && <Footer text={footerText} />}
        </div>
      </div>
    </ToastProvider>
  );
}
