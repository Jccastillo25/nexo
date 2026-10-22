import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Contexto } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, fechaCorta, type DataTableColumn } from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { cs, datosHasta, etiquetaVendedor, usd } from "@/lib/metas/formato";
import { POR_PAGINA } from "@/lib/metas/listado";
import { aniosDisponibles, diasEntre, esFechaIso, leerAnio, leerPeriodo, nombreMes, periodoActual, rangoMes } from "@/lib/metas/periodo";
import type { FacturaEquipo, FacturaPropia, Facturas, MisFacturas, Vendedor } from "@/lib/metas/tipos";
import { FiltrosFacturas, FiltrosMisFacturas } from "./filtros";

export const metadata: Metadata = {
  title: "Facturas · Presupuesto",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Monto de una factura: tachado si está anulada (se lista pero no suma). */
const monto = (valor: string, anulada: boolean) => (
  <span className={anulada ? "text-neutral-500 line-through" : undefined}>{valor}</span>
);

const estado = (anulada: boolean) =>
  anulada ? <StatusBadge label="Anulada" tone="negative" /> : <span className="text-xs text-neutral-500">Vigente</span>;

/** Columnas comunes a "Facturas" y "Mis facturas"; con `vendedor` se agrega la columna del vendedor. */
function columnas<T extends FacturaPropia>(vendedor?: (f: T) => string): DataTableColumn<T>[] {
  return [
    { key: "fecha", header: "Fecha", className: "whitespace-nowrap tabular-nums", render: (f) => fechaCorta(f.fecha) },
    {
      key: "numero",
      header: "N.º",
      className: "whitespace-nowrap",
      render: (f) => <span className="font-mono text-xs">{f.numero}</span>,
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (f) => (
        <span className="block max-w-[16rem] truncate" title={f.cliente ?? undefined}>
          {f.cliente ?? "—"}
        </span>
      ),
    },
    ...(vendedor
      ? [
          {
            key: "vendedor",
            header: "Vendedor",
            className: "hidden text-neutral-600 md:table-cell",
            render: (f: T) => <span className="block max-w-[14rem] truncate">{vendedor(f)}</span>,
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
    { key: "estado", header: "Estado", render: (f) => estado(f.anulada) },
  ];
}

/** Facturas de todo el equipo (gerente) o solo las propias (vendedor). Sin totales monetarios (H8). */
export default async function FacturasPage({ searchParams }: PageProps<"/facturas">) {
  const [{ supabase, companyId, permisos: p }, params] = await Promise.all([contextoDePagina(), searchParams]);
  if (!p.facturas && !p.misFacturas) redirect("/dashboard");

  const pagina = Math.max(1, Math.floor(Number(texto(params.pagina)) || 1));
  const offset = (pagina - 1) * POR_PAGINA;

  if (!p.facturas) {
    return <MisFacturasVista params={params} pagina={pagina} offset={offset} ctx={{ supabase, companyId }} />;
  }

  // --- Gerente: todas las facturas ---
  // Sin desde/hasta: el mes de ?anio&mes si viene, o el mes actual.
  const mesActual = params.anio || params.mes ? rangoMes(leerPeriodo(params).anio, leerPeriodo(params).mes) : rangoMes(periodoActual().anio, periodoActual().mes);
  const desdeParam = texto(params.desde);
  const hastaParam = texto(params.hasta);
  const desde = esFechaIso(desdeParam) ? desdeParam : mesActual.desde;
  const hasta = esFechaIso(hastaParam) ? hastaParam : mesActual.hasta;
  const vendedorParam = texto(params.vendedor);
  const vendedorId = UUID.test(vendedorParam) ? vendedorParam : "";
  const q = texto(params.q).trim().slice(0, 100);
  const rangoInvalido = hasta < desde
    ? "La fecha final no puede ser anterior a la inicial."
    : diasEntre(desde, hasta) > 400
      ? "El rango máximo es de 400 días. Acorta las fechas."
      : null;
  const conFiltros = !!(desdeParam || hastaParam || vendedorId || q);

  const [listado, vendedoresRes] = await Promise.all([
    rangoInvalido
      ? null
      : supabase.rpc("presupuesto_facturas", {
          p_company_id: companyId,
          p_desde: desde,
          p_hasta: hasta,
          p_vendedor_id: vendedorId || null,
          p_busqueda: q || null,
          p_limite: POR_PAGINA,
          p_offset: offset,
        }),
    supabase.rpc("presupuesto_vendedores", { p_company_id: companyId }),
  ]);
  const data = (listado?.data ?? null) as Facturas | null;
  const vendedores = ((vendedoresRes.data ?? []) as Vendedor[]).map((v) => ({
    id: v.id,
    etiqueta: `${etiquetaVendedor(v.codigo, v.nombre)}${v.activo ? "" : " (inactivo)"}`,
  }));
  const baseVacia = !vendedoresRes.error && vendedores.length === 0;
  // La última factura sale de presupuesto_vendedores (ya consultada): la venta más reciente de cualquier vendedor.
  const ultimaFactura = vendedoresRes.error
    ? undefined
    : ((vendedoresRes.data ?? []) as Vendedor[]).reduce<string | null>(
        (max, v) => (v.ultima_venta && (!max || v.ultima_venta > max) ? v.ultima_venta : max),
        null
      );

  const enlace = (n: number) => {
    const sp = new URLSearchParams({ desde, hasta });
    if (vendedorId) sp.set("vendedor", vendedorId);
    if (q) sp.set("q", q);
    if (n > 1) sp.set("pagina", String(n));
    return `/facturas?${sp.toString()}`;
  };

  const error = rangoInvalido ? (
    <Alert tone="error">{rangoInvalido}</Alert>
  ) : listado?.error || !data ? (
    <Alert tone="error">
      {mensajeUsuario(listado?.error, "presupuesto_facturas", "No se pudieron cargar las facturas. Intenta de nuevo.")}
    </Alert>
  ) : null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Facturas"
        description={`Facturas importadas de AG Negocio. Las anuladas se listan pero no suman a las ventas.${
          ultimaFactura === undefined ? "" : ` ${datosHasta(ultimaFactura)}.`
        }`}
      />
      <DataTable
        caption="Facturas importadas de AG Negocio"
        toolbar={
          <FiltrosFacturas
            key={`${desde}|${hasta}|${vendedorId}|${q}`}
            desde={desde}
            hasta={hasta}
            vendedor={vendedorId}
            q={q}
            vendedores={vendedores}
          />
        }
        columns={columnas<FacturaEquipo>((f) => etiquetaVendedor(f.vendedor_codigo, f.vendedor_nombre))}
        rows={data?.filas ?? []}
        rowKey={(f) => f.numero}
        error={error}
        empty={
          baseVacia ? (
            <EmptyState
              bare
              title="Todavía no hay facturas importadas"
              description="Sube el reporte de facturas de AG Negocio para empezar a medir las metas."
              action={p.importar ? <ButtonLink href="/importar">Ir a Importar</ButtonLink> : null}
            />
          ) : (
            <EmptyState
              bare
              variant="no-results"
              title="No hay facturas con estos filtros"
              description="Prueba con otro rango de fechas, otro vendedor o sin búsqueda."
              action={
                conFiltros ? (
                  <ButtonLink href="/facturas" variant="secondary">
                    Quitar filtros
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        footer={
          data && data.filas.length > 0 ? (
            <Pagination page={pagina} pageSize={POR_PAGINA} total={data.total} hrefForPage={enlace} itemLabel="facturas" />
          ) : undefined
        }
      />
    </div>
  );
}

async function MisFacturasVista({
  params,
  pagina,
  offset,
  ctx,
}: {
  params: Record<string, string | string[] | undefined>;
  pagina: number;
  offset: number;
  ctx: Contexto;
}) {
  const anio = leerAnio(params);
  const mesParam = Number(texto(params.mes));
  // mes=0 → todo el año; sin mes → el actual.
  const mes = mesParam === 0 && texto(params.mes) !== "" ? null : Number.isInteger(mesParam) && mesParam >= 1 && mesParam <= 12 ? mesParam : periodoActual().mes;

  const { data, error } = await ctx.supabase.rpc("presupuesto_mis_facturas", {
    p_company_id: ctx.companyId,
    p_anio: anio,
    p_mes: mes,
    p_limite: POR_PAGINA,
    p_offset: offset,
  });
  const r = data as MisFacturas | null;
  const periodo = mes === null ? `${anio}` : `${nombreMes(mes)} de ${anio}`;
  const enlace = (n: number) => {
    const sp = new URLSearchParams({ anio: String(anio), mes: String(mes ?? 0) });
    if (n > 1) sp.set("pagina", String(n));
    return `/facturas?${sp.toString()}`;
  };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Mis facturas" description="Tus facturas importadas de AG Negocio. Las anuladas se listan pero no suman a tu avance." />
      <DataTable
        caption="Mis facturas importadas de AG Negocio"
        toolbar={<FiltrosMisFacturas anio={anio} mes={mes} anios={aniosDisponibles()} />}
        columns={columnas<FacturaPropia>()}
        rows={r?.vinculado ? r.filas : []}
        rowKey={(f) => f.numero}
        error={
          error || !r ? (
            <Alert tone="error">
              {mensajeUsuario(error, "presupuesto_mis_facturas", "No se pudieron cargar tus facturas. Intenta de nuevo.")}
            </Alert>
          ) : null
        }
        empty={
          r && !r.vinculado ? (
            <EmptyState
              bare
              title="Tu usuario todavía no está vinculado a un vendedor de AG Negocio"
              description="Pide al administrador que te vincule en Configuración > Vendedores y usuarios."
            />
          ) : (
            <EmptyState bare title={`No tienes facturas en ${periodo}`} description="Elige otro mes o “Todo el año”." />
          )
        }
        footer={
          r?.vinculado && r.filas.length > 0 ? (
            <Pagination page={pagina} pageSize={POR_PAGINA} total={r.total} hrefForPage={enlace} itemLabel="facturas" />
          ) : undefined
        }
      />
    </div>
  );
}
