"use client";

// Pestañas accesibles (Nexo Enterprise UI v2, 2026-10-20). Dos piezas:
//
//   - Tabs: paneles en la misma pagina, patron WAI-ARIA completo —
//     role="tablist"/"tab"/"tabpanel", aria-selected, aria-controls, foco
//     itinerante (solo la pestaña activa entra en el orden de Tab) y flechas
//     izquierda/derecha, Inicio y Fin (las pestañas deshabilitadas se saltan).
//     Sin control externo guarda su propio estado; con `value` +
//     `onValueChange` lo controla el padre (solo desde un componente cliente).
//   - TabLinks: la variante de enlaces, para pestañas que cambian de ruta
//     (o de ?tab=). Es navegacion, asi que va como <nav> con aria-current
//     y next/link, no como tablist (role="tab" es para paneles, no para
//     enlaces). La activa se deduce de la ruta si no se marca `active`.
//
// El contenido de cada pestaña llega ya renderizado (JSX), nunca como
// funcion: asi Tabs se puede montar desde un Server Component (ver el fix de
// FormTabs del 2026-09-08). Solo se monta el panel activo, igual que FormTabs.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** Contenido ya renderizado de la pestaña (JSX, no una funcion). */
  content: ReactNode;
  disabled?: boolean;
  /** Conteo o insignia junto a la etiqueta. */
  badge?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (key: string) => void;
  /** Nombre accesible de la lista de pestañas. */
  label?: string;
  className?: string;
}

const TAB_BASE =
  "relative inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600";
const TAB_ACTIVE = "border-blue-600 text-blue-700";
const TAB_IDLE = "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-900";
const TAB_DISABLED = "cursor-not-allowed border-transparent text-neutral-400";
// La linea base va como sombra interior (no como borde) para que el
// subrayado de la pestaña activa no quede recortado por el scroll horizontal.
const TAB_LIST = "flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-neutral-200)]";

function TabBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-1.5 py-px text-xs font-medium text-neutral-600 tabular-nums">
      {children}
    </span>
  );
}

export function Tabs({ items, value, defaultValue, onValueChange, label, className }: TabsProps) {
  const baseId = useId();
  const firstEnabled = items.find((t) => !t.disabled)?.key;
  const [internal, setInternal] = useState(defaultValue ?? firstEnabled ?? items[0]?.key);
  const selectedKey = value ?? internal;
  const active = items.find((t) => t.key === selectedKey) ?? items[0];
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  function select(key: string) {
    if (value === undefined) setInternal(key);
    onValueChange?.(key);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((t) => !t.disabled);
    if (enabled.length === 0 || !active) return;
    const index = enabled.findIndex((t) => t.key === active.key);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(index + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next.key);
    tabRefs.current.get(next.key)?.focus();
  }

  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = (key: string) => `${baseId}-panel-${key}`;

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown} className={TAB_LIST}>
        {items.map((tab) => {
          const selected = active?.key === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
                else tabRefs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              id={tabId(tab.key)}
              aria-selected={selected}
              aria-controls={selected ? panelId(tab.key) : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.key)}
              className={`${TAB_BASE} ${tab.disabled ? TAB_DISABLED : selected ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null ? <TabBadge>{tab.badge}</TabBadge> : null}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={panelId(active.key)}
          aria-labelledby={tabId(active.key)}
          tabIndex={0}
          className="mt-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}

export interface TabLinkItem {
  label: ReactNode;
  /** Ruta dentro del modulo (sin basePath), puede llevar ?query. */
  href: string;
  /** Fuerza el estado activo (p. ej. pestañas por ?tab=). */
  active?: boolean;
  /** Activa solo con la ruta exacta (no con sus subrutas). */
  exact?: boolean;
  badge?: ReactNode;
}

export interface TabLinksProps {
  items: TabLinkItem[];
  /** Nombre accesible de la navegacion. */
  label?: string;
  className?: string;
}

export function TabLinks({ items, label = "Secciones", className }: TabLinksProps) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
      <ul className={TAB_LIST}>
        {items.map((item) => {
          const path = item.href.split("?")[0] || pathname;
          const active =
            item.active ?? (item.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_IDLE}`}
              >
                {item.label}
                {item.badge !== undefined && item.badge !== null ? <TabBadge>{item.badge}</TabBadge> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
