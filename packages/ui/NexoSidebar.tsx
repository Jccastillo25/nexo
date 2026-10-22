"use client";

// Sidebar persistente de Nexo Enterprise UI (rediseño 2026-09-07) —
// sustituye al dock flotante de Sidebar.tsx (retirado). Azul marino
// (`--nexo-enterprise-sidebar-bg`), colapsable en desktop (icon-only),
// Drawer off-canvas en mobile/tablet (<768px) — nunca fijo en pantalla
// angosta, regla explicita del rediseño. Soporta grupos anidados (ej.
// "Contratación" → "Catálogos" → "Puestos") con acordeon auto-expandido si
// el item activo esta adentro.
//
// v2 (2026-10-20):
//   - item activo: barra de 2px a la izquierda + bg-white/10 (antes, bloque
//     blue-700 macizo) y aria-current="page";
//   - "Pronto" en 11px con contraste suficiente sobre el azul marino;
//   - se abren TODOS los grupos que contienen la ruta activa, a cualquier
//     profundidad (antes solo el primer nivel: un nieto activo quedaba
//     escondido);
//   - colapsado en desktop: un grupo abre sus hijos en un menu flotante
//     (Escape o clic afuera lo cierran y el foco vuelve al boton); antes no
//     habia forma de llegar a los hijos sin expandir el sidebar;
//   - Drawer movil: Escape cierra, el foco queda atrapado adentro, se cierra
//     al navegar y devuelve el foco al boton de menu; cerrado no se puede
//     recorrer con Tab (visibility hidden);
//   - en modo colapsado las etiquetas quedan para lectores de pantalla
//     (sr-only), no solo en el `title`.
// La cabecera con el texto "Nexo" (vuelve al Launcher via backHref) no
// cambia — decision vigente 2026-09-17.
//
// Normalmente se usa a traves de NexoShell, que ya arma este componente +
// NexoTopbar compartiendo el estado de collapse/drawer — se exporta suelto
// por si una pantalla necesita el sidebar sin el resto del shell.
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { NexoIcon } from "./nexo-icons";
import { isNavItemActive, type NexoNavItem } from "./nexo-nav";

// Anillo de foco visible sobre el fondo azul marino del sidebar (teclado).
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface NexoSidebarProps {
  items: NexoNavItem[];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** URL absoluta del panel (apps/nexo) — omitir en el propio panel, donde
   * el logo ya apunta a "/" (mismo criterio que ShellBar.backHref). */
  backHref?: string;
  /** id del contenedor; NexoShell lo enlaza con aria-controls del boton de menu. */
  id?: string;
  /** Boton que abre el Drawer: recibe el foco cuando se cierra. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Clave estable de un nodo: la ruta de etiquetas desde la raiz. */
function nodeKey(parentKey: string, item: NexoNavItem): string {
  return parentKey ? `${parentKey}/${item.label}` : item.label;
}

/** Claves de todos los grupos que contienen la ruta activa, a cualquier nivel. */
function activeGroupKeys(items: NexoNavItem[], pathname: string, parentKey = "", acc = new Set<string>()) {
  for (const item of items) {
    if (item.children && isNavItemActive(item, pathname)) {
      const key = nodeKey(parentKey, item);
      acc.add(key);
      activeGroupKeys(item.children, pathname, key, acc);
    }
  }
  return acc;
}

function isEmptyGroup(item: NexoNavItem): boolean {
  return item.children !== undefined && item.children.every(isEmptyGroup);
}

function isLeafActive(item: NexoNavItem, pathname: string): boolean {
  return item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
}

function isDesktop(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

interface FlyoutState {
  key: string;
  top: number;
  left: number;
  /** Ruta en la que se abrio: al navegar queda cerrado. */
  path: string;
}

export function NexoSidebar({
  items,
  pathname,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  backHref,
  id,
  returnFocusRef,
}: NexoSidebarProps) {
  // Click en el logo → vuelve al App Launcher de Nexo (decision vigente).
  // En un modulo (RRHH/CRM) eso es una navegacion real de Multi-Zones
  // (backHref, cross-zone); en el propio panel (apps/nexo, sin backHref)
  // "/" ya es el mismo launcher.
  const logoHref = backHref ?? "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // El Drawer movil siempre va expandido (etiquetas y acordeon), aunque en
  // desktop la persona haya dejado el sidebar colapsado.
  const isCollapsed = collapsed && !mobileOpen;

  // Grupos abiertos. Al cambiar la ruta se agregan los grupos que contienen
  // la nueva ruta activa (a cualquier nivel) sin tocar los que el usuario
  // abrio o cerro a mano. Fix original (2026-09-08): NexoShell no se
  // remonta entre navegaciones, y llegar a una ruta por un link que no es
  // del sidebar dejaba el grupo activo plegado. Se sincroniza durante el
  // render (patron "estado derivado de la prop anterior"), sin efecto.
  const [expanded, setExpanded] = useState<Set<string>>(() => activeGroupKeys(items, pathname));
  const [syncedPath, setSyncedPath] = useState(pathname);
  if (syncedPath !== pathname) {
    setSyncedPath(pathname);
    const next = new Set(expanded);
    for (const key of activeGroupKeys(items, pathname)) next.add(key);
    setExpanded(next);
  }

  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const openFlyout = flyout && isCollapsed && flyout.path === pathname ? flyout : null;

  function toggleGroup(key: string, button: HTMLButtonElement) {
    if (isCollapsed && isDesktop()) {
      if (openFlyout?.key === key) {
        setFlyout(null);
        return;
      }
      const rect = button.getBoundingClientRect();
      setFlyout({ key, top: rect.top, left: rect.right + 8, path: pathname });
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Ultimos callbacks para los listeners, sin volver a suscribirlos.
  const latest = useRef({ onCloseMobile });
  useEffect(() => {
    latest.current = { onCloseMobile };
  });

  // Drawer movil abierto: foco adentro, Tab atrapado, Escape cierra, sin
  // scroll del fondo; al pasar a desktop se cierra; al cerrar, el foco
  // vuelve al boton de menu.
  useEffect(() => {
    if (!mobileOpen) return;
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // El boton de menu se captura al abrir (es el mismo nodo al cerrar). En
    // Safari un clic no enfoca el boton, por eso no alcanza con `previous`.
    const returnTarget = returnFocusRef?.current ?? previous;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        latest.current.onCloseMobile();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    function onBreakpoint(e: MediaQueryListEvent) {
      if (e.matches) latest.current.onCloseMobile();
    }

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
      document.body.style.overflow = previousOverflow;
      if (returnTarget && returnTarget.isConnected) returnTarget.focus();
    };
  }, [mobileOpen, returnFocusRef]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-950/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        id={id}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Menú de navegación" : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--nexo-enterprise-sidebar-bg)] text-white transition-[translate,visibility] duration-200 motion-reduce:transition-none md:visible md:sticky md:top-0 md:z-40 md:h-screen md:translate-none ${
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${isCollapsed ? "md:w-16" : "md:w-64"}`}
      >
        <div
          className={`flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 ${
            isCollapsed ? "md:justify-center md:px-0" : ""
          }`}
        >
          <div className={`flex min-w-0 items-center gap-2 ${isCollapsed ? "md:hidden" : ""}`}>
            {/* Texto fijo "Nexo" — nunca el logo/ícono gráfico de marca ni
                el nombre de la app activa (decisión vigente 2026-09-17): el
                nombre de la app va en el breadcrumb/contenido, este
                encabezado es exclusivamente "volver al Launcher". */}
            <a
              href={logoHref}
              aria-label="Volver al inicio de Nexo"
              className={`truncate rounded-sm text-sm font-semibold tracking-tight text-white transition-opacity hover:opacity-80 ${FOCUS_RING}`}
            >
              Nexo
            </a>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            className={`hidden rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white md:inline-flex ${FOCUS_RING}`}
          >
            <NexoIcon name="chevron-left" className={`size-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className={`-mr-2 inline-flex size-10 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden ${FOCUS_RING}`}
          >
            <NexoIcon name="x" className="size-5" />
          </button>
        </div>

        <nav aria-label="Menú principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {items.map((item) => (
            <NavNode
              key={item.label}
              item={item}
              parentKey=""
              collapsed={isCollapsed}
              pathname={pathname}
              expanded={expanded}
              onToggleGroup={toggleGroup}
              onNavigate={onCloseMobile}
              flyout={openFlyout}
              onCloseFlyout={() => setFlyout(null)}
            />
          ))}
        </nav>
      </div>
    </>
  );
}

interface NavNodeProps {
  item: NexoNavItem;
  parentKey: string;
  collapsed: boolean;
  pathname: string;
  expanded: Set<string>;
  onToggleGroup: (key: string, button: HTMLButtonElement) => void;
  onNavigate: () => void;
  flyout: FlyoutState | null;
  onCloseFlyout: () => void;
}

function NavNode({
  item,
  parentKey,
  collapsed,
  pathname,
  expanded,
  onToggleGroup,
  onNavigate,
  flyout,
  onCloseFlyout,
}: NavNodeProps) {
  const groupId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // `children` definido pero vacio: grupo cuyos hijos se filtraron todos
  // por permisos — no se lista (regla del menu de la suite), a cualquier
  // nivel y en cascada (un grupo que solo contiene grupos vacios tambien
  // se oculta). Distinto de un item sin `children`, que es "Pronto".
  if (isEmptyGroup(item)) return null;
  const key = nodeKey(parentKey, item);
  const hasChildren = (item.children ?? []).some((child) => !isEmptyGroup(child));
  const active = isNavItemActive(item, pathname);
  const leafActive = isLeafActive(item, pathname);
  const isExpanded = expanded.has(key);
  const flyoutOpen = flyout?.key === key;
  // Sin href y sin hijos: funcionalidad todavia no construida — se
  // muestra deshabilitado en vez de crear una pagina placeholder por cada
  // una (ajuste obligatorio del rediseño, 2026-09-07).
  const disabled = !item.href && !hasChildren;

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => onToggleGroup(key, e.currentTarget)}
          title={collapsed ? item.label : undefined}
          aria-expanded={collapsed ? flyoutOpen : isExpanded}
          aria-controls={flyoutOpen ? `${groupId}-flotante` : isExpanded ? `${groupId}-hijos` : undefined}
          className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${FOCUS_RING} ${
            active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          } ${flyoutOpen ? "bg-white/10" : ""} ${collapsed ? "md:justify-center" : ""}`}
        >
          <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
          <span className={`flex-1 truncate text-left ${collapsed ? "md:sr-only" : ""}`}>{item.label}</span>
          <NexoIcon
            name="chevron-right"
            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""} ${
              collapsed ? "md:hidden" : ""
            }`}
          />
        </button>
        {isExpanded && (
          <div
            id={`${groupId}-hijos`}
            className={`ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3 ${collapsed ? "md:hidden" : ""}`}
          >
            {item.children!.map((child) => (
              <NavNode
                key={child.label}
                item={child}
                parentKey={key}
                collapsed={collapsed}
                pathname={pathname}
                expanded={expanded}
                onToggleGroup={onToggleGroup}
                onNavigate={onNavigate}
                flyout={flyout}
                onCloseFlyout={onCloseFlyout}
              />
            ))}
          </div>
        )}
        {flyoutOpen && flyout ? (
          <GroupFlyout
            id={`${groupId}-flotante`}
            item={item}
            top={flyout.top}
            left={flyout.left}
            pathname={pathname}
            buttonRef={buttonRef}
            onClose={onCloseFlyout}
          />
        ) : null}
      </div>
    );
  }

  if (disabled) {
    return (
      <span
        title="Próximamente"
        aria-disabled="true"
        className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-white/45 ${
          collapsed ? "md:justify-center" : ""
        }`}
      >
        <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
        <span className={`flex-1 truncate ${collapsed ? "md:sr-only" : ""}`}>{item.label}</span>
        {/* white/55 sobre el azul marino da ~5.4:1 (11px necesita 4.5:1). */}
        <span className={`flex-shrink-0 text-[11px] font-medium text-white/55 ${collapsed ? "md:sr-only" : ""}`}>
          Pronto
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      aria-current={leafActive ? "page" : undefined}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${FOCUS_RING} ${
        leafActive
          ? "bg-white/10 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      } ${collapsed ? "md:justify-center" : ""}`}
    >
      <NexoIcon name={item.icon} className="h-5 w-5 flex-shrink-0" />
      <span className={`truncate ${collapsed ? "md:sr-only" : ""}`}>{item.label}</span>
    </Link>
  );
}

/**
 * Menu flotante de un grupo con el sidebar colapsado (desktop). Va con
 * position: fixed para no quedar recortado por el scroll del <nav>; se
 * cierra con Escape (el foco vuelve al boton del grupo), con clic afuera,
 * al sacar el foco, al hacer scroll o al cambiar el tamaño de la ventana, y
 * al elegir un enlace. Sigue al boton en el orden del DOM, asi Tab entra
 * directo a sus enlaces (patron disclosure, sin roles de menu).
 */
function GroupFlyout({
  id,
  item,
  top,
  left,
  pathname,
  buttonRef,
  onClose,
}: {
  id: string;
  item: NexoNavItem;
  top: number;
  left: number;
  pathname: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const button = buttonRef.current;
    function inside(target: EventTarget | null) {
      return target instanceof Node && (ref.current?.contains(target) || button?.contains(target));
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      latestClose.current();
      button?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      if (!inside(e.target)) latestClose.current();
    }
    function onFocusIn(e: FocusEvent) {
      if (!inside(e.target)) latestClose.current();
    }
    function onScrollOrResize(e: Event) {
      // El scroll dentro del propio menu no lo cierra.
      if (e.type === "scroll" && inside(e.target)) return;
      latestClose.current();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [buttonRef]);

  return (
    <div
      ref={ref}
      id={id}
      style={{ top, left, maxHeight: `calc(100vh - ${Math.round(top)}px - 8px)` }}
      className="fixed z-[60] hidden w-60 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1.5 text-sm text-neutral-700 shadow-lg md:block"
    >
      <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-neutral-500">{item.label}</p>
      <FlyoutList items={item.children ?? []} depth={0} pathname={pathname} onNavigate={onClose} />
    </div>
  );
}

function FlyoutList({
  items,
  depth,
  pathname,
  onNavigate,
}: {
  items: NexoNavItem[];
  depth: number;
  pathname: string;
  onNavigate: () => void;
}) {
  const indent = depth > 0 ? "pl-6" : "pl-3";
  return (
    <ul className="flex flex-col">
      {items.map((child) => {
        if (isEmptyGroup(child)) return null;
        const hasChildren = (child.children ?? []).some((c) => !isEmptyGroup(c));
        if (hasChildren) {
          return (
            <li key={child.label}>
              <p className={`${indent} pt-2 pr-3 pb-1 text-xs font-semibold text-neutral-500`}>{child.label}</p>
              <FlyoutList items={child.children!} depth={depth + 1} pathname={pathname} onNavigate={onNavigate} />
            </li>
          );
        }
        if (!child.href) {
          return (
            <li key={child.label}>
              <span
                aria-disabled="true"
                className={`flex cursor-not-allowed items-center gap-2.5 ${indent} py-1.5 pr-3 text-neutral-400`}
              >
                <NexoIcon name={child.icon} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{child.label}</span>
                <span className="shrink-0 text-[11px] font-medium text-neutral-500">Pronto</span>
              </span>
            </li>
          );
        }
        const active = isLeafActive(child, pathname);
        return (
          <li key={child.label}>
            <Link
              href={child.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 ${indent} py-1.5 pr-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
                active ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <NexoIcon name={child.icon} className={`size-4 shrink-0 ${active ? "text-blue-600" : "text-neutral-500"}`} />
              <span className="truncate">{child.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
