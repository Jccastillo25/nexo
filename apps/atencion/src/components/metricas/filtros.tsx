import Link from "next/link";
import { PERIODOS, type Periodo } from "@/lib/metricas";

const chip = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const activo = "bg-blue-600 text-white";
const inactivo = "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50";

/**
 * Filtros en una fila sobre los datos: período y, en reportes, sucursal.
 * Son links (sin estado en el navegador): cada filtro es una URL compartible.
 */
export default function FiltrosMetricas({
  ruta,
  periodo,
  sucursal,
  sucursales,
}: {
  ruta: string;
  periodo: Periodo;
  sucursal?: string | null;
  sucursales?: { id: string; nombre: string }[];
}) {
  const query = (cambios: Record<string, string | null>) => {
    const q: Record<string, string> = { periodo };
    if (sucursal) q.sucursal = sucursal;
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) delete q[k];
      else q[k] = v;
    }
    return { pathname: ruta, query: q };
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Período</span>
        {PERIODOS.map((p) => (
          <Link
            key={p.valor}
            href={query({ periodo: p.valor })}
            aria-current={p.valor === periodo ? "true" : undefined}
            className={`${chip} ${p.valor === periodo ? activo : inactivo}`}
          >
            {p.etiqueta}
          </Link>
        ))}
      </div>
      {sucursales && sucursales.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sucursal">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sucursal</span>
          <Link href={query({ sucursal: null })} className={`${chip} ${!sucursal ? activo : inactivo}`}>
            Todas
          </Link>
          {sucursales.map((s) => (
            <Link key={s.id} href={query({ sucursal: s.id })} className={`${chip} ${sucursal === s.id ? activo : inactivo}`}>
              {s.nombre}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
