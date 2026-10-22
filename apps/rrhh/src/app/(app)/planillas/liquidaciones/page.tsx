import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { ESTADO_LIQUIDACION, estadoVisual } from "@/lib/planilla/estados";
import { CAUSA_LIQUIDACION_TODAS, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import type { EstadoLiquidacion, LiquidacionFila } from "@/lib/planilla/tipos";
import { CeldaPersona } from "./_compartido/celdas";
import { FalloLectura, SinAcceso } from "./_compartido/fallo-lectura";
import { FiltrosUrl } from "./_compartido/filtros-url";

export const metadata: Metadata = {
  title: "Liquidaciones · RRHH",
};

const ACCESO = { pantalla: "Liquidaciones", permiso: "Ver liquidaciones" };

/**
 * Liquidaciones (C6), con liquidaciones.ver. Fuente:
 * planilla_liquidaciones_listado (totales guardados de cada liquidación). El
 * filtro de estado vive en la URL y se aplica en el servidor sobre las filas.
 * Cada fila abre el documento. El neto va en la 2.ª columna para que se vea
 * en el celular.
 */
export default async function LiquidacionesPage({ searchParams }: PageProps<"/planillas/liquidaciones">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);

  if (!permisos.liquidacionesVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Liquidaciones" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const estadoParam = Array.isArray(sp.estado) ? sp.estado[0] : sp.estado;
  const estado: EstadoLiquidacion | null = esClaveDe(ESTADO_LIQUIDACION, estadoParam) ? estadoParam : null;
  const puedeSimular = permisos.liquidacionesCalcular;

  const encabezado = (
    <PageHeader
      title="Liquidaciones"
      description="Liquidación final de cada contrato que termina: se prepara, la aprueba otra persona y se paga."
      actions={
        puedeSimular ? (
          <ButtonLink href={RUTA.simuladorLiquidacion()} icon={<NexoIcon name="sliders" />}>
            Simular liquidación
          </ButtonLink>
        ) : null
      }
    />
  );

  const listadoR = await consultarRpc<LiquidacionFila[]>(ctx, "planilla_liquidaciones_listado", {}, "planilla_liquidaciones_listado");
  if (!listadoR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={listadoR} titulo="No se pudieron cargar las liquidaciones" acceso={ACCESO} />
      </div>
    );
  }

  const todas = Array.isArray(listadoR.valor) ? listadoR.valor : [];
  const filas = estado ? todas.filter((l) => l.estado === estado) : todas;
  const ruta = RUTA.liquidaciones();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      <DataTable
        caption={estado ? `Liquidaciones en estado ${ESTADO_LIQUIDACION[estado].label.toLowerCase()}` : "Liquidaciones"}
        rows={filas}
        rowKey={(l) => l.id}
        rowHref={(l) => RUTA.liquidacion(l.id)}
        toolbar={
          <FiltrosUrl
            ruta={ruta}
            etiqueta="Filtros de liquidaciones"
            campos={[
              {
                nombre: "estado",
                label: "Estado",
                valor: estado ?? "",
                todos: "Todos",
                ancho: "w-full sm:w-48",
                opciones: (Object.keys(ESTADO_LIQUIDACION) as EstadoLiquidacion[]).map((e) => ({
                  valor: e,
                  etiqueta: ESTADO_LIQUIDACION[e].label,
                })),
              },
            ]}
          />
        }
        empty={
          estado ? (
            <EmptyState
              bare
              variant="no-results"
              title={`No hay liquidaciones en estado ${ESTADO_LIQUIDACION[estado].label.toLowerCase()}`}
              action={
                <ButtonLink href={ruta} variant="secondary">
                  Quitar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay liquidaciones"
              description="Simula una liquidación para ver los montos antes de prepararla."
              action={
                puedeSimular ? (
                  <ButtonLink href={RUTA.simuladorLiquidacion()} variant="secondary">
                    Simular liquidación
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        columns={[
          {
            key: "persona",
            header: "Persona",
            render: (l) => <CeldaPersona nombre={l.empleado_nombre} numero={l.numero_contrato} />,
          },
          {
            key: "neto",
            header: "Neto",
            numeric: true,
            render: (l) => <span className="font-semibold text-neutral-900">{moneda(l.neto)}</span>,
          },
          {
            key: "estado",
            header: "Estado",
            render: (l) => {
              const e = estadoVisual(ESTADO_LIQUIDACION, l.estado);
              return <StatusBadge label={e.label} tone={e.tone} />;
            },
          },
          { key: "egreso", header: "Fecha de egreso", render: (l) => <span className="tabular-nums">{fechaCorta(l.fecha_egreso)}</span> },
          { key: "causa", header: "Causa", render: (l) => etiqueta(CAUSA_LIQUIDACION_TODAS, l.causa) },
          { key: "devengado", header: "Devengado", numeric: true, render: (l) => moneda(l.total_devengado) },
          { key: "deducciones", header: "Deducciones", numeric: true, render: (l) => moneda(l.total_deducciones) },
          { key: "calculada", header: "Calculada", render: (l) => <span className="tabular-nums">{fechaCorta(l.calculada_en)}</span> },
          { key: "aprobada", header: "Aprobada", render: (l) => <span className="tabular-nums">{fechaCorta(l.aprobada_en)}</span> },
        ]}
      />
    </div>
  );
}
