import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc, contratosOpciones, usuarioActualId } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { ESTADO_VACACIONES, estadoVisual } from "@/lib/planilla/estados";
import { TIPO_VACACIONES, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal } from "@/lib/planilla/formato";
import type { EstadoVacaciones, VacacionMovimiento, VacacionSaldo } from "@/lib/planilla/tipos";
import { CeldaPersona, etiquetaPersona } from "../../liquidaciones/_compartido/celdas";
import { FalloLectura, SinAcceso } from "../../liquidaciones/_compartido/fallo-lectura";
import { FiltrosUrl, type OpcionFiltro } from "../../liquidaciones/_compartido/filtros-url";
import { CLASE_DESTINO_FOCO } from "../../liquidaciones/_compartido/foco";
import { PestanasVacaciones } from "../pestanas";
import { AccionesMovimiento } from "./acciones-movimiento";

export const metadata: Metadata = {
  title: "Movimientos de vacaciones · RRHH",
};

const ACCESO = { pantalla: "Vacaciones", permiso: "Ver vacaciones" };
/** Encabezado "Persona" de la tabla: recibe el foco después de aprobar, rechazar o anular (la fila cambia o sale). */
const FOCO_TABLA = "movimientos-tabla-persona";

function uno(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** "Aprobado el …", "Rechazado: …", "Anulado: …" o "Pendiente de aprobación". */
function resolucion(m: VacacionMovimiento): string {
  switch (m.estado) {
    case "solicitada":
      return "Pendiente de aprobación";
    case "aprobada":
      return m.aprobado_en ? `Aprobado el ${fechaCorta(m.aprobado_en)}` : "Aprobado";
    case "rechazada":
      return m.rechazo_motivo ? `Rechazado: ${m.rechazo_motivo}` : "Rechazado";
    case "anulada":
      return m.rechazo_motivo ? `Anulado: ${m.rechazo_motivo}` : "Anulado";
    default:
      return "—";
  }
}

/** Días con signo en un ajuste ("+2", "-1.5"). */
function diasMovimiento(m: VacacionMovimiento): string {
  const texto = decimal(m.dias, 2);
  return m.tipo === "ajuste" && m.dias > 0 ? `+${texto}` : texto;
}

/**
 * Vacaciones → Movimientos (C2). Fuente: planilla_vacaciones_movimientos
 * (p_contrato_id, p_estado), filtrados en la base. El filtro de persona sale
 * de planilla_contratos_opciones si el rol puede usarla; si no (p. ej. el
 * supervisor de asistencia, que solo ve y aprueba), de los saldos, que
 * permite el mismo permiso de ver. Acciones solo con vacaciones.aprobar.
 */
export default async function VacacionesMovimientosPage({ searchParams }: PageProps<"/planillas/vacaciones/movimientos">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);

  if (!permisos.vacacionesVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Vacaciones" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const estadoParam = uno(sp.estado);
  const estado: EstadoVacaciones | null = esClaveDe(ESTADO_VACACIONES, estadoParam) ? estadoParam : null;
  const contratoParam = uno(sp.contrato);
  const contrato = esUuid(contratoParam) ? contratoParam : null;

  const puedeOpciones =
    permisos.novedadesCrear ||
    permisos.vacacionesRegistrar ||
    permisos.prestamosGestionar ||
    permisos.liquidacionesCalcular ||
    permisos.regimenVer;

  const [movimientosR, opcionesR, userId] = await Promise.all([
    consultarRpc<VacacionMovimiento[]>(
      ctx,
      "planilla_vacaciones_movimientos",
      { p_contrato_id: contrato, p_estado: estado },
      "planilla_vacaciones_movimientos"
    ),
    puedeOpciones
      ? contratosOpciones(ctx).then((r) =>
          r.ok ? r.valor.map((c): OpcionFiltro => ({ valor: c.contrato_id, etiqueta: c.etiqueta })) : null
        )
      : consultarRpc<VacacionSaldo[]>(ctx, "planilla_vacaciones_saldos", { p_fecha: hoyManagua() }, "planilla_vacaciones_saldos").then(
          (r) =>
            r.ok && Array.isArray(r.valor)
              ? r.valor.map((s): OpcionFiltro => ({ valor: s.contrato_id, etiqueta: etiquetaPersona(s.empleado_nombre, s.numero_contrato) }))
              : null
        ),
    usuarioActualId(),
  ]);

  const puedeRegistrar = permisos.vacacionesRegistrar;
  const puedeAprobar = permisos.vacacionesAprobar;
  const movimientos = movimientosR.ok && Array.isArray(movimientosR.valor) ? movimientosR.valor : [];
  const porAprobar = estado === null && contrato === null && movimientosR.ok ? movimientos.filter((m) => m.estado === "solicitada").length : null;

  const encabezado = (
    <PageHeader
      title="Vacaciones"
      description="Goces, pagos sin gozar, ajustes y saldos iniciales, con su aprobación."
      actions={
        puedeRegistrar ? (
          <ButtonLink href={RUTA.vacacionesRegistrar({ contrato: contrato ?? undefined })} icon={<NexoIcon name="plus" />}>
            Registrar vacaciones
          </ButtonLink>
        ) : null
      }
      tabs={<PestanasVacaciones activa="movimientos" porAprobar={porAprobar} />}
    />
  );

  if (!movimientosR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={movimientosR} titulo="No se pudieron cargar los movimientos de vacaciones" acceso={ACCESO} />
      </div>
    );
  }

  // Si el contrato filtrado no está en la lista (p. ej. ya liquidado), se agrega con el nombre de sus filas.
  let opcionesPersona = opcionesR;
  if (opcionesPersona && contrato && !opcionesPersona.some((o) => o.valor === contrato)) {
    const fila = movimientos.find((m) => m.contrato_id === contrato);
    opcionesPersona = [
      { valor: contrato, etiqueta: fila ? etiquetaPersona(fila.empleado_nombre, fila.numero_contrato) : "Contrato elegido" },
      ...opcionesPersona,
    ];
  }

  const hayFiltros = estado !== null || contrato !== null;
  const ruta = RUTA.vacacionesMovimientos();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      <DataTable
        caption="Movimientos de vacaciones"
        rows={movimientos}
        rowKey={(m) => m.id}
        toolbar={
          <FiltrosUrl
            ruta={ruta}
            etiqueta="Filtros de movimientos"
            campos={[
              {
                nombre: "estado",
                label: "Estado",
                valor: estado ?? "",
                todos: "Todos",
                ancho: "w-full sm:w-44",
                opciones: (Object.keys(ESTADO_VACACIONES) as EstadoVacaciones[]).map((e) => ({
                  valor: e,
                  etiqueta: ESTADO_VACACIONES[e].label,
                })),
              },
              ...(opcionesPersona
                ? [
                    {
                      nombre: "contrato",
                      label: "Persona",
                      valor: contrato ?? "",
                      todos: "Todas las personas",
                      ancho: "w-full sm:w-72",
                      opciones: opcionesPersona,
                    },
                  ]
                : []),
            ]}
          />
        }
        empty={
          hayFiltros ? (
            <EmptyState
              bare
              variant="no-results"
              title="No hay movimientos con estos filtros"
              action={
                <ButtonLink href={ruta} variant="secondary">
                  Quitar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay movimientos de vacaciones"
              description="Registra un goce, un pago sin gozar, un ajuste o el saldo inicial traído de AG Planilla."
              action={
                puedeRegistrar ? (
                  <ButtonLink href={RUTA.vacacionesRegistrar()} variant="secondary">
                    Registrar vacaciones
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        columns={[
          {
            key: "persona",
            header: (
              <span id={FOCO_TABLA} tabIndex={-1} className={CLASE_DESTINO_FOCO}>
                Persona
              </span>
            ),
            render: (m) => <CeldaPersona nombre={m.empleado_nombre} numero={m.numero_contrato} />,
          },
          { key: "tipo", header: "Tipo", render: (m) => etiqueta(TIPO_VACACIONES, m.tipo) },
          { key: "del", header: "Del", render: (m) => <span className="tabular-nums">{fechaCorta(m.fecha_inicio)}</span> },
          {
            key: "al",
            header: "Al",
            render: (m) => <span className="tabular-nums">{m.tipo === "goce" ? fechaCorta(m.fecha_fin) : "—"}</span>,
          },
          { key: "dias", header: "Días", numeric: true, render: (m) => diasMovimiento(m) },
          {
            key: "estado",
            header: "Estado",
            render: (m) => {
              const e = estadoVisual(ESTADO_VACACIONES, m.estado);
              return <StatusBadge label={e.label} tone={e.tone} />;
            },
          },
          {
            key: "motivo",
            header: "Motivo",
            width: "12rem",
            truncate: true,
            render: (m) => (m.motivo ? <span title={m.motivo}>{m.motivo}</span> : "—"),
          },
          {
            key: "registrado",
            header: "Registrado",
            render: (m) => <span className="tabular-nums">{fechaCorta(m.registrado_en)}</span>,
          },
          {
            key: "resolucion",
            header: "Resolución",
            width: "14rem",
            truncate: true,
            render: (m) => {
              const texto = resolucion(m);
              return <span title={texto}>{texto}</span>;
            },
          },
          ...(puedeAprobar
            ? [
                {
                  key: "acciones",
                  header: <span className="sr-only">Acciones</span>,
                  align: "right" as const,
                  render: (m: VacacionMovimiento) => (
                    <AccionesMovimiento
                      focoTrasCambio={FOCO_TABLA}
                      movimiento={{
                        id: m.id,
                        persona: m.empleado_nombre,
                        tipo: m.tipo,
                        estado: m.estado,
                        dias: m.dias,
                        fecha: m.fecha_inicio,
                        esAutor: userId !== null && m.registrado_por === userId,
                      }}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      {movimientos.length >= 1000 ? (
        <p className="text-xs text-neutral-500">Se muestran los 1000 movimientos más recientes. Filtra por persona o estado para ver otros.</p>
      ) : null}
    </div>
  );
}
