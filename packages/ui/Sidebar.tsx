"use client";

// Sidebar contextual — ver docs/planning/NORMA_DISENO_UNIVERSAL.md §2.2.
// Aparece solo dentro de un modulo (nunca en apps/nexo, que ya tiene su
// propia grilla de modulos como navegacion). Muestra unicamente los items
// del modulo activo — este componente resuelve el shell (dock flotante,
// expandir/colapsar, estado activo); la lista de `items` y si cada uno
// esta activo es responsabilidad de la app que lo usa (compara con el
// pathname actual).
//
// Dock flotante (no acoplado al layout) a pedido explicito del usuario,
// con paleta clara — el negro/oscuro queda reservado solo para el login
// (ver ShellBar). No reserva espacio en el flujo de la pagina: el
// contenido de la app le deja un margen izquierdo fijo para no quedar
// tapado por el dock colapsado (ver el `main` de cada modulo).

import { useState } from "react";
import Link from "next/link";
import { shellFont } from "./shell-font";

// Registro de iconos por nombre, no por referencia a componente: los items
// de este sidebar normalmente se arman en un layout que es Server
// Component (hace el chequeo de permisos ahi — ver apps/crm/src/app/(app)/
// layout.tsx), y Next.js no permite pasar una referencia a funcion/
// componente como prop de Server a Client Component (no es serializable).
// Con una clave de texto (`SidebarIconName`) el dato sigue siendo un string
// plano; el componente (client) resuelve el icono real aca adentro.
const ICONS = {
  grid: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1.3" />
      <rect x="11" y="3" width="6" height="6" rx="1.3" />
      <rect x="3" y="11" width="6" height="6" rx="1.3" />
      <rect x="11" y="11" width="6" height="6" rx="1.3" />
    </>
  ),
  users: (
    <>
      <circle cx="7" cy="7" r="2.4" />
      <path d="M2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" />
      <circle cx="14.3" cy="7.7" r="2" />
      <path d="M12.7 16c.1-2.1 1.7-3.7 4.1-3.7" />
    </>
  ),
  folder: (
    <path d="M3 5.5h4.5l1.5 2H17v8.5H3V5.5Z" />
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.7v2.1M10 15.2v2.1M17.3 10h-2.1M4.8 10H2.7M15 5l-1.5 1.5M6.5 13.5 5 15M15 15l-1.5-1.5M6.5 6.5 5 5" />
    </>
  ),
  chat: (
    <path d="M3 4.5h14v9H8l-3.5 3v-3H3v-9Z" />
  ),
  // Agregados para RRHH (Kiosco/Planillas) — set aditivo, no rompe los
  // nombres existentes.
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.8 2.2" strokeLinecap="round" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="15" height="9" rx="1.5" />
      <circle cx="10" cy="10.5" r="2.2" />
      <path d="M5.5 8v0M14.5 13v0" strokeLinecap="round" />
    </>
  ),
} as const;

export type SidebarIconName = keyof typeof ICONS;

function ItemIcon({ name }: { name?: SidebarIconName }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {ICONS[name ?? "grid"]}
    </svg>
  );
}

export interface SidebarItem {
  /** Texto del item. */
  label: string;
  /** URL del item (relativa al basePath del modulo, ej. "/clientes"). */
  href: string;
  /** Nombre de icono del set incluido (ver `SidebarIconName`) — sin
   * icono, se usa "grid". No acepta un componente arbitrario: ver el
   * comentario del registro `ICONS` arriba. */
  icon?: SidebarIconName;
  /** Si esta seccion es la activa — lo decide la app comparando pathname. */
  active?: boolean;
  /** Etiqueta de grupo (ej. "Gestión"). Si difiere de la del item
   * anterior en la lista, se renderiza un encabezado de sección antes de
   * este item. */
  section?: string;
}

export interface SidebarProps {
  items: SidebarItem[];
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

export function Sidebar({ items }: SidebarProps) {
  // Sin persistencia a proposito: es un dock que se expande al pasar el
  // mouse, la expansion es un gesto momentaneo, no una preferencia a
  // recordar (a diferencia del sidebar acoplado que reemplaza). El click
  // en el boton de arriba es el fallback para touch, donde no hay hover.
  const [isExpanded, setIsExpanded] = useState(false);

  let lastSection: string | undefined;

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`${shellFont.className} fixed left-4 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white/90 py-4 shadow-xl backdrop-blur-md transition-[width] duration-300 ease-in-out ${
        isExpanded ? "w-56" : "w-16"
      }`}
    >
      <div className="mb-4 flex w-full items-center justify-center px-4">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label="Alternar menú"
          aria-expanded={isExpanded}
          className="flex-shrink-0 text-neutral-400 transition-colors hover:text-neutral-900"
        >
          <MenuIcon />
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {items.map((item) => {
          const showSectionHeader = item.section && item.section !== lastSection;
          lastSection = item.section;
          return (
            <div key={item.href} className="flex flex-col">
              {showSectionHeader && isExpanded && (
                <p className="mb-1 mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 first:mt-1">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                title={isExpanded ? undefined : item.label}
                className={`group flex items-center gap-4 rounded-xl p-2 transition-colors ${
                  item.active
                    ? "bg-blue-50 text-blue-600"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <span className="flex w-6 flex-shrink-0 items-center justify-center">
                  <ItemIcon name={item.icon} />
                </span>
                <span
                  className={`whitespace-nowrap text-sm font-medium transition-all duration-300 ${
                    isExpanded
                      ? "translate-x-0 opacity-100"
                      : "pointer-events-none -translate-x-4 opacity-0"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
