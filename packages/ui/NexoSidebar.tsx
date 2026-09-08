"use client";

// Sidebar persistente de Nexo Enterprise UI (rediseño 2026-09-07) —
// sustituye al dock flotante de Sidebar.tsx (retirado). Azul marino
// (`--nexo-enterprise-sidebar-bg`), colapsable en desktop (icon-only),
// Drawer off-canvas en mobile/tablet (<768px) — nunca fijo en pantalla
// angosta, regla explicita del rediseño. Soporta grupos anidados de un
// nivel (ej. "Expedientes" → "Empleados"/"Documentos") con acordeon
// auto-expandido si el item activo esta adentro.
//
// Normalmente se usa a traves de NexoShell, que ya arma este componente +
// NexoTopbar compartiendo el estado de collapse/drawer — se exporta suelto
// por si una pantalla necesita el sidebar sin el resto del shell.
import { useEffect, useState } from "react";
import Link from "next/link";
import { BackToPanelLink } from "./BackToPanelLink";
import { NexoIcon } from "./nexo-icons";
import { isNavItemActive, type NexoNavItem } from "./nexo-nav";

export interface NexoSidebarProps {
  items: NexoNavItem[];
  moduleLabel: string;
  moduleHref?: string;
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** URL absoluta del panel (apps/nexo) — omitir en el propio panel, donde
   * no hay a donde volver (mismo criterio que ShellBar.backHref). */
  backHref?: string;
}

export function NexoSidebar({
  items,
  moduleLabel,
  moduleHref,
  pathname,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  backHref,
}: NexoSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (item.children && isNavItemActive(item, pathname)) initial.add(item.label);
    }
    return initial;
  });

  // Fix (2026-09-08, docs/IMPLEMENTATION_STATUS.md): el estado `expanded`
  // solo se calculaba una vez, al montar. NexoShell (y por lo tanto este
  // sidebar) NO se remonta entre navegaciones dentro del mismo modulo
  // (es lo correcto para el rendimiento — evita recrear el shell en cada
  // click), pero eso significa que llegar a una ruta de un grupo distinto
  // por un link que no es del sidebar (ej. "Volver" desde una ficha, un
  // breadcrumb, o Contratos → click en un empleado) dejaba el item activo
  // resaltado pero el acordeon que lo contiene seguia colapsado — el link
  // activo quedaba escondido. Sincroniza el grupo activo cada vez que
  // cambia el pathname, sin tocar los grupos que el usuario ya abrio o
  // cerro a mano.
  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const item of items) {
        if (item.children && isNavItemActive(item, pathname) && !next.has(item.label)) {
          next.add(item.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--nexo-enterprise-sidebar-bg)] text-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-64"}`}
      >
        <div
          className={`flex h-14 flex-shrink-0 items-center border-b border-white/10 px-4 ${
            collapsed ? "md:justify-center md:px-0" : "justify-between"
          }`}
        >
          {moduleHref ? (
            <Link
              href={moduleHref}
              className={`truncate text-sm font-semibold tracking-tight ${collapsed ? "md:hidden" : ""}`}
            >
              {moduleLabel}
            </Link>
          ) : (
            <span className={`truncate text-sm font-semibold tracking-tight ${collapsed ? "md:hidden" : ""}`}>
              {moduleLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="hidden rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white md:inline-flex"
          >
            <ChevronIcon className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {items.map((item) => (
            <NavNode
              key={item.label}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
              expanded={expanded}
              onToggleGroup={toggleGroup}
            />
          ))}
        </nav>

        {backHref && (
          <div className={`border-t border-white/10 p-3 ${collapsed ? "md:flex md:justify-center" : ""}`}>
            {collapsed ? (
              <a
                href={backHref}
                title="Volver a Nexo"
                className="hidden text-sm text-white/50 transition-colors hover:text-white md:inline-block"
              >
                ←
              </a>
            ) : null}
            <BackToPanelLink
              href={backHref}
              label="Volver a Nexo"
              className={`inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white ${
                collapsed ? "md:hidden" : ""
              }`}
            />
          </div>
        )}
      </aside>
    </>
  );
}

function NavNode({
  item,
  collapsed,
  pathname,
  expanded,
  onToggleGroup,
}: {
  item: NexoNavItem;
  collapsed: boolean;
  pathname: string;
  expanded: Set<string>;
  onToggleGroup: (label: string) => void;
}) {
  const hasChildren = (item.children?.length ?? 0) > 0;
  const active = isNavItemActive(item, pathname);
  const isLeafActive = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
  const isExpanded = expanded.has(item.label);
  // Sin href y sin hijos: funcionalidad todavia no construida — se
  // muestra deshabilitado en vez de crear una pagina placeholder por cada
  // una (ajuste obligatorio del rediseño, 2026-09-07).
  const disabled = !item.href && !hasChildren;

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => onToggleGroup(item.label)}
          title={collapsed ? item.label : undefined}
          className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
            active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          } ${collapsed ? "md:justify-center" : ""}`}
        >
          <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
          <span className={`flex-1 truncate text-left ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
          <ChevronIcon
            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""} ${
              collapsed ? "md:hidden" : ""
            }`}
          />
        </button>
        {isExpanded && (
          <div className={`ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3 ${collapsed ? "md:hidden" : ""}`}>
            {item.children!.map((child) => (
              <NavNode
                key={child.label}
                item={child}
                collapsed={collapsed}
                pathname={pathname}
                expanded={expanded}
                onToggleGroup={onToggleGroup}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <span
        title="Próximamente"
        className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-white/30 ${
          collapsed ? "md:justify-center" : ""
        }`}
      >
        <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
        <span className={`flex-1 truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
        <span className={`flex-shrink-0 text-[10px] uppercase tracking-wide ${collapsed ? "md:hidden" : ""}`}>
          Pronto
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
        isLeafActive
          ? "bg-[var(--nexo-enterprise-sidebar-active)] text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      } ${collapsed ? "md:justify-center" : ""}`}
    >
      <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
      <span className={`truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
    </Link>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}
