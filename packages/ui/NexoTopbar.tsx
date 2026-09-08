"use client";

// Barra superior de Nexo Enterprise UI (rediseño 2026-09-07) — sustituye a
// ShellBar (retirado). Breadcrumb (armado por NexoShell a partir del arbol
// de navegacion, ver nexo-nav.ts) + buscador + notificaciones + avatar,
// mas el boton de menu hamburguesa que abre el Drawer del sidebar en
// mobile/tablet. Normalmente se usa a traves de NexoShell.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { shellFont } from "./shell-font";

export interface NexoTopbarProps {
  breadcrumb: BreadcrumbItem[];
  userEmail?: string | null;
  onSignOut?: () => void | Promise<void>;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  settingsHref?: string;
  onMenuClick: () => void;
  /** core.platform_settings.logo_url (Nexo → Configuración → Marca). Sin
   * configurar, se muestra el wordmark "Nexo" por defecto — nunca un logo
   * hardcodeado de otro módulo. */
  logoUrl?: string | null;
}

function NexoWordmark() {
  return (
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
      N
    </span>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M17 17l-4-4" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden="true">
      <path
        d="M10 3.5c-2.2 0-4 1.8-4 4v2.4c0 .5-.2 1-.5 1.4L4.5 12.7c-.5.6-.1 1.5.7 1.5h9.6c.8 0 1.2-.9.7-1.5l-1-1.4c-.3-.4-.5-.9-.5-1.4V7.5c0-2.2-1.8-4-4-4Z"
        strokeLinejoin="round"
      />
      <path d="M8.2 16.5a1.9 1.9 0 0 0 3.6 0" strokeLinecap="round" />
    </svg>
  );
}

function useOutsideClick(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onOutside]);
  return ref;
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <BellIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-600 shadow-lg">
          <p className="font-medium text-neutral-900">Notificaciones</p>
          <p className="mt-1 text-neutral-500">Próximamente — todavía no hay eventos configurados.</p>
        </div>
      )}
    </div>
  );
}

function UserMenu({
  email,
  onSignOut,
  settingsHref,
}: {
  email?: string | null;
  onSignOut?: () => void | Promise<void>;
  settingsHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
          {email && (
            <p className="truncate border-b border-neutral-100 px-2.5 py-2 text-neutral-500">{email}</p>
          )}
          {settingsHref && (
            <Link
              href={settingsHref}
              className="mt-1 block w-full rounded-md px-2.5 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Configuración de marca
            </Link>
          )}
          {onSignOut && (
            <form action={onSignOut}>
              <button
                type="submit"
                className="mt-1 w-full rounded-md px-2.5 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Cerrar sesión
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function NexoTopbar({
  breadcrumb,
  userEmail,
  onSignOut,
  onSearch,
  searchPlaceholder,
  showSearch = true,
  settingsHref,
  onMenuClick,
  logoUrl,
}: NexoTopbarProps) {
  return (
    <div
      className={`${shellFont.className} sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--nexo-enterprise-border)] bg-[var(--nexo-enterprise-surface)] px-4 py-3 sm:px-6`}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex-shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 md:hidden"
      >
        <MenuIcon />
      </button>

      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Nexo" className="h-7 w-7 flex-shrink-0 rounded-md object-contain" />
      ) : (
        <NexoWordmark />
      )}

      <div className="min-w-0 flex-shrink">
        <Breadcrumb items={breadcrumb} />
      </div>

      {showSearch && (
        <form
          className="hidden flex-1 justify-center px-4 md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            if (onSearch && typeof value === "string" && value.trim()) {
              onSearch(value.trim());
            }
          }}
        >
          <label className="flex w-full max-w-md items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-neutral-500 focus-within:border-blue-500 focus-within:bg-white">
            <SearchIcon />
            <input
              name="q"
              type="search"
              placeholder={searchPlaceholder ?? (onSearch ? "Buscar en Nexo…" : "Buscar (próximamente)")}
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
          </label>
        </form>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-1">
        <NotificationsMenu />
        <UserMenu email={userEmail} onSignOut={onSignOut} settingsHref={settingsHref} />
      </div>
    </div>
  );
}
