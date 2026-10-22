"use client";

// Barra superior de Nexo Enterprise UI (rediseño 2026-09-07) — sustituye a
// ShellBar (retirado). Breadcrumb (armado por NexoShell a partir del arbol
// de navegacion, ver nexo-nav.ts) + buscador + notificaciones + avatar,
// mas el boton de menu hamburguesa que abre el Drawer del sidebar en
// mobile/tablet. Normalmente se usa a traves de NexoShell.
//
// v2 (2026-10-20): el boton de menu expone aria-expanded/aria-controls y
// recibe el foco al cerrarse el Drawer (menuButtonRef); foco visible en
// todos los controles; los menus de notificaciones y usuario cierran con
// Escape; el buscador tiene nombre accesible y su texto de ejemplo cumple
// contraste. El buscador y la campana se mantienen tal cual hasta que el
// usuario decida si se ocultan mientras no funcionen (decision pendiente).
import { useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { NexoIcon } from "./nexo-icons";
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
  /** Ref del boton de menu (movil): NexoShell le devuelve el foco al cerrar el Drawer. */
  menuButtonRef?: Ref<HTMLButtonElement>;
  /** Drawer abierto (aria-expanded del boton de menu). */
  menuExpanded?: boolean;
  /** id del sidebar que controla el boton de menu. */
  menuControls?: string;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
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

/** Cierra un menu desplegable con clic afuera o con Escape (el foco vuelve al boton). */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) latest.current();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      latest.current();
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return { ref, buttonRef };
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const { ref, buttonRef } = useDismiss(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        aria-expanded={open}
        className={`rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 ${FOCUS}`}
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
  const { ref, buttonRef } = useDismiss(open, () => setOpen(false));
  const initial = email ? email.charAt(0).toUpperCase() : "?";
  const itemClass = `block w-full rounded-md px-2.5 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600`;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={email ? `Menú de usuario (${email})` : "Menú de usuario"}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 ${FOCUS}`}
      >
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          {initial}
        </span>
        <span aria-hidden="true" className="hidden max-w-[10rem] truncate sm:inline">
          {email}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-1.5 text-sm shadow-lg">
          {email && (
            <p className="truncate border-b border-neutral-100 px-2.5 py-2 text-neutral-500">{email}</p>
          )}
          {settingsHref && (
            <Link href={settingsHref} className={`mt-1 ${itemClass}`}>
              Configuración de marca
            </Link>
          )}
          {onSignOut && (
            <form action={onSignOut}>
              <button type="submit" className={`mt-1 ${itemClass}`}>
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
  menuButtonRef,
  menuExpanded,
  menuControls,
}: NexoTopbarProps) {
  return (
    <div
      className={`${shellFont.className} sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--nexo-enterprise-border)] bg-[var(--nexo-enterprise-surface)] px-4 py-3 sm:px-6`}
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        aria-expanded={menuExpanded}
        aria-controls={menuControls}
        className={`-my-2 -ml-2 inline-flex size-11 flex-shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 md:hidden ${FOCUS}`}
      >
        <MenuIcon />
      </button>

      {/* El logo vive en la cabecera del sidebar (reconciliacion de
          navegacion 2026-09-14) — no se repite acá, regla obligatoria del
          bloque P1. */}
      <div className="min-w-0 flex-shrink">
        <Breadcrumb items={breadcrumb} />
      </div>

      {showSearch && (
        <form
          role="search"
          className="hidden flex-1 justify-center px-4 md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            if (onSearch && typeof value === "string" && value.trim()) {
              onSearch(value.trim());
            }
          }}
        >
          <label className="flex w-full max-w-md items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-neutral-500 transition-colors focus-within:border-blue-600 focus-within:bg-white focus-within:ring-3 focus-within:ring-blue-600/15">
            <NexoIcon name="search" className="size-4 flex-shrink-0" />
            <input
              name="q"
              type="search"
              aria-label="Buscar"
              placeholder={searchPlaceholder ?? (onSearch ? "Buscar en Nexo…" : "Buscar (próximamente)")}
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
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
