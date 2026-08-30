"use client";

// Barra superior persistente de toda la suite — ver
// docs/planning/NORMA_DISENO_UNIVERSAL.md §2.1. Este componente ES la
// barra: ningun modulo construye su propio header que la reemplace (ver
// docs/DESIGN_SYSTEM.md).
//
// Tema claro a proposito (decision explicita del usuario, 2026-08-30): el
// negro/oscuro queda reservado UNICAMENTE para la pantalla de login — todo
// lo demas, barra incluida, usa la paleta clara neutral-*/blue-600.
//
// "use client" porque el buscador y el menu de usuario son interactivos
// (input controlado, dropdown) — onSignOut sigue pudiendo ser una server
// action pasada como prop desde el padre server component, eso funciona
// cruzando el limite cliente/servidor sin problema.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BackToPanelLink } from "./BackToPanelLink";
import { shellFont } from "./shell-font";

export interface ShellBarProps {
  title: string;
  /** Si se pasa, el titulo enlaza ahi (ej. la home del propio modulo,
   * "/clientes" en el CRM) — navegacion dentro del mismo modulo, por eso
   * usa next/link y no un <a> plano como BackToPanelLink. */
  titleHref?: string;
  userEmail?: string | null;
  /** URL absoluta del panel — si se pasa, muestra "← Nexo" a la izquierda
   * del titulo. Omitir solo en el panel mismo (no hay a donde volver). */
  backHref?: string;
  /** Server action (form action) para cerrar sesion. */
  onSignOut?: () => void | Promise<void>;
  /** Buscador global (Omnibar). Sin `onSearch`, el campo se muestra pero
   * no hace nada al enviar — todavia no hay indice de busqueda real (ver
   * tabla de estado de NORMA_DISENO_UNIVERSAL.md). Pasar `onSearch` para
   * conectarlo cuando la app tenga a donde mandar la query. */
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  /** Oculta el buscador — por ahora nunca hace falta, pero deja la puerta
   * abierta para una pantalla angosta que no le entre. */
  showSearch?: boolean;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M17 17l-4-4" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-5 w-5"
      aria-hidden="true"
    >
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
          <p className="mt-1 text-neutral-500">
            Próximamente — todavía no hay eventos configurados.
          </p>
        </div>
      )}
    </div>
  );
}

function UserMenu({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut?: () => void | Promise<void>;
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
            <p className="truncate border-b border-neutral-100 px-2.5 py-2 text-neutral-500">
              {email}
            </p>
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

export function ShellBar({
  title,
  titleHref,
  userEmail,
  backHref,
  onSignOut,
  onSearch,
  searchPlaceholder,
  showSearch = true,
}: ShellBarProps) {
  const titleEl = titleHref ? (
    <Link href={titleHref} className="hover:text-neutral-600">
      {title}
    </Link>
  ) : (
    title
  );

  return (
    <div
      className={`${shellFont.className} flex items-center gap-4 border-b border-neutral-200 bg-white px-6 py-3 text-neutral-900`}
    >
      <div className="flex flex-shrink-0 items-center gap-4">
        {backHref && (
          <>
            <BackToPanelLink href={backHref} />
            <span aria-hidden="true" className="text-neutral-300">
              /
            </span>
          </>
        )}
        <span className="text-sm font-semibold tracking-tight">{titleEl}</span>
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
              placeholder={
                searchPlaceholder ??
                (onSearch ? "Buscar en Nexo…" : "Buscar (próximamente)")
              }
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
          </label>
        </form>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-1">
        <NotificationsMenu />
        <UserMenu email={userEmail} onSignOut={onSignOut} />
      </div>
    </div>
  );
}
