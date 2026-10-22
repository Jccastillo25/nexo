import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, DataTable, EmptyState, MetricCard, PageHeader, StatusBadge, entero, moneda, type DataTableColumn } from "@nexo/ui";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { hoyManagua } from "@/lib/fecha-managua";
import { permisosDe } from "@/lib/permisos-rrhh";
import { esAutorDePlanilla, hayAvisosContador } from "@/lib/planilla/estados";
import { REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, num } from "@/lib/planilla/formato";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { usuarioActualId } from "@/lib/planilla/servidor";
import type { Renglon } from "@/lib/planilla/tipos";
import { ErrorDeCarga, SinAccesoPlanilla } from "../compartido";
import { detallePlanilla } from "../datos";
import { AccionesPlanilla, AccionesPlanillaProvider, BotonCalcularPlanilla, ErrorAccionPlanilla } from "./acciones-planilla";
import { AvisosEstadoPlanilla } from "./avisos-estado";
import { EncabezadoPlanilla, tituloPlanilla } from "./encabezado";

export const metadata: Metadata = {
  title: "Planilla · RRHH",
};

const TITULO = "Planilla";

/**
 * Detalle de una planilla (B4, planilla.ver), pestaña Personas. Fuente:
 * `planilla_detalle` (fila completa de la planilla con tipo, empresa y
 * renglones). Los montos son los de la RPC (`totales` y cada renglón): nada
 * se recalcula aquí. Las acciones (calcular, aprobar, pagar, anular,
 * exportar e imprimir) están en el encabezado, cada una con su permiso; la
 * separación de funciones se ve como "Aprobar planilla" deshabilitado con su
 * motivo.
 */
export default async function PlanillaDetallePage({ params }: PageProps<"/planillas/periodos/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const [ctx, permisos, userId] = await Promise.all([contextoActual(), permisosDe(), usuarioActualId()]);
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
  }

  const r = await detallePlanilla(ctx, id);
  if (r === "no-encontrada") notFound();
  if (!r.ok) {
    if (r.motivo === "denegado") {
      return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
    }
    if (r.motivo === "negocio") {
      return (
        <div className="flex max-w-6xl flex-col gap-6">
          <PageHeader title={TITULO} back={{ href: RUTA.periodos(), label: "Planillas" }} />
          <Alert tone="warning" title="No se pudo abrir la planilla">
            {r.mensaje}
          </Alert>
        </div>
      );
    }
    return <ErrorDeCarga titulo={TITULO} que="la planilla" />;
  }

  const { planilla: p, renglones } = r.valor;
  const t = p.totales;
  const esAguinaldo = p.clase === "aguinaldo";
  const calculada = p.estado !== "borrador";
  const hoy = hoyManagua();

  const columnas: DataTableColumn<Renglon>[] = [
    {
      key: "persona",
      header: "Persona",
      render: (rg) => (
        <span className="flex flex-col">
          <span>{rg.empleado_nombre}</span>
          <span className="text-xs font-normal text-neutral-500 tabular-nums">N.º {rg.numero_contrato}</span>
        </span>
      ),
    },
    { key: "neto", header: "Neto", numeric: true, render: (rg) => <span className="font-medium text-neutral-900">{moneda(rg.neto)}</span> },
    { key: "devengado", header: "Devengado", numeric: true, render: (rg) => moneda(rg.devengado) },
    ...(esAguinaldo
      ? []
      : ([
          { key: "deducciones", header: "Deducciones", numeric: true, render: (rg) => moneda(rg.deducciones) },
          { key: "aportes", header: "Aportes patronales", numeric: true, render: (rg) => moneda(rg.aportes) },
          { key: "provisiones", header: "Provisiones", numeric: true, render: (rg) => moneda(rg.provisiones) },
        ] satisfies DataTableColumn<Renglon>[])),
    { key: "dias", header: "Días pagados", numeric: true, render: (rg) => decimal(rg.dias_pagados, 4) },
    { key: "regimen", header: "Régimen", render: (rg) => etiqueta(REGIMEN, rg.regimen) },
    {
      key: "avisos",
      header: "Avisos",
      render: (rg) =>
        rg.avisos.length > 0 ? (
          <StatusBadge label={`${entero(rg.avisos.length)} ${rg.avisos.length === 1 ? "aviso" : "avisos"}`} tone="warning" />
        ) : (
          "—"
        ),
    },
  ];

  const etiquetaPeriodo = tituloPlanilla(p);

  return (
    <AccionesPlanillaProvider>
      <div className="flex max-w-6xl flex-col gap-6">
        <EncabezadoPlanilla
          planilla={p}
          activa="personas"
          permisos={permisos}
          actions={
            <AccionesPlanilla
              planillaId={p.id}
              estado={p.estado}
              etiqueta={etiquetaPeriodo}
              periodo={{ inicio: p.periodo_inicio, fin: p.periodo_fin }}
              personas={num(t.empleados)}
              neto={num(t.neto)}
              costo={num(t.costo_total)}
              avisosContador={hayAvisosContador(t.avisos)}
              esAutor={esAutorDePlanilla(p, userId)}
              cambiosSinCalcular={p.cambios_sin_calcular === true}
              hoy={hoy}
              nombreCsv={`planilla-${p.periodo_inicio}-${p.periodo_fin}.csv`}
              puede={{
                calcular: permisos.planillaGenerar,
                aprobar: permisos.planillaAprobar,
                pagar: permisos.planillaPagar,
                anular: permisos.planillaAnular,
                exportar: permisos.planillaExportar,
                imprimir: permisos.planillaVer,
              }}
            />
          }
        />

        <ErrorAccionPlanilla
          permisos={{
            regimenVer: permisos.regimenVer,
            parametrosVer: permisos.parametrosVer,
            novedadesVer: permisos.novedadesVer,
            conceptosVer: permisos.conceptosVer,
          }}
          periodo={{ inicio: p.periodo_inicio, fin: p.periodo_fin }}
        />

        <AvisosEstadoPlanilla planilla={p} permisos={permisos} />

        <AvisosPlanilla avisos={t.avisos} titulo="Avisos del cálculo" />

        {calculada ? (
          <section aria-labelledby="planilla-resumen" className="flex flex-col gap-4">
            <h2 id="planilla-resumen" className="sr-only">
              Resumen de la planilla
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Neto a pagar" value={moneda(t.neto)} />
              <MetricCard label="Devengado" value={moneda(t.devengado)} />
              <MetricCard label="Deducciones" value={moneda(t.deducciones)} />
              <MetricCard label="Costo del empleador" value={moneda(t.costo_total)} hint="Devengado + aportes patronales + provisiones" />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm shadow-xs sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <dt className="text-neutral-500">Personas</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{entero(t.empleados)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-neutral-500">Aportes patronales</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{moneda(t.aportes)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-neutral-500">Provisiones</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{moneda(t.provisiones)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-neutral-500">Personas con aviso</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{entero(t.empleados_con_aviso)}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section aria-labelledby="planilla-personas" className="flex flex-col gap-3">
          <h2 id="planilla-personas" className="text-base font-semibold text-neutral-900">
            Personas
          </h2>
          <DataTable
            rows={renglones}
            rowKey={(rg) => rg.id}
            rowHref={(rg) => RUTA.persona(p.id, rg.contrato_id)}
            caption="Personas de la planilla"
            columns={columnas}
            empty={
              p.estado === "borrador" ? (
                <EmptyState
                  bare
                  title="La planilla todavía no está calculada"
                  description="Calcúlala para ver a cada persona con sus montos."
                  action={permisos.planillaGenerar ? <BotonCalcularPlanilla planillaId={p.id} /> : null}
                />
              ) : (
                <EmptyState bare title="La planilla no tiene personas" description="Ningún contrato entró en este período." />
              )
            }
          />
        </section>
      </div>
    </AccionesPlanillaProvider>
  );
}
