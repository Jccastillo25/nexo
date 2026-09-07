// Modelo de navegacion compartido por NexoSidebar y NexoShell (breadcrumb
// automatico). Un item sin `href` y sin `children` se muestra como
// "Próximamente" en el sidebar (ver ajuste obligatorio del rediseño
// 2026-09-07: no crear una pagina placeholder por cada funcionalidad
// futura, solo deshabilitar el item de navegacion).
import type { NexoIconName } from "./nexo-icons";

export interface NexoNavItem {
  label: string;
  /** Sin `href` y sin `children`, el item se muestra deshabilitado
   * ("Próximamente") — ver NexoSidebar.tsx. */
  href?: string;
  icon?: NexoIconName;
  children?: NexoNavItem[];
}

function flattenNavWithTrail(
  items: NexoNavItem[],
  trail: NexoNavItem[] = []
): { item: NexoNavItem; trail: NexoNavItem[] }[] {
  return items.flatMap((item) => {
    const nextTrail = [...trail, item];
    const self = item.href ? [{ item, trail: nextTrail }] : [];
    const children = item.children ? flattenNavWithTrail(item.children, nextTrail) : [];
    return [...self, ...children];
  });
}

/** Ruta de ancestros (incluido el item) del nodo cuyo `href` mejor matchea
 * el pathname actual — el mas especifico (href mas largo) gana. Usado por
 * NexoShell para armar el breadcrumb "Nexo / RRHH / Expedientes / ..."
 * automaticamente a partir del arbol de navegacion, sin repetirlo a mano
 * en cada pagina. */
export function resolveBreadcrumbTrail(items: NexoNavItem[], pathname: string): NexoNavItem[] {
  const flat = flattenNavWithTrail(items);
  const matches = flat.filter(
    ({ item }) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  if (matches.length === 0) return [];
  matches.sort((a, b) => b.item.href!.length - a.item.href!.length);
  return matches[0].trail;
}

export function isNavItemActive(item: NexoNavItem, pathname: string): boolean {
  if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) return true;
  return (item.children ?? []).some((child) => isNavItemActive(child, pathname));
}
