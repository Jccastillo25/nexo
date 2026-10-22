import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { ESTADO_EMBARGO, estadoVisual } from "@/lib/planilla/estados";
import { METODO_EMBARGO, TIPO_EMBARGO, etiqueta } from "@/lib/planilla/etiquetas";
import { porcentajeExacto } from "@/lib/planilla/formato";
import type { EmbargoSaldo } from "@/lib/planilla/tipos";
import { CeldaPersona } from "../liquidaciones/_compartido/celdas";
import { FalloLectura, SinAcceso } from "../liquidaciones/_compartido/fallo-lectura";
import { CLASE_DESTINO_FOCO } from "../liquidaciones/_compartido/foco";
import { AccionesEmbargo } from "./acciones-embargo";

export const metadata: Metadata = {
  title: "Embargos · RRHH",
};

const ACCESO = { pantalla: "Embargos", permiso: "Ver préstamos" };
/** Encabezado "Persona" de la tabla: recibe el foco después de terminar un embargo (el botón de la fila puede desaparecer). */
const FOCO_TABLA = "embargos-tabla-persona";

function valorEmbargo(e: EmbargoSaldo): string {
  return e.metodo === "porcentaje" ? porcentajeExacto(e.valor) : `${moneda(e.valor)} al mes`;
}

function vigencia(e: EmbargoSaldo): string {
  return e.vigente_hasta
    ? `Desde ${fechaCorta(e.vigente_desde)} hasta ${fechaCorta(e.vigente_hasta)}`
    : `Desde ${fechaCorta(e.vigente_desde)} · sin fecha de fin`;
}

/**
 * Embargos (C5), con prestamos.ver. Fuente: planilla_embargos_saldos
 * (aplicado y pendiente ya calculados por la RPC; el pendiente es null si la
 * orden no tiene tope). El valor de un porcentaje viene como fracción y se
 * muestra como %; el de un monto es MENSUAL. "Terminar" con
 * prestamos.gestionar.
 */
export default async function EmbargosPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);

  if (!permisos.prestamosVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Embargos" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const puedeGestionar = permisos.prestamosGestionar;
  const encabezado = (
    <PageHeader
      title="Embargos"
      description="Órdenes de pensión alimenticia y embargos judiciales que se descuentan en la planilla."
      actions={
        puedeGestionar ? (
          <ButtonLink href={RUTA.embargoNuevo()} icon={<NexoIcon name="plus" />}>
            Nuevo embargo
          </ButtonLink>
        ) : null
      }
    />
  );

  const embargosR = await consultarRpc<EmbargoSaldo[]>(ctx, "planilla_embargos_saldos", {}, "planilla_embargos_saldos");
  if (!embargosR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={embargosR} titulo="No se pudieron cargar los embargos" acceso={ACCESO} />
      </div>
    );
  }

  const embargos = Array.isArray(embargosR.valor) ? embargosR.valor : [];
  const hoy = hoyManagua();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      <Alert tone="info">
        El límite legal de embargo está pendiente de confirmar con el contador o el abogado. El embargo se descuenta después
        del INSS y el IR, primero el de pensión alimenticia; si el neto no alcanza, se descuenta lo posible y la planilla lo
        avisa. El monto mensual se prorratea por los días de vigencia del período.
      </Alert>

      <DataTable
        caption="Embargos registrados"
        rows={embargos}
        rowKey={(e) => e.embargo_id}
        empty={
          <EmptyState
            bare
            title="Todavía no hay embargos"
            description="Registra una orden judicial para descontarla en la planilla."
            action={
              puedeGestionar ? (
                <ButtonLink href={RUTA.embargoNuevo()} variant="secondary">
                  Nuevo embargo
                </ButtonLink>
              ) : null
            }
          />
        }
        columns={[
          {
            key: "persona",
            header: (
              <span id={FOCO_TABLA} tabIndex={-1} className={CLASE_DESTINO_FOCO}>
                Persona
              </span>
            ),
            render: (e) => <CeldaPersona nombre={e.empleado_nombre} numero={e.numero_contrato} />,
          },
          { key: "tipo", header: "Tipo", render: (e) => etiqueta(TIPO_EMBARGO, e.tipo) },
          { key: "metodo", header: "Método", render: (e) => etiqueta(METODO_EMBARGO, e.metodo) },
          { key: "valor", header: "Valor", numeric: true, render: (e) => valorEmbargo(e) },
          {
            key: "tope",
            header: "Tope total",
            numeric: true,
            render: (e) => (e.tope_total === null ? "Sin tope" : moneda(e.tope_total)),
          },
          { key: "aplicado", header: "Aplicado", numeric: true, render: (e) => moneda(e.aplicado) },
          {
            key: "pendiente",
            header: "Pendiente",
            numeric: true,
            render: (e) => (e.pendiente === null ? "—" : moneda(e.pendiente)),
          },
          {
            key: "referencia",
            header: "Referencia de la orden",
            width: "12rem",
            truncate: true,
            render: (e) => <span title={e.referencia}>{e.referencia}</span>,
          },
          { key: "vigencia", header: "Vigencia", render: (e) => <span className="tabular-nums">{vigencia(e)}</span> },
          {
            key: "estado",
            header: "Estado",
            render: (e) => {
              const v = estadoVisual(ESTADO_EMBARGO, e.estado);
              return <StatusBadge label={v.label} tone={v.tone} />;
            },
          },
          ...(puedeGestionar
            ? [
                {
                  key: "acciones",
                  header: <span className="sr-only">Acciones</span>,
                  align: "right" as const,
                  render: (e: EmbargoSaldo) =>
                    e.estado === "activo" ? (
                      <AccionesEmbargo
                        hoy={hoy}
                        focoTrasCambio={FOCO_TABLA}
                        embargo={{ id: e.embargo_id, persona: e.empleado_nombre, vigenteDesde: e.vigente_desde }}
                      />
                    ) : null,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
