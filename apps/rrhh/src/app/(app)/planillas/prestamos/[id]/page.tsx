import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, DataTable, EmptyState, MetricCard, PageHeader, StatusBadge, entero, fechaCorta, fechaHora, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { ESTADO_PLANILLA, ESTADO_PRESTAMO, estadoVisual, type EstadoVisual } from "@/lib/planilla/estados";
import { ORIGEN_PRESTAMO, TIPO_PRESTAMO, etiqueta } from "@/lib/planilla/etiquetas";
import type { PrestamoCuota, PrestamoSaldo } from "@/lib/planilla/tipos";
import { FalloLectura, SinAcceso } from "../../liquidaciones/_compartido/fallo-lectura";
import { CLASE_DESTINO_FOCO } from "../../liquidaciones/_compartido/foco";
import { AccionesPrestamo } from "../acciones-prestamo";

export const metadata: Metadata = {
  title: "Préstamo · RRHH",
};

const ACCESO = { pantalla: "Préstamos y adelantos", permiso: "Ver préstamos" };
const NO_ENCONTRADO = "Préstamo no encontrado.";

/** Estado visible de una cuota (novedad de origen préstamo) según su planilla. */
function estadoCuota(c: PrestamoCuota): EstadoVisual {
  if (c.saldada_en_liquidacion) return { label: "Saldada en la liquidación", tone: "positive" };
  if (c.estado === "anulada") return { label: "Anulada", tone: "neutral" };
  if (c.planilla_estado === "aprobada" || c.planilla_estado === "pagada") return { label: "Cobrada", tone: "positive" };
  if (c.planilla_id) return { label: "En planilla sin aprobar", tone: "info" };
  return { label: "Pendiente", tone: "warning" };
}

/**
 * Ficha de un préstamo o adelanto con su plan de cuotas (D13). Fuentes:
 * planilla_prestamos_saldos (la fila del préstamo, con aplicado, pendiente y
 * condonado ya calculados) y planilla_prestamo_cuotas (cada cuota con su
 * planilla). Mismo permiso de ver; acciones con prestamos.gestionar.
 */
export default async function PrestamoPage({ params }: PageProps<"/planillas/prestamos/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  const volver = { href: RUTA.prestamos(), label: "Préstamos y adelantos" };

  if (!permisos.prestamosVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Préstamo" back={volver} />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const [saldosR, cuotasR] = await Promise.all([
    consultarRpc<PrestamoSaldo[]>(ctx, "planilla_prestamos_saldos", {}, "planilla_prestamos_saldos"),
    consultarRpc<PrestamoCuota[]>(ctx, "planilla_prestamo_cuotas", { p_prestamo_id: id }, "planilla_prestamo_cuotas"),
  ]);
  if (!cuotasR.ok && cuotasR.motivo === "negocio" && cuotasR.mensaje === NO_ENCONTRADO) notFound();

  const falla = !saldosR.ok ? saldosR : !cuotasR.ok ? cuotasR : null;
  if (falla) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Préstamo" back={volver} />
        <FalloLectura fallo={falla} titulo="No se pudo cargar el préstamo" acceso={ACCESO} />
      </div>
    );
  }

  const prestamo = (saldosR.ok && Array.isArray(saldosR.valor) ? saldosR.valor : []).find((p) => p.prestamo_id === id);
  if (!prestamo) notFound();
  const cuotas = cuotasR.ok && Array.isArray(cuotasR.valor) ? cuotasR.valor : [];
  const estado = estadoVisual(ESTADO_PRESTAMO, prestamo.estado);
  const tipo = etiqueta(TIPO_PRESTAMO, prestamo.tipo);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={`${tipo} de ${prestamo.empleado_nombre}`}
        description={`Contrato N.º ${prestamo.numero_contrato} · Origen: ${etiqueta(ORIGEN_PRESTAMO, prestamo.origen)} · Registrado el ${fechaHora(prestamo.created_at)}`}
        meta={<StatusBadge label={estado.label} tone={estado.tone} />}
        back={volver}
        actions={
          permisos.prestamosGestionar ? (
            <AccionesPrestamo
              modo="botones"
              focoTrasCambio="prestamo-cuotas"
              prestamo={{
                id: prestamo.prestamo_id,
                persona: prestamo.empleado_nombre,
                tipo: prestamo.tipo,
                estado: prestamo.estado,
                pendiente: prestamo.pendiente,
              }}
            />
          ) : null
        }
      />

      <section aria-labelledby="prestamo-resumen" className="flex flex-col gap-3">
        <h2 id="prestamo-resumen" className="sr-only">
          Resumen del préstamo
        </h2>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${prestamo.condonado > 0 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          <MetricCard
            label="Monto"
            value={moneda(prestamo.monto)}
            hint={`${prestamo.cuotas} ${prestamo.cuotas === 1 ? "cuota" : "cuotas"} de ${moneda(prestamo.monto_cuota)}`}
          />
          <MetricCard label="Aplicado" value={moneda(prestamo.aplicado)} hint="Cobrado en planillas aprobadas y en la liquidación" />
          <MetricCard
            label="Pendiente"
            value={moneda(prestamo.pendiente)}
            hint={
              prestamo.cuotas_pendientes > 0
                ? `${entero(prestamo.cuotas_pendientes)} ${prestamo.cuotas_pendientes === 1 ? "cuota" : "cuotas"} · próxima el ${fechaCorta(prestamo.proxima_fecha)}`
                : "Sin cuotas pendientes"
            }
          />
          {prestamo.condonado > 0 ? (
            <MetricCard
              label="Sin descontar en la liquidación"
              value={moneda(prestamo.condonado)}
              tone="warning"
              hint="No cupo sin tocar el aguinaldo (art. 97)"
            />
          ) : null}
        </div>
      </section>

      <Alert tone="info">
        Las cuotas nunca se descuentan del aguinaldo (art. 97 del Código del Trabajo). Si una cuota no cabe en el neto, queda
        pendiente para la planilla siguiente y la planilla lo avisa.
      </Alert>

      <section aria-labelledby="prestamo-cuotas" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="prestamo-cuotas" tabIndex={-1} className={`text-base font-semibold text-neutral-900 ${CLASE_DESTINO_FOCO}`}>
            Cuotas
          </h2>
          <p className="text-sm text-neutral-500">
            Las cuotas se generan en la fecha de fin de cada período a partir de la primera fecha ({fechaCorta(prestamo.fecha_primera)}).
          </p>
        </div>
        <DataTable
          caption={`Cuotas del ${tipo.toLowerCase()} de ${prestamo.empleado_nombre}`}
          rows={cuotas}
          rowKey={(c) => c.novedad_id}
          density="compact"
          empty={<EmptyState bare title="Este préstamo no tiene cuotas" />}
          columns={[
            {
              key: "numero",
              header: "N.º",
              numeric: true,
              width: "4rem",
              render: (c) => (c.cuota_numero === null ? "—" : c.cuota_numero),
            },
            { key: "fecha", header: "Fecha", render: (c) => <span className="tabular-nums">{fechaCorta(c.fecha)}</span> },
            { key: "monto", header: "Monto", numeric: true, render: (c) => moneda(c.monto) },
            {
              key: "estado",
              header: "Estado",
              render: (c) => {
                const e = estadoCuota(c);
                return <StatusBadge label={e.label} tone={e.tone} />;
              },
            },
            {
              key: "planilla",
              header: "Planilla",
              render: (c) => {
                if (!c.planilla_id) return "—";
                const e = estadoVisual(ESTADO_PLANILLA, c.planilla_estado);
                return permisos.planillaVer ? (
                  <Link
                    href={RUTA.detalle(c.planilla_id)}
                    className="rounded-sm font-medium text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Ver planilla ({e.label.toLowerCase()})
                  </Link>
                ) : (
                  `Planilla ${e.label.toLowerCase()}`
                );
              },
            },
          ]}
        />
      </section>

      {prestamo.nota ? (
        <section aria-labelledby="prestamo-nota" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 id="prestamo-nota" className="text-sm font-semibold text-neutral-900">
            Nota
          </h2>
          <p className="mt-1 text-sm whitespace-pre-line text-neutral-700">{prestamo.nota}</p>
        </section>
      ) : null}
    </div>
  );
}
