"use client";

// Sidebar contextual — ver docs/planning/NORMA_DISENO_UNIVERSAL.md §2.2.
// Aparece solo dentro de un modulo (nunca en apps/nexo, que ya tiene su
// propia grilla de modulos como navegacion). Muestra unicamente los items
// del modulo activo — este componente resuelve el shell (ancho, colapso,
// estado activo); la lista de `items` y si cada uno esta activo es
// responsabilidad de la app que lo usa (compara con el pathname actual).

import { useEffect, useState, type ComponentType } from "react";

export interface SidebarItem {
  /** Texto del item. */
  label: string;
  /** URL del item (relativa al basePath del modulo, ej. "/clientes"). */
  href: string;
  /** Icono opcional — cualquier componente que acepte `size` (ej. un
   * icono de lucide-react). @nexo/ui no depende de ninguna libreria de
   * iconos en particular. */
  icon?: ComponentType<{ size?: number }>;
  /** Si esta seccion es la activa — lo decide la app comparando pathname. */
  active?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
}

// Se guarda bajo el dominio publico compartido de Multi-Zones (mismo
// origin en todos los modulos) para que la preferencia de colapso viaje
// con la persona, no quede atada a un modulo en particular.
const STORAGE_KEY = "nexo:sidebar-collapsed";

export function Sidebar({ items }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage puede no estar disponible (privacidad/SSR) — se ignora,
      // el sidebar simplemente arranca expandido.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ver comentario de arriba
      }
      return next;
    });
  }

  return (
    <aside
      className={`flex flex-shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-150 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-neutral-50 text-blue-600"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {Icon && (
                <span className="flex flex-shrink-0 items-center justify-center">
                  <Icon size={20} />
                </span>
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </a>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        className="border-t border-neutral-200 py-3 text-sm text-neutral-400 transition-colors hover:text-neutral-900"
      >
        {collapsed ? "»" : "« Colapsar"}
      </button>
    </aside>
  );
}
