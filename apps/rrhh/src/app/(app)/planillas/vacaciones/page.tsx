import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, MetricCard, NexoIcon, PageHeader, StatusBadge, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { ESTADO_CONTRATO } from "@/lib/contratos";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { leerFecha } from "@/lib/planilla/periodos";
import { estadoVisual } from "@/lib/planilla/estados";
import { decimal, sumarCantidades, sumarMontos, tarifa } from "@/lib/planilla/formato";
import type { VacacionMovimiento, VacacionSaldo } from "@/lib/planilla/tipos";
import { CeldaPersona } from "../liquidaciones/_compartido/celdas";
import { FalloLectura, SinAcceso } from "../liquidaciones/_compartido/fallo-lectura";
import { FiltroFecha } from "./filtro-fecha";
import { PestanasVacaciones } from "./pestanas";

export const metadata: Metadata = {
  title: "Vacaciones · RRHH",
};

const ACCESO = { pantalla: "Vacaciones", permiso: "Ver vacaciones" };
const DESCRIPCION = "Saldo de días por contrato. El saldo se calcula: nunca se edita a mano.";

/**
 * Vacaciones → Saldos (C1). Fuente: planilla_vacaciones_saldos(p_fecha), que
 * ya calcula acumulado, gozado, pagado, ajustes, liquidado y saldo; la vista
 * solo los muestra. El diario y el valor vienen en null sin planilla.ver ni
 * compensacion.ver (D6): entonces esas columnas y su KPI no se muestran.
 * "Solicitudes por aprobar" cuenta las filas `solicitada` de
 * planilla_vacaciones_movimientos (mismo permiso de ver).
 */
export default async function VacacionesSaldosPage({ searchParams }: PageProps<"/planillas/vacaciones">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);

  if (!permisos.vacacionesVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Vacaciones" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const hoy = hoyManagua();
  const fecha = leerFecha(sp.fecha, hoy);
  const [saldosR, solicitudesR] = await Promise.all([
    consultarRpc<VacacionSaldo[]>(ctx, "planilla_vacaciones_saldos", { p_fecha: fecha }, "planilla_vacaciones_saldos"),
    consultarRpc<VacacionMovimiento[]>(
      ctx,
      "planilla_vacaciones_movimientos",
      { p_contrato_id: null, p_estado: "solicitada" },
      "planilla_vacaciones_movimientos"
    ),
  ]);
  const porAprobar = solicitudesR.ok && Array.isArray(solicitudesR.valor) ? solicitudesR.valor.length : null;
  const puedeRegistrar = permisos.vacacionesRegistrar;

  const encabezado = (
    <PageHeader
      title="Vacaciones"
      description={DESCRIPCION}
      actions={
        puedeRegistrar ? (
          <ButtonLink href={RUTA.vacacionesRegistrar()} icon={<NexoIcon name="plus" />}>
            Registrar vacaciones
          </ButtonLink>
        ) : null
      }
      tabs={<PestanasVacaciones activa="saldos" porAprobar={porAprobar} />}
    />
  );

  if (!saldosR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={saldosR} titulo="No se pudieron cargar los saldos de vacaciones" acceso={ACCESO} />
      </div>
    );
  }

  const saldos = Array.isArray(saldosR.valor) ? saldosR.valor : [];
  // D6: el servidor decide si se ven salarios; la vista además oculta las columnas si vienen vacías.
  const verValores =
    (permisos.planillaVer || permisos.compensacionVer) && saldos.some((s) => s.valor !== null || s.salario_diario !== null);
  const diasPendientes = sumarCantidades(
    saldos.map((s) => s.saldo),
    2
  );
  const negativos = saldos.filter((s) => s.saldo < 0).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      <section aria-labelledby="vacaciones-resumen" className="flex flex-col gap-3">
        <h2 id="vacaciones-resumen" className="sr-only">
          Resumen de saldos
        </h2>
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${verValores ? "xl:grid-cols-3" : ""}`}>
          <MetricCard
            label="Días pendientes"
            value={saldos.length > 0 ? decimal(diasPendientes, 2) : "—"}
            unit={saldos.length > 0 ? "días" : undefined}
            hint={
              saldos.length > 0
                ? `Al ${fechaCorta(fecha)} · ${saldos.length} ${saldos.length === 1 ? "contrato" : "contratos"}${
                    negativos > 0 ? ` · ${negativos} con saldo negativo` : ""
                  }`
                : `Sin contratos al ${fechaCorta(fecha)}`
            }
            tone={negativos > 0 ? "warning" : "neutral"}
          />
          {verValores ? (
            <MetricCard
              label="Valor del saldo"
              value={moneda(sumarMontos(saldos.map((s) => s.valor)))}
              hint="Con el salario diario actual de cada contrato"
            />
          ) : null}
          <MetricCard
            label="Solicitudes por aprobar"
            value={porAprobar === null ? "—" : porAprobar}
            tone={porAprobar === null ? "pending" : porAprobar > 0 ? "warning" : "neutral"}
            hint={porAprobar === null ? "No disponible" : porAprobar > 0 ? "Revisa los movimientos solicitados" : "Nada pendiente"}
            href={porAprobar === null ? undefined : RUTA.vacacionesMovimientos({ estado: "solicitada" })}
          />
        </div>
      </section>

      <section aria-labelledby="vacaciones-saldos" className="flex flex-col gap-3">
        <h2 id="vacaciones-saldos" className="text-base font-semibold text-neutral-900">
          Saldos por contrato
        </h2>
        <DataTable
          caption={`Saldos de vacaciones al ${fechaCorta(fecha)}`}
          rows={saldos}
          rowKey={(s) => s.contrato_id}
          rowHref={(s) => RUTA.vacacionesMovimientos({ contrato: s.contrato_id })}
          toolbar={<FiltroFecha key={fecha} fecha={fecha} hoy={hoy} />}
          empty={
            <EmptyState
              bare
              title="No hay contratos con vacaciones registradas"
              description="Los contratos activos aparecen aquí con los días que acumulan."
              action={
                puedeRegistrar ? (
                  <ButtonLink href={RUTA.vacacionesRegistrar()} variant="secondary">
                    Registrar vacaciones
                  </ButtonLink>
                ) : null
              }
            />
          }
          columns={[
            {
              key: "persona",
              header: "Persona",
              render: (s) => (
                <CeldaPersona
                  nombre={s.empleado_nombre}
                  numero={s.numero_contrato}
                  extra={s.fecha_corte ? `Saldo inicial al ${fechaCorta(s.fecha_corte)}` : undefined}
                />
              ),
            },
            {
              key: "saldo",
              header: "Saldo",
              numeric: true,
              render: (s) => (
                <span className="flex flex-col items-end">
                  <span className="font-semibold text-neutral-900">{decimal(s.saldo, 2)}</span>
                  {s.saldo < 0 ? <span className="text-xs text-red-700">(negativo)</span> : null}
                </span>
              ),
            },
            {
              key: "contrato",
              header: "Contrato",
              render: (s) => {
                const e = estadoVisual(ESTADO_CONTRATO, s.estado_contrato);
                return <StatusBadge label={e.label} tone={e.tone} />;
              },
            },
            { key: "acumulado", header: "Acumulado", numeric: true, render: (s) => decimal(s.acumulado, 2) },
            { key: "gozado", header: "Gozado", numeric: true, render: (s) => decimal(s.gozado, 2) },
            { key: "pagado", header: "Pagado", numeric: true, render: (s) => decimal(s.pagado, 2) },
            { key: "ajustes", header: "Ajustes", numeric: true, render: (s) => decimal(s.ajustes, 2) },
            { key: "liquidado", header: "Liquidado", numeric: true, render: (s) => decimal(s.liquidado, 2) },
            ...(verValores
              ? [
                  { key: "diario", header: "Diario", numeric: true, render: (s: VacacionSaldo) => tarifa(s.salario_diario) },
                  { key: "valor", header: "Valor", numeric: true, render: (s: VacacionSaldo) => moneda(s.valor) },
                ]
              : []),
            ...(puedeRegistrar
              ? [
                  {
                    key: "acciones",
                    header: <span className="sr-only">Acciones</span>,
                    align: "right" as const,
                    render: (s: VacacionSaldo) => (
                      <ButtonLink
                        href={RUTA.vacacionesRegistrar({ contrato: s.contrato_id })}
                        variant="secondary"
                        size="sm"
                        aria-label={`Registrar vacaciones de ${s.empleado_nombre}`}
                      >
                        Registrar
                      </ButtonLink>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <p className="text-xs text-neutral-500">
          Días con hasta dos decimales. Selecciona una fila para ver los movimientos de esa persona.
        </p>
      </section>
    </div>
  );
}
