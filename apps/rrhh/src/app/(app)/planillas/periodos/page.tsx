import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, Pagination, StatusBadge, entero, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_PLANILLA } from "@/lib/planilla/estados";
import { esClaveDe } from "@/lib/planilla/etiquetas";
import { esMes, rangoMes } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import type { EstadoPlanilla } from "@/lib/planilla/tipos";
import { CeldaPeriodo, ErrorDeCarga, EstadoPlanillaBadge, SinAccesoPlanilla } from "./compartido";
import { COLUMNAS_LISTA, filasDe, tablasRrhh, tiposDePlanilla, type PlanillaLista } from "./datos";
import { FiltrosPlanillas } from "./filtros";

export const metadata: Metadata = {
  title: "Planillas · RRHH",
};

const TITULO = "Planillas";
const POR_PAGINA = 25;

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Fila sin calcular (borrador): sus totales vienen vacíos. */
function sinCalcular(p: PlanillaLista): boolean {
  return p.estado === "borrador";
}

/**
 * Lista de planillas (B2, planilla.ver): corridas de nómina de cada período,
 * de la más reciente a la más antigua. Filtros en la URL: `estado`, `tipo`
 * (solo con conceptos.ver, que es el permiso que deja ver los tipos), `mes`
 * (por `periodo_fin`) y `pagina` (25 por página). Un filtro inválido se
 * ignora. Los montos son los de `rrhh.planillas.totales` (los guardó la RPC
 * al calcular): la vista no recalcula nada.
 */
export default async function PlanillasListaPage({ searchParams }: PageProps<"/planillas/periodos">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
  }

  const estadoParam = primero(sp.estado);
  const estado: EstadoPlanilla | null = esClaveDe(ESTADO_PLANILLA, estadoParam) ? estadoParam : null;
  const tipoParam = primero(sp.tipo);
  const tipo = permisos.conceptosVer && esUuid(tipoParam) ? tipoParam : null;
  const mesParam = primero(sp.mes);
  const mes = esMes(mesParam) ? mesParam : null;
  const paginaNum = Number(primero(sp.pagina));
  const pagina = Number.isInteger(paginaNum) && paginaNum >= 1 ? paginaNum : 1;

  let consulta = tablasRrhh(ctx)
    .from("planillas")
    .select(COLUMNAS_LISTA, { count: "exact" })
    .eq("company_id", ctx.companyId);
  if (estado) consulta = consulta.eq("estado", estado);
  if (tipo) consulta = consulta.eq("planilla_tipo_id", tipo);
  if (mes) {
    const r = rangoMes(mes);
    consulta = consulta.gte("periodo_fin", r.inicio).lte("periodo_fin", r.fin);
  }

  const [res, tipos] = await Promise.all([
    consulta
      .order("periodo_fin", { ascending: false })
      .order("created_at", { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    permisos.conceptosVer ? tiposDePlanilla(ctx) : Promise.resolve(null),
  ]);

  const filas = filasDe<PlanillaLista>(res, "planillas: listado");
  if (!filas.ok) return <ErrorDeCarga titulo={TITULO} que="las planillas" />;
  const total = typeof res.count === "number" ? res.count : filas.valor.length;

  const listaTipos = tipos && tipos.ok ? tipos.valor : [];
  const tipoPorId = new Map(listaTipos.map((t) => [t.id, t]));
  const hayFiltros = Boolean(estado || tipo || mes);
  const puedeCrear = permisos.planillaGenerar;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={TITULO}
        description="Corridas de nómina de cada período"
        actions={
          puedeCrear ? (
            <ButtonLink href={RUTA.nuevaPlanilla()} icon={<NexoIcon name="plus" />}>
              Nueva planilla
            </ButtonLink>
          ) : null
        }
      />

      <DataTable
        rows={filas.valor}
        rowKey={(p) => p.id}
        rowHref={(p) => RUTA.detalle(p.id)}
        caption="Planillas de la empresa"
        toolbar={
          <FiltrosPlanillas
            estado={estado}
            tipo={tipo}
            mes={mes}
            tipos={permisos.conceptosVer ? listaTipos.map((t) => ({ id: t.id, nombre: t.nombre })) : null}
          />
        }
        empty={
          hayFiltros ? (
            <EmptyState
              bare
              variant="no-results"
              title="No hay planillas con estos filtros"
              action={
                <ButtonLink href={RUTA.periodos()} variant="secondary">
                  Quitar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay planillas"
              description="Crea la primera para el período actual."
              action={
                puedeCrear ? (
                  <ButtonLink href={RUTA.nuevaPlanilla()} variant="secondary" icon={<NexoIcon name="plus" />}>
                    Nueva planilla
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        footer={
          total > POR_PAGINA ? (
            <Pagination
              page={pagina}
              pageSize={POR_PAGINA}
              total={total}
              itemLabel="planillas"
              hrefForPage={(p) =>
                RUTA.periodos({
                  estado: estado ?? undefined,
                  tipo: tipo ?? undefined,
                  mes: mes ?? undefined,
                  pagina: p > 1 ? p : undefined,
                })
              }
            />
          ) : null
        }
        columns={[
          {
            key: "periodo",
            header: "Período",
            render: (p) => (
              <CeldaPeriodo
                inicio={p.periodo_inicio}
                fin={p.periodo_fin}
                frecuencia={tipoPorId.get(p.planilla_tipo_id)?.frecuencia ?? null}
                clase={tipoPorId.get(p.planilla_tipo_id)?.clase ?? null}
              />
            ),
          },
          { key: "tipo", header: "Tipo", render: (p) => tipoPorId.get(p.planilla_tipo_id)?.nombre ?? "—" },
          { key: "estado", header: "Estado", render: (p) => <EstadoPlanillaBadge estado={p.estado} /> },
          {
            key: "personas",
            header: "Personas",
            numeric: true,
            render: (p) => (sinCalcular(p) ? "—" : entero(p.totales?.empleados)),
          },
          {
            key: "neto",
            header: "Neto",
            numeric: true,
            render: (p) =>
              sinCalcular(p) ? (
                <span className="flex flex-col">
                  <span>—</span>
                  <span className="text-xs text-neutral-500">Sin calcular</span>
                </span>
              ) : (
                moneda(p.totales?.neto)
              ),
          },
          {
            key: "costo",
            header: "Costo del empleador",
            numeric: true,
            render: (p) => (sinCalcular(p) ? "—" : moneda(p.totales?.costo_total)),
          },
          { key: "pago", header: "Fecha de pago", render: (p) => <span className="tabular-nums">{fechaCorta(p.fecha_pago)}</span> },
          {
            key: "avisos",
            header: "Avisos",
            render: (p) => {
              const avisos = Array.isArray(p.totales?.avisos) ? p.totales.avisos.length : 0;
              const personas = typeof p.totales?.empleados_con_aviso === "number" ? p.totales.empleados_con_aviso : 0;
              if (avisos === 0 && personas === 0) return "—";
              const texto = [
                avisos > 0 ? `${entero(avisos)} ${avisos === 1 ? "aviso" : "avisos"}` : null,
                personas > 0 ? `${entero(personas)} ${personas === 1 ? "persona" : "personas"}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return <StatusBadge label={texto} tone="warning" />;
            },
          },
        ]}
      />
    </div>
  );
}
