// Breadcrumb de contexto — pedido explicito de Nexo Enterprise UI
// (rediseño 2026-09-07): "Nexo / RRHH / Expedientes / Empleados". NexoTopbar
// lo arma automaticamente a partir del arbol de navegacion + pathname (ver
// NexoShell.tsx); este componente tambien se exporta suelto para una pagina
// que necesite un breadcrumb propio (ej. dentro de un detalle con
// subnavegacion que el arbol de sidebar no modela).
//
// No es "use client": son <Link> pero no requieren estado propio, puede
// usarse directo desde un Server Component.
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className="flex min-w-0 items-center text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex min-w-0 items-center">
            {i > 0 && (
              <span aria-hidden="true" className="mx-1.5 text-neutral-300">
                /
              </span>
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate ${isLast ? "font-medium text-neutral-900" : "text-neutral-500"}`}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
