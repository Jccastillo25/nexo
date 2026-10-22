import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, DataTable, EmptyState, MetricCard, StatusBadge, moneda, porcentaje } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_COMPARACION, estadoVisual } from "@/lib/planilla/estados";
import { montoConSigno, sumarMontos, variacion } from "@/lib/planilla/formato";
import { etiquetaPeriodo } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { consultarRpc } from "@/lib/planilla/servidor";
import type { ComparacionFila } from "@/lib/planilla/tipos";
import { ErrorDeCarga, SinAccesoPlanilla } from "../../compartido";
import { detallePlanilla } from "../../datos";
import { EncabezadoPlanilla } from "../encabezado";

export const metadata: Metadata = {
  title: "Comparar con la anterior · Planilla · RRHH",
};

const TITULO = "Comparar con la anterior";

/**
 * Comparación con la planilla aprobada o pagada anterior del mismo tipo (B6,
 * planilla.ver). Fuente: `planilla_comparar` (no se llama en borrador: la
 * RPC lo rechaza). Las cifras son las de la RPC; los totales de las
 * tarjetas son sumas de presentación (`sumarMontos`) de esas cifras. Sin
 * umbral de "diferencia grande" (D17): el cambio va en texto.
 */
export default async function CompararPlanillaPage({ params }: PageProps<"/planillas/periodos/[id]/comparar">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
  }

  const d = await detallePlanilla(ctx, id);
  if (d === "no-encontrada") notFound();
  if (!d.ok) {
    if (d.motivo === "denegado") return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
    return <ErrorDeCarga titulo={TITULO} que="la planilla" />;
  }
  const p = d.valor.planilla;
  const encabezado = <EncabezadoPlanilla planilla={p} activa="comparar" permisos={permisos} />;

  if (p.estado === "borrador") {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        <EmptyState title="Calcula la planilla para compararla con la anterior." />
      </div>
    );
  }

  const r = await consultarRpc<ComparacionFila[]>(ctx, "planilla_comparar", { p_planilla_id: id }, "planilla_comparar");
  if (!r.ok) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        {r.motivo === "negocio" ? (
          <Alert tone="warning">{r.mensaje}</Alert>
        ) : r.motivo === "denegado" ? (
          <EmptyState variant="no-access" title="No tienes acceso a la comparación" description="Pide el permiso «Ver planillas» a quien administra Nexo." />
        ) : (
          <EmptyState variant="error" title="No se pudo cargar la comparación" />
        )}
      </div>
    );
  }

  const filas = Array.isArray(r.valor) ? r.valor : [];
  const conAnterior = filas.find((f) => f.anterior_id !== null);
  if (!conAnterior) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        <EmptyState
          title="No hay una planilla anterior para comparar"
          description="Se compara con la planilla aprobada o pagada anterior del mismo tipo."
        />
      </div>
    );
  }

  const netoActual = sumarMontos(filas.map((f) => f.neto_actual));
  const netoAnterior = sumarMontos(filas.map((f) => f.neto_anterior));
  const diferencia = sumarMontos(filas.map((f) => f.diferencia_neto));
  const anteriorTexto =
    conAnterior.anterior_periodo_inicio && conAnterior.anterior_periodo_fin
      ? etiquetaPeriodo(conAnterior.anterior_periodo_inicio, conAnterior.anterior_periodo_fin, p.frecuencia, p.clase)
      : "la planilla anterior";

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      {encabezado}

      <p className="text-sm text-neutral-600">
        Se compara con{" "}
        {conAnterior.anterior_id ? (
          <Link
            href={RUTA.detalle(conAnterior.anterior_id)}
            className="rounded-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {anteriorTexto}
          </Link>
        ) : (
          anteriorTexto
        )}
        , la última aprobada o pagada del mismo tipo.
      </p>

      <section aria-labelledby="comparar-resumen" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <h2 id="comparar-resumen" className="sr-only">
          Resumen de la comparación
        </h2>
        <MetricCard label="Neto de este período" value={moneda(netoActual)} />
        <MetricCard label="Neto del período anterior" value={moneda(netoAnterior)} hint={anteriorTexto} />
        <MetricCard label="Diferencia" value={montoConSigno(diferencia)} hint="Neto de este período menos el anterior" />
      </section>

      <DataTable
        rows={filas}
        rowKey={(f) => f.contrato_id}
        rowHref={(f) => (f.neto_actual !== null ? RUTA.persona(p.id, f.contrato_id) : null)}
        caption="Comparación con la planilla anterior del mismo tipo"
        columns={[
          {
            key: "persona",
            header: "Persona",
            render: (f) => (
              <span className="flex flex-col">
                <span>{f.empleado_nombre}</span>
                <span className="text-xs font-normal text-neutral-500 tabular-nums">N.º {f.numero_contrato}</span>
              </span>
            ),
          },
          {
            key: "cambio",
            header: "Cambio",
            render: (f) => {
              const v = estadoVisual(ESTADO_COMPARACION, f.estado);
              return <StatusBadge label={v.label} tone={v.tone} />;
            },
          },
          { key: "dev-ant", header: "Devengado anterior", numeric: true, render: (f) => moneda(f.devengado_anterior) },
          { key: "dev-act", header: "Devengado actual", numeric: true, render: (f) => moneda(f.devengado_actual) },
          { key: "neto-ant", header: "Neto anterior", numeric: true, render: (f) => moneda(f.neto_anterior) },
          { key: "neto-act", header: "Neto actual", numeric: true, render: (f) => moneda(f.neto_actual) },
          { key: "dif", header: "Diferencia de neto", numeric: true, render: (f) => montoConSigno(f.diferencia_neto) },
          {
            key: "var",
            header: "Variación",
            numeric: true,
            render: (f) => {
              const v = variacion(f.neto_actual, f.neto_anterior);
              return v === null ? "—" : porcentaje(v, { signo: true });
            },
          },
        ]}
      />
    </div>
  );
}
