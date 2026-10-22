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
  StatusBadge,
  entero,
  fechaCorta,
  type DataTableColumn,
} from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { cs, etiquetaVendedor, haceDias, usd } from "@/lib/metas/formato";
import { POR_PAGINA } from "@/lib/metas/listado";
import { diasEntre, hoyManagua } from "@/lib/metas/periodo";
import type { FacturaDeCliente, FacturasCliente } from "@/lib/metas/tipos";

export const metadata: Metadata = {
  title: "Facturas del cliente · Presupuesto",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Monto de una factura: tachado si está anulada (se lista pero no suma). */
const monto = (valor: string, anulada: boolean) => (
  <span className={anulada ? "text-neutral-500 line-through" : undefined}>{valor}</span>
);

/**
 * Lo facturado a un cliente (public.presupuesto_facturas_cliente). El vendedor
 * sin factura.ver solo ve sus propias facturas a ese cliente, aunque cambie
 * ?vendedor= en la URL: la RPC lo ignora.
 */
export default async function DetalleClientePage({ searchParams }: PageProps<"/clientes/detalle">) {
  const [{ supabase, companyId, permisos: p }, params] = await Promise.all([contextoDePagina(), searchParams]);
  if (!p.facturas && !p.misFacturas) redirect("/dashboard");
  const todos = p.facturas;

  const cliente = texto(params.cliente).trim().slice(0, 200);
  if (!cliente) redirect("/clientes");
  const pagina = Math.max(1, Math.floor(Number(texto(params.pagina)) || 1));
  const vendedorParam = texto(params.vendedor);
  const vendedorId = todos && UUID.test(vendedorParam) ? vendedorParam : "";

  const { data: raw, error } = await supabase.rpc("presupuesto_facturas_cliente", {
    p_company_id: companyId,
    p_cliente: cliente,
    p_vendedor_id: vendedorId || null,
    p_limite: POR_PAGINA,
    p_offset: (pagina - 1) * POR_PAGINA,
  });
  const data = (raw ?? null) as FacturasCliente | null;

  const volver = vendedorId ? `/clientes?vendedor=${vendedorId}` : "/clientes";
  const enlace = (n: number) => {
    const sp = new URLSearchParams({ cliente });
    if (vendedorId) sp.set("vendedor", vendedorId);
    if (n > 1) sp.set("pagina", String(n));
    return `/clientes/detalle?${sp.toString()}`;
  };
  const accionVolver = (
    <ButtonLink href={volver} variant="secondary">
      {todos ? "Volver a Clientes" : "Volver a Mis clientes"}
    </ButtonLink>
  );

  if (error || !data) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={cliente} actions={accionVolver} />
        <Alert tone="error">
          {mensajeUsuario(error, "presupuesto_facturas_cliente", "No se pudieron cargar las facturas del cliente. Intenta de nuevo.")}
        </Alert>
      </div>
    );
  }

  const ultima = data.ultima_fecha;
  const dias = ultima ? Math.max(0, diasEntre(ultima, hoyManagua())) : null;
  const ticket = data.facturas > 0 ? Number(data.total_usd) / data.facturas : null;

  const columnas: DataTableColumn<FacturaDeCliente>[] = [
    { key: "fecha", header: "Fecha", className: "whitespace-nowrap tabular-nums", render: (f) => fechaCorta(f.fecha) },
    {
      key: "numero",
      header: "N.º",
      className: "whitespace-nowrap",
      render: (f) => <span className="font-mono text-xs">{f.numero}</span>,
    },
    ...(todos
      ? [
          {
            key: "vendedor",
            header: "Vendedor",
            className: "hidden text-neutral-600 md:table-cell",
            render: (f: FacturaDeCliente) => (
              <span className="block max-w-[14rem] truncate">
                {f.vendedor ? etiquetaVendedor(f.vendedor.codigo, f.vendedor.nombre) : "—"}
              </span>
            ),
          },
        ]
      : []),
    { key: "usd", header: "US$", numeric: true, className: "whitespace-nowrap", render: (f) => monto(usd(f.total_usd), f.anulada) },
    {
      key: "cs",
      header: "C$",
      numeric: true,
      className: "hidden whitespace-nowrap sm:table-cell",
      render: (f) => monto(cs(f.total_cs), f.anulada),
    },
    {
      key: "estado",
      header: "Estado",
      render: (f) =>
        f.anulada ? <StatusBadge label="Anulada" tone="negative" /> : <span className="text-xs text-neutral-500">Vigente</span>,
    },
  ];

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={cliente}
        description={todos ? "Facturas a este cliente." : "Lo que le has facturado a este cliente."}
        actions={accionVolver}
      />

      {!data.vinculado ? (
        <EmptyState
          title="Tu usuario todavía no está vinculado a un vendedor de AG Negocio"
          description="Pide al administrador que te vincule en Configuración > Vendedores y usuarios."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Última factura"
              value={ultima ? fechaCorta(ultima) : "—"}
              tone={ultima ? "neutral" : "pending"}
              hint={dias === null ? "Sin facturas vigentes" : haceDias(dias)}
            />
            <MetricCard label="Total facturado" value={usd(data.total_usd)} hint={cs(data.total_cs)} />
            <MetricCard
              label="Facturas"
              value={entero(data.facturas)}
              hint={data.anuladas > 0 ? `${entero(data.anuladas)} anuladas no cuentan` : "Vigentes"}
            />
            <MetricCard
              label="Ticket promedio"
              value={ticket === null ? "—" : usd(ticket)}
              hint={data.primera_fecha ? `Cliente desde el ${fechaCorta(data.primera_fecha)}` : undefined}
            />
          </div>

          <section aria-labelledby="facturas-cliente" className="flex flex-col gap-3">
            <h2 id="facturas-cliente" className="text-sm font-semibold text-neutral-900">
              Facturas
            </h2>
            <DataTable
              columns={columnas}
              rows={data.filas}
              rowKey={(f) => f.numero}
              empty={
                <EmptyState
                  bare
                  title={todos ? "No hay facturas a este cliente" : "No le has facturado a este cliente"}
                  description="Revisa el nombre o vuelve a la lista de clientes."
                  action={
                    <ButtonLink href={volver} variant="link">
                      Volver
                    </ButtonLink>
                  }
                />
              }
              footer={
                data.filas.length > 0 ? (
                  <Pagination page={pagina} pageSize={POR_PAGINA} total={data.total} hrefForPage={enlace} itemLabel="facturas" />
                ) : undefined
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
