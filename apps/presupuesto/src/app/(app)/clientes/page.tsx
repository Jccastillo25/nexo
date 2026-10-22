import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Alert,
  ButtonLink,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Pagination,
  entero,
  fechaCorta,
  type DataTableColumn,
} from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { etiquetaVendedor, haceDias, usd } from "@/lib/metas/formato";
import { POR_PAGINA } from "@/lib/metas/listado";
import type { ClienteResumen, Clientes, Vendedor } from "@/lib/metas/tipos";
import { FiltrosClientes } from "./filtros";

export const metadata: Metadata = {
  title: "Clientes · Presupuesto",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDENES = new Set(["reciente", "monto", "nombre"]);
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/**
 * Clientes del vendedor (pedido del usuario 2026-10-20): con qué frecuencia y
 * cuánto se les factura y cuándo fue la última vez. Con factura.ver se ven
 * todos los vendedores; solo con factura_propia.ver, únicamente los clientes
 * del vendedor vinculado al usuario (lo decide public.presupuesto_clientes).
 */
export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const [{ supabase, companyId, permisos: p }, params] = await Promise.all([contextoDePagina(), searchParams]);
  if (!p.facturas && !p.misFacturas) redirect("/dashboard");
  const todos = p.facturas;

  const pagina = Math.max(1, Math.floor(Number(texto(params.pagina)) || 1));
  const q = texto(params.q).trim().slice(0, 100);
  const ordenParam = texto(params.orden);
  const orden = ORDENES.has(ordenParam) ? ordenParam : "reciente";
  const vendedorParam = texto(params.vendedor);
  const vendedorId = todos && UUID.test(vendedorParam) ? vendedorParam : "";

  const [res, vendedoresRes] = await Promise.all([
    supabase.rpc("presupuesto_clientes", {
      p_company_id: companyId,
      p_vendedor_id: vendedorId || null,
      p_busqueda: q || null,
      p_orden: orden,
      p_limite: POR_PAGINA,
      p_offset: (pagina - 1) * POR_PAGINA,
    }),
    todos ? supabase.rpc("presupuesto_vendedores", { p_company_id: companyId }) : null,
  ]);
  const data = (res.data ?? null) as Clientes | null;
  const vendedores = vendedoresRes && !vendedoresRes.error
    ? ((vendedoresRes.data ?? []) as Vendedor[]).map((v) => ({
        id: v.id,
        etiqueta: `${etiquetaVendedor(v.codigo, v.nombre)}${v.activo ? "" : " (inactivo)"}`,
      }))
    : todos
      ? []
      : null;
  const titulo = todos ? "Clientes" : "Mis clientes";
  const conFiltros = !!(q || vendedorId || orden !== "reciente");

  const enlace = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (orden !== "reciente") sp.set("orden", orden);
    if (vendedorId) sp.set("vendedor", vendedorId);
    if (n > 1) sp.set("pagina", String(n));
    const qs = sp.toString();
    return qs ? `/clientes?${qs}` : "/clientes";
  };
  const detalle = (cliente: string) => {
    const sp = new URLSearchParams({ cliente });
    if (vendedorId) sp.set("vendedor", vendedorId);
    return `/clientes/detalle?${sp.toString()}`;
  };

  if (res.error || !data) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={titulo} />
        <Alert tone="error">
          {mensajeUsuario(res.error, "presupuesto_clientes", "No se pudieron cargar los clientes. Intenta de nuevo.")}
        </Alert>
      </div>
    );
  }

  if (!data.vinculado) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={titulo} />
        <EmptyState
          title="Tu usuario todavía no está vinculado a un vendedor de AG Negocio"
          description="Cuando el administrador te vincule en Configuración > Vendedores y usuarios, aquí verás tus clientes."
          action={p.vendedores ? <ButtonLink href="/configuracion/vendedores">Vincular vendedores</ButtonLink> : null}
        />
      </div>
    );
  }

  const vendedorFiltrado = vendedorId ? vendedores?.find((v) => v.id === vendedorId)?.etiqueta : null;

  const columnas: DataTableColumn<ClienteResumen>[] = [
    {
      key: "cliente",
      header: "Cliente",
      render: (c) => (
        <span className="block max-w-[18rem] truncate font-medium text-neutral-900" title={c.cliente}>
          {c.cliente}
        </span>
      ),
    },
    {
      key: "ultima",
      header: "Última factura",
      className: "whitespace-nowrap",
      render: (c) => (
        <>
          <span className="tabular-nums">{fechaCorta(c.ultima_fecha)}</span>
          <span className="ml-1.5 text-xs text-neutral-500">{haceDias(c.dias_desde)}</span>
        </>
      ),
    },
    {
      key: "ultimoMonto",
      header: "Último monto",
      numeric: true,
      className: "hidden whitespace-nowrap md:table-cell",
      render: (c) => usd(c.ultimo_usd),
    },
    {
      key: "facturas",
      header: "Facturas",
      numeric: true,
      className: "hidden whitespace-nowrap sm:table-cell",
      render: (c) => entero(c.facturas),
    },
    {
      key: "anio",
      header: "Este año",
      numeric: true,
      className: "hidden whitespace-nowrap lg:table-cell",
      render: (c) => usd(c.usd_anio),
    },
    { key: "total", header: "Total", numeric: true, className: "whitespace-nowrap", render: (c) => usd(c.total_usd) },
    ...(todos
      ? [
          {
            key: "ultimaPor",
            header: "Última por",
            className: "hidden text-neutral-600 xl:table-cell",
            render: (c: ClienteResumen) => (
              <span className="block max-w-[12rem] truncate">
                {c.ultimo_vendedor ? etiquetaVendedor(c.ultimo_vendedor.codigo, c.ultimo_vendedor.nombre) : "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "detalle",
      header: <span className="sr-only">Detalle</span>,
      align: "right",
      className: "whitespace-nowrap",
      render: (c) => (
        <ButtonLink variant="link" href={detalle(c.cliente)}>
          Ver facturas<span className="sr-only"> de {c.cliente}</span>
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={titulo}
        description={
          todos
            ? `A quién se le factura, cuánto y cuándo fue la última vez${vendedorFiltrado ? ` · ${vendedorFiltrado}` : ""}. Las anuladas no cuentan.`
            : "A quién le facturas, cuánto y cuándo fue la última vez. Las anuladas no cuentan."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label={todos && !vendedorId ? "Última factura de la empresa" : todos ? "Última factura del vendedor" : "Tu última factura"}
          value={data.ultima_factura ? fechaCorta(data.ultima_factura) : "—"}
          tone={data.ultima_factura ? "neutral" : "pending"}
          hint={data.ultima_factura ? "Según las facturas importadas de AG Negocio" : "Sin facturas importadas"}
        />
        <MetricCard
          label={q ? "Clientes que coinciden" : "Clientes"}
          value={entero(data.total)}
          hint="Con al menos una factura vigente"
        />
      </div>

      <DataTable
        caption={`${titulo}: última factura, número de facturas y total facturado`}
        toolbar={<FiltrosClientes key={`${q}|${orden}|${vendedorId}`} q={q} orden={orden} vendedor={vendedorId} vendedores={vendedores} />}
        columns={columnas}
        rows={data.filas}
        rowKey={(c) => c.cliente}
        empty={
          <EmptyState
            bare
            variant={conFiltros ? "no-results" : "empty"}
            title={conFiltros ? "No hay clientes con estos filtros" : "Todavía no hay clientes"}
            description={
              conFiltros ? "Prueba con otro nombre u otro vendedor." : "Los clientes salen de las facturas importadas de AG Negocio."
            }
            action={
              conFiltros ? (
                <ButtonLink href="/clientes" variant="secondary">
                  Quitar filtros
                </ButtonLink>
              ) : null
            }
          />
        }
        footer={
          data.filas.length > 0 ? (
            <Pagination page={pagina} pageSize={POR_PAGINA} total={data.total} hrefForPage={enlace} itemLabel="clientes" />
          ) : undefined
        }
      />
    </div>
  );
}
