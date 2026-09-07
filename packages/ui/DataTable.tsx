// Tabla de listado universal — reemplaza el <table> a mano con clases
// repetidas de cada pagina (ver expedientes/page.tsx antes del rediseño).
// Server Component: la navegacion de fila se resuelve con un <Link> dentro
// de `render` de la columna principal (mismo patron que ya usaba
// expedientes/page.tsx), no con un onClick.
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
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Alinea la columna a la derecha — util para una columna de acciones. */
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyLabel = "Todavía no hay datos." }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium ${col.align === "right" ? "text-right" : ""} ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-neutral-700 ${col.align === "right" ? "text-right" : ""} ${col.className ?? ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-neutral-400">{emptyLabel}</p>}
    </div>
  );
}
