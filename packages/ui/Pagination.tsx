// Paginacion basada en la URL (Nexo Enterprise UI v2, 2026-10-20): "1–50 de
// 699" + Anterior/Siguiente con next/link, asi la pagina vive en
// searchParams y se puede compartir o recargar (mismo criterio que el
// listado de Productos: parametro "pagina", omitido en la pagina 1).
//
//   <Pagination page={pagina} pageSize={50} total={data.total}
//     pathname="/catalogo" searchParams={params} itemLabel="productos" />
//
// O con una funcion propia: hrefForPage={(p) => rutaReporte(reporte, {...filtros, pagina: p})}.
// Sin "use client": usable desde Server Components (va bien en el `footer`
// de DataTable).
import { ButtonLink } from "./Button";
import { entero } from "./formato";
import { NexoIcon } from "./nexo-icons";

export interface PaginationProps {
  /** Pagina actual, desde 1. */
  page: number;
  pageSize: number;
  total: number;
  /** Arma el href de una pagina. Si no se pasa, se usa pathname + searchParams. */
  hrefForPage?: (page: number) => string;
  /** Ruta sin basePath ("/catalogo"). Sin pathname, el enlace es solo "?…" (misma ruta). */
  pathname?: string;
  searchParams?: Record<string, string | string[] | undefined> | URLSearchParams;
  /** Nombre del parametro de pagina. Por defecto "pagina". */
  pageParam?: string;
  /** "productos", "filas"... se agrega al conteo: "1–50 de 699 productos". */
  itemLabel?: string;
  className?: string;
}

function buildHref(
  page: number,
  { pathname = "", searchParams, pageParam = "pagina" }: Pick<PaginationProps, "pathname" | "searchParams" | "pageParam">
): string {
  const sp = new URLSearchParams();
  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => {
      if (key !== pageParam) sp.append(key, value);
    });
  } else if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === pageParam || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) sp.append(key, v);
    }
  }
  if (page > 1) sp.set(pageParam, String(page));
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname || "?";
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefForPage,
  pathname,
  searchParams,
  pageParam,
  itemLabel,
  className,
}: PaginationProps) {
  const size = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const from = total > 0 ? (current - 1) * size + 1 : 0;
  const to = Math.min(current * size, Math.max(0, total));
  const href = (p: number) => (hrefForPage ? hrefForPage(p) : buildHref(p, { pathname, searchParams, pageParam }));
  const suffix = itemLabel ? ` ${itemLabel}` : "";

  return (
    <nav
      aria-label="Paginación"
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600 ${className ?? ""}`}
    >
      <p className="tabular-nums">
        {total > 0 ? (
          <>
            <span className="font-medium text-neutral-900">
              {entero(from)}–{entero(to)}
            </span>{" "}
            de {entero(total)}
            {suffix}
          </>
        ) : (
          "Sin resultados"
        )}
        {pages > 1 ? (
          <span className="sr-only">
            {" "}
            · Página {entero(current)} de {entero(pages)}
          </span>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <ButtonLink
          href={href(current - 1)}
          variant="secondary"
          size="sm"
          disabled={current <= 1}
          icon={<NexoIcon name="chevron-left" />}
        >
          Anterior
        </ButtonLink>
        <ButtonLink href={href(current + 1)} variant="secondary" size="sm" disabled={current >= pages}>
          Siguiente
          <NexoIcon name="chevron-right" />
        </ButtonLink>
      </div>
    </nav>
  );
}
