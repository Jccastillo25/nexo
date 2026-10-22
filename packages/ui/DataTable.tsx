// Tabla de listado universal — reemplaza el <table> a mano con clases
// repetidas de cada pagina (ver expedientes/page.tsx antes del rediseño).
// Server Component: la navegacion de fila se resuelve con un <Link> dentro
// de `render` de la columna principal (mismo patron que ya usaba
// expedientes/page.tsx), no con un onClick — o, desde v2, con `rowHref`.
//
// El menu de acciones "⋯" (RowActionsMenu, exportado aparte) es
// deliberadamente NO una prop de esta tabla: sus botones necesitan
// closures con estado (confirmar, mostrar un toast, llamar una server
// action) que solo pueden originarse en un Client Component — pasarlos
// como funciones desde la pagina (Server Component) que arma las filas
// rompe la regla de serializacion de Next.js. La forma correcta es que la
// PAGINA defina una columna cuyo `render` devuelva un pequeño Client
// Component propio (con sus props serializables: ids, booleans) que
// adentro renderiza <RowActionsMenu>. Ver expedientes/page.tsx.
//
// v2 (2026-10-20), compatible con la API anterior:
//   - columnas `numeric` (derecha + tabular-nums), `width` y `truncate`;
//   - encabezado neutral-50, 12px semibold, sin mayusculas, sticky (se
//     pega arriba cuando la tabla tiene `maxHeight` y scroll propio);
//   - `density`: comfortable (py-3, por defecto) o compact (py-2);
//   - ranuras `toolbar` (filtros/busqueda arriba), `empty` (un EmptyState
//     bare), `error` (reemplaza las filas) y `footer` (p. ej. <Pagination>);
//   - `rowHref`: toda la fila se puede clicar. El enlace real (con foco de
//     teclado y nombre accesible) es el contenido de la PRIMERA columna, que
//     por eso no debe traer su propio <Link>; el resto de las celdas lleva
//     un enlace invisible solo para el raton. Botones y enlaces propios de
//     otras celdas (acciones) siguen funcionando por encima.
import Link from "next/link";
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  /** Alinea la columna a la derecha — util para una columna de acciones. */
  align?: "left" | "right";
  /** Cifra: a la derecha y con digitos tabulares. */
  numeric?: boolean;
  /** Ancho CSS de la columna ("12rem", "20%"). */
  width?: string;
  /** Una sola linea con elipsis (conviene darle `width`). */
  truncate?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
  /** Contenido cuando no hay filas (p. ej. <EmptyState bare ... />). Reemplaza a emptyLabel. */
  empty?: ReactNode;
  /** Si se pasa, se muestra en lugar de las filas (p. ej. <Alert tone="error">). */
  error?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  density?: "comfortable" | "compact";
  /** Ruta de la ficha de cada fila (next/link). */
  rowHref?: (row: T) => string | null | undefined;
  /** Titulo de la tabla para lectores de pantalla. */
  caption?: string;
  /** Alto maximo con scroll propio ("70vh"): el encabezado queda fijo. */
  maxHeight?: string;
}

// Los controles propios de una celda quedan por encima del enlace invisible
// de la fila (que esta debajo y recibe el clic del resto de la celda).
const CELL_CONTENT_WITH_ROW_LINK =
  "pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_label]:pointer-events-auto [&_select]:pointer-events-auto [&_summary]:pointer-events-auto [&_textarea]:pointer-events-auto";

function alignClass<T>(col: DataTableColumn<T>): string {
  if (col.numeric) return "text-right tabular-nums";
  return col.align === "right" ? "text-right" : "";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "Todavía no hay datos.",
  empty,
  error,
  toolbar,
  footer,
  density = "comfortable",
  rowHref,
  caption,
  maxHeight,
}: DataTableProps<T>) {
  const cellY = density === "compact" ? "py-2" : "py-3";
  const hasError = error !== undefined && error !== null && error !== false;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">{toolbar}</div>
      ) : null}
      {hasError ? (
        <div className="p-4">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
            <table className="w-full text-left text-sm">
              {caption ? <caption className="sr-only">{caption}</caption> : null}
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={col.width ? { width: col.width } : undefined}
                      className={`sticky top-0 z-[2] border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-neutral-600 ${alignClass(col)} ${col.className ?? ""}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = rowHref?.(row) ?? null;
                  return (
                    <tr
                      key={rowKey(row)}
                      className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${href ? "focus-within:bg-neutral-50" : ""}`}
                    >
                      {columns.map((col, i) => {
                        const content = col.render(row);
                        const tdClass = `px-4 ${cellY} text-neutral-700 ${alignClass(col)} ${col.truncate ? "max-w-0 truncate" : ""} ${col.className ?? ""}`;
                        if (!href) {
                          return (
                            <td key={col.key} className={tdClass}>
                              {content}
                            </td>
                          );
                        }
                        if (i === 0) {
                          return (
                            <td key={col.key} className={`relative ${tdClass}`}>
                              <Link
                                href={href}
                                className={`rounded-sm font-medium text-neutral-900 after:absolute after:inset-0 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${col.truncate ? "block truncate" : ""}`}
                              >
                                {content}
                              </Link>
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className={`relative ${tdClass}`}>
                            <Link
                              href={href}
                              tabIndex={-1}
                              aria-hidden="true"
                              prefetch={false}
                              className="absolute inset-0"
                            />
                            <div className={`${CELL_CONTENT_WITH_ROW_LINK} ${col.truncate ? "truncate" : ""}`}>
                              {content}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0
            ? (empty ?? <p className="px-4 py-10 text-center text-sm text-neutral-500">{emptyLabel}</p>)
            : null}
        </>
      )}
      {footer ? <div className="border-t border-neutral-200 px-4 py-3">{footer}</div> : null}
    </div>
  );
}
