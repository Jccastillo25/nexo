import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { mensajeDeError } from "@nexo/permissions";
import {
  Alert,
  Button,
  ButtonLink,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  entero,
  moneda,
  type DataTableColumn,
} from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import type { Catalogos, FilaProducto, Listado } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Productos · Productos",
};

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

/** Listado con búsqueda (nombre, código, código de barras o ID) y filtros por clase y estado. */
export default async function CatalogoPage({ searchParams }: PageProps<"/catalogo">) {
  const [{ supabase, companyId }, params] = await Promise.all([contextoActual(), searchParams]);
  const q = typeof params.q === "string" ? params.q : "";
  const clase = typeof params.clase === "string" ? params.clase : "";
  const estado = typeof params.estado === "string" ? params.estado : "";
  const pagina = Math.max(1, Number(typeof params.pagina === "string" ? params.pagina : 1) || 1);
  const hayFiltro = Boolean(q || clase || estado);

  const [listado, catalogos, permisos] = await Promise.all([
    supabase.rpc("productos_listar", {
      p_company_id: companyId,
      p_buscar: q || null,
      p_clase_id: clase || null,
      p_estado: estado || null,
      p_limite: POR_PAGINA,
      p_desde: (pagina - 1) * POR_PAGINA,
    }),
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    permisosDe(),
  ]);
  const data = listado.data as Listado | null;
  const clases = ((catalogos.data as Catalogos | null)?.clasificaciones ?? []).filter((c) => c.nivel === "clase");
  const costoVisible = data?.costo_visible ?? false;

  // Catálogo vacío (sin filtros): importar es el primer paso y la acción principal.
  const catalogoVacio = !listado.error && data !== null && data.total === 0 && !hayFiltro;
  const importarEsPrincipal = catalogoVacio && permisos.importar;

  // Primera página con los mismos filtros (para salir de una página fuera de rango).
  const filtros = new URLSearchParams();
  if (q) filtros.set("q", q);
  if (clase) filtros.set("clase", clase);
  if (estado) filtros.set("estado", estado);
  const primeraPagina = filtros.toString() ? `/catalogo?${filtros.toString()}` : "/catalogo";

  const columnas: DataTableColumn<FilaProducto>[] = [
    {
      key: "id",
      header: "ID",
      numeric: true,
      width: "5.5rem",
      // Primera columna = enlace de la fila: el nombre del producto completa su nombre accesible.
      render: (f) => (
        <>
          {f.numero_id}
          <span className="sr-only">, {f.nombre}</span>
        </>
      ),
    },
    {
      key: "codigo",
      header: "Código",
      render: (f) => <span className="font-mono text-xs whitespace-nowrap">{f.codigo}</span>,
    },
    {
      key: "producto",
      header: "Producto",
      render: (f) => (
        <>
          <span className="font-medium text-neutral-900">{f.nombre}</span>
          {f.marca ? <span className="block text-xs text-neutral-500">{f.marca}</span> : null}
        </>
      ),
    },
    {
      key: "clasificacion",
      header: "Clasificación",
      className: "hidden md:table-cell",
      render: (f) =>
        f.es_servicio ? (
          <span className="text-xs text-neutral-500">Servicio</span>
        ) : f.clasificacion ? (
          <span className="text-xs text-neutral-500">{f.clasificacion}</span>
        ) : (
          <StatusBadge label="Sin clasificar" tone="warning" />
        ),
    },
    {
      key: "unidad",
      header: "Unidad",
      className: "hidden md:table-cell",
      render: (f) => <span className="text-neutral-600">{f.unidad ?? "—"}</span>,
    },
    ...(costoVisible
      ? [
          {
            key: "costo",
            header: "Costo",
            numeric: true,
            render: (f: FilaProducto) => (
              <span className="whitespace-nowrap">{moneda(f.costo, f.costo_moneda ?? "NIO")}</span>
            ),
          },
        ]
      : []),
    {
      key: "estado",
      header: "Estado",
      render: (f) =>
        f.descontinuado_ventas ? (
          <StatusBadge label="Descontinuado" tone="neutral" />
        ) : f.sin_clasificacion && !f.es_servicio ? (
          <StatusBadge label="Sin clasificar" tone="warning" />
        ) : costoVisible && !f.es_servicio && (f.costo === null || f.costo <= 1) ? (
          <StatusBadge label="Sin costo" tone="warning" />
        ) : (
          <StatusBadge label="Activo" tone="positive" />
        ),
    },
  ];

  const filtro = (
    <form method="get" role="search" aria-label="Filtrar productos" className="flex w-full flex-wrap items-center gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Buscar por nombre, código, ID o código de barras"
        aria-label="Buscar productos"
        className="flex-1 basis-64"
      />
      <Select name="clase" defaultValue={clase} aria-label="Clase" className="sm:w-56">
        <option value="">Todas las clases</option>
        {clases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.numero} · {c.nombre}
          </option>
        ))}
      </Select>
      <Select name="estado" defaultValue={estado} aria-label="Estado" className="sm:w-44">
        <option value="">Todos los estados</option>
        <option value="activos">Activos</option>
        <option value="sin_clasificar">Sin clasificar</option>
        <option value="descontinuados">Descontinuados</option>
      </Select>
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
      {hayFiltro ? (
        <ButtonLink href="/catalogo" variant="ghost">
          Quitar filtros
        </ButtonLink>
      ) : null}
    </form>
  );

  const vacio =
    data && data.total > 0 ? (
      // Hay productos, pero la página pedida queda fuera de rango.
      <EmptyState
        bare
        variant="no-results"
        title="Esta página no tiene productos"
        description="El listado tiene menos páginas. Vuelve a la primera."
        action={
          <ButtonLink href={primeraPagina} variant="secondary">
            Ir a la primera página
          </ButtonLink>
        }
      />
    ) : hayFiltro ? (
      <EmptyState
        bare
        variant="no-results"
        title="No hay productos con estos filtros"
        action={
          <ButtonLink href="/catalogo" variant="secondary">
            Quitar filtros
          </ButtonLink>
        }
      />
    ) : (
      <EmptyState
        bare
        title="El catálogo está vacío"
        description={
          permisos.importar
            ? "Importa los Excel del ERP para cargar el catálogo de una vez."
            : "Todavía no hay productos registrados."
        }
        action={permisos.importar ? <ButtonLink href="/importar">Importar catálogo</ButtonLink> : undefined}
      />
    );

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Productos"
        description={
          data ? `${entero(data.total)} productos${hayFiltro ? " con este filtro" : ""}.` : undefined
        }
        actions={
          permisos.crear ? (
            <ButtonLink href="/catalogo/nuevo" variant={importarEsPrincipal ? "secondary" : "primary"}>
              Nuevo producto
            </ButtonLink>
          ) : null
        }
      />

      <DataTable
        caption="Productos del catálogo"
        columns={columnas}
        rows={data?.filas ?? []}
        rowKey={(f) => f.id}
        rowHref={(f) => `/catalogo/${f.id}`}
        toolbar={filtro}
        error={
          listado.error ? (
            <Alert tone="error" title="No se pudo cargar el listado">
              {mensajeDeError(listado.error, "productos_listar", "Intenta de nuevo en unos minutos.")}
            </Alert>
          ) : undefined
        }
        empty={vacio}
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={pagina}
              pageSize={POR_PAGINA}
              total={data.total}
              pathname="/catalogo"
              searchParams={params}
              itemLabel="productos"
            />
          ) : undefined
        }
      />

      {data && !costoVisible ? (
        <p className="text-xs text-neutral-500">El costo no aparece porque tu rol no incluye “Ver costo”.</p>
      ) : null}
    </div>
  );
}
