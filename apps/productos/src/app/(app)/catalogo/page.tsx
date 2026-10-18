import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission, mensajeDeError } from "@nexo/permissions";
import { PageHeader, StatusBadge } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import { formatoCosto } from "@/lib/formato";
import type { Catalogos, Listado } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Productos · Productos",
};

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Listado con búsqueda (nombre, código, código de barras o ID) y filtros por clase y estado. */
export default async function CatalogoPage({ searchParams }: PageProps<"/catalogo">) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const clase = typeof params.clase === "string" ? params.clase : "";
  const estado = typeof params.estado === "string" ? params.estado : "";
  const pagina = Math.max(1, Number(typeof params.pagina === "string" ? params.pagina : 1) || 1);

  const [listado, catalogos, puedeCrear] = await Promise.all([
    supabase.rpc("productos_listar", {
      p_company_id: companyId,
      p_buscar: q || null,
      p_clase_id: clase || null,
      p_estado: estado || null,
      p_limite: POR_PAGINA,
      p_desde: (pagina - 1) * POR_PAGINA,
    }),
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    hasPermission(ctx, P.crear),
  ]);
  const data = listado.data as Listado | null;
  const clases = ((catalogos.data as Catalogos | null)?.clasificaciones ?? []).filter((c) => c.nivel === "clase");
  const paginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1;

  const enlace = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (clase) sp.set("clase", clase);
    if (estado) sp.set("estado", estado);
    if (n > 1) sp.set("pagina", String(n));
    const s = sp.toString();
    return s ? `/catalogo?${s}` : "/catalogo";
  };

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Productos"
        description={data ? `${data.total} productos${q || clase || estado ? " con este filtro" : ""}.` : undefined}
        actions={
          puedeCrear ? (
            <Link href="/catalogo/nuevo" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Nuevo producto
            </Link>
          ) : null
        }
      />

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <form method="get" className="flex flex-wrap gap-2 border-b border-neutral-200 p-3">
          <label className="sr-only" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre, código, ID o código de barras" className={`${inputClass} min-w-0 flex-1 basis-64`} />
          <label className="sr-only" htmlFor="clase">Clase</label>
          <select id="clase" name="clase" defaultValue={clase} className={inputClass}>
            <option value="">Todas las clases</option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.nombre}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado} className={inputClass}>
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="sin_clasificar">Sin clasificar</option>
            <option value="descontinuados">Descontinuados</option>
          </select>
          <button type="submit" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Filtrar
          </button>
        </form>

        {listado.error ? (
          <p role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensajeDeError(listado.error, "productos_listar", "No se pudo cargar el listado. Intenta de nuevo.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Clasificación</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Unidad</th>
                  {data?.costo_visible && <th className="px-4 py-2.5 text-right">Costo</th>}
                  <th className="px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(data?.filas ?? []).map((f) => (
                  <tr key={f.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 tabular-nums text-neutral-500">{f.numero_id}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                      <Link href={`/catalogo/${f.id}`} className="hover:text-blue-700">{f.codigo}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/catalogo/${f.id}`} className="font-medium text-neutral-900 hover:text-blue-700">{f.nombre}</Link>
                      {f.marca && <div className="text-xs text-neutral-500">{f.marca}</div>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-neutral-500 md:table-cell">
                      {f.es_servicio ? "Servicio" : f.clasificacion || <StatusBadge label="Sin clasificar" tone="warning" />}
                    </td>
                    <td className="hidden px-4 py-2.5 text-neutral-600 md:table-cell">{f.unidad}</td>
                    {data?.costo_visible && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatoCosto(f.costo, f.costo_moneda)}</td>
                    )}
                    <td className="px-4 py-2.5">
                      {f.descontinuado_ventas ? (
                        <StatusBadge label="Descontinuado" tone="neutral" />
                      ) : f.sin_clasificacion && !f.es_servicio ? (
                        <StatusBadge label="Sin clasificar" tone="warning" />
                      ) : data?.costo_visible && !f.es_servicio && (f.costo === null || f.costo <= 1) ? (
                        <StatusBadge label="Sin costo" tone="warning" />
                      ) : (
                        <StatusBadge label="Activo" tone="positive" />
                      )}
                    </td>
                  </tr>
                ))}
                {data && data.filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      {q || clase || estado ? (
                        "No hay productos con ese filtro."
                      ) : (
                        <>
                          El catálogo está vacío.{" "}
                          <Link href="/importar" className="font-semibold text-blue-600 hover:text-blue-700">
                            Importa los Excel del ERP
                          </Link>{" "}
                          para cargar el catálogo.
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-sm">
            <span className="text-neutral-500">
              Página {pagina} de {paginas}
            </span>
            <div className="flex gap-2">
              {pagina > 1 && <Link href={enlace(pagina - 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50">Anterior</Link>}
              {pagina < paginas && <Link href={enlace(pagina + 1)} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50">Siguiente</Link>}
            </div>
          </div>
        )}
      </div>

      {data && !data.costo_visible && (
        <p className="text-xs text-neutral-500">El costo no aparece porque tu rol no incluye “Ver costo”.</p>
      )}
    </div>
  );
}
