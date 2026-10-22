import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, MetricCard, NexoIcon, PageHeader, StatusBadge, entero, fechaCorta, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { ESTADO_PRESTAMO, estadoVisual } from "@/lib/planilla/estados";
import { ORIGEN_PRESTAMO, TIPO_PRESTAMO, etiqueta } from "@/lib/planilla/etiquetas";
import { sumarMontos } from "@/lib/planilla/formato";
import type { PrestamoSaldo } from "@/lib/planilla/tipos";
import { CeldaPersona, etiquetaPersona } from "../liquidaciones/_compartido/celdas";
import { FalloLectura, SinAcceso } from "../liquidaciones/_compartido/fallo-lectura";
import { FiltrosUrl, type OpcionFiltro } from "../liquidaciones/_compartido/filtros-url";
import { CLASE_DESTINO_FOCO } from "../liquidaciones/_compartido/foco";
import { AccionesPrestamo } from "./acciones-prestamo";

export const metadata: Metadata = {
  title: "Préstamos y adelantos · RRHH",
};

const ACCESO = { pantalla: "Préstamos y adelantos", permiso: "Ver préstamos" };
/** Encabezado "Persona" de la tabla: recibe el foco después de una acción del menú "⋯" (la fila cambia o sale). */
const FOCO_TABLA = "prestamos-tabla-persona";
const AVISO_AGUINALDO_PRESTAMOS =
  "Las cuotas nunca se descuentan del aguinaldo (art. 97 del Código del Trabajo). Si una cuota no cabe en el neto, queda pendiente para la planilla siguiente y la planilla lo avisa.";

function uno(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Préstamos y adelantos (C4). Fuente: planilla_prestamos_saldos (aplicado,
 * pendiente, condonado, cuotas pendientes y próxima cuota ya calculados por
 * la RPC). Filtros en la URL y aplicados en el servidor sobre las filas:
 * `?estado=` vacío = con saldo pendiente, `todos` = todos; `?contrato=` = una
 * persona (las opciones salen de las mismas filas). Cada fila abre la ficha
 * con sus cuotas (planilla_prestamo_cuotas).
 */
export default async function PrestamosPage({ searchParams }: PageProps<"/planillas/prestamos">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);

  if (!permisos.prestamosVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Préstamos y adelantos" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const verTodos = uno(sp.estado) === "todos";
  const contratoParam = uno(sp.contrato);
  const contrato = esUuid(contratoParam) ? contratoParam : null;
  const puedeGestionar = permisos.prestamosGestionar;

  const encabezado = (
    <PageHeader
      title="Préstamos y adelantos"
      description="Préstamos y adelantos salariales que se descuentan por cuotas en la planilla."
      actions={
        puedeGestionar ? (
          <ButtonLink href={RUTA.prestamoNuevo()} icon={<NexoIcon name="plus" />}>
            Nuevo préstamo
          </ButtonLink>
        ) : null
      }
    />
  );

  const saldosR = await consultarRpc<PrestamoSaldo[]>(ctx, "planilla_prestamos_saldos", {}, "planilla_prestamos_saldos");
  if (!saldosR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={saldosR} titulo="No se pudieron cargar los préstamos" acceso={ACCESO} />
      </div>
    );
  }

  const todos = Array.isArray(saldosR.valor) ? saldosR.valor : [];
  const conSaldo = todos.filter((p) => p.pendiente > 0);
  const filas = todos.filter((p) => (verTodos || p.pendiente > 0) && (contrato === null || p.contrato_id === contrato));

  const personas = new Map<string, OpcionFiltro>();
  for (const p of todos) {
    if (!personas.has(p.contrato_id)) {
      personas.set(p.contrato_id, { valor: p.contrato_id, etiqueta: etiquetaPersona(p.empleado_nombre, p.numero_contrato) });
    }
  }
  const opcionesPersona = [...personas.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  const cuotasPendientes = conSaldo.reduce((n, p) => n + p.cuotas_pendientes, 0);
  const hayFiltros = verTodos || contrato !== null;
  const ruta = RUTA.prestamos();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      <section aria-labelledby="prestamos-resumen" className="flex flex-col gap-3">
        <h2 id="prestamos-resumen" className="sr-only">
          Resumen de préstamos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Saldo pendiente"
            value={moneda(sumarMontos(conSaldo.map((p) => p.pendiente)))}
            hint={
              conSaldo.length > 0
                ? `${entero(cuotasPendientes)} ${cuotasPendientes === 1 ? "cuota" : "cuotas"} por descontar`
                : "No hay cuotas por descontar"
            }
          />
          <MetricCard
            label="Préstamos con saldo"
            value={conSaldo.length}
            hint={`De ${todos.length} ${todos.length === 1 ? "registrado" : "registrados"}`}
          />
        </div>
      </section>

      <Alert tone="info">{AVISO_AGUINALDO_PRESTAMOS}</Alert>

      <DataTable
        caption={verTodos ? "Préstamos y adelantos" : "Préstamos y adelantos con saldo pendiente"}
        rows={filas}
        rowKey={(p) => p.prestamo_id}
        rowHref={(p) => RUTA.prestamo(p.prestamo_id)}
        toolbar={
          <FiltrosUrl
            ruta={ruta}
            etiqueta="Filtros de préstamos"
            campos={[
              {
                nombre: "estado",
                label: "Estado",
                valor: verTodos ? "todos" : "",
                todos: "Con saldo pendiente",
                ancho: "w-full sm:w-52",
                opciones: [{ valor: "todos", etiqueta: "Todos" }],
              },
              ...(opcionesPersona.length > 0
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
          todos.length === 0 ? (
            <EmptyState
              bare
              title="Todavía no hay préstamos ni adelantos"
              description="Registra el primero para descontarlo por cuotas en la planilla."
              action={
                puedeGestionar ? (
                  <ButtonLink href={RUTA.prestamoNuevo()} variant="secondary">
                    Nuevo préstamo
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <EmptyState
              bare
              variant="no-results"
              title={hayFiltros ? "No hay préstamos con estos filtros" : "No hay préstamos con saldo pendiente"}
              description={hayFiltros ? undefined : "Elige «Todos» en Estado para ver los pagados, cancelados y anulados."}
              action={
                hayFiltros ? (
                  <ButtonLink href={ruta} variant="secondary">
                    Quitar filtros
                  </ButtonLink>
                ) : (
                  <ButtonLink href={RUTA.prestamos({ estado: "todos" })} variant="secondary">
                    Ver todos
                  </ButtonLink>
                )
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
            render: (p) => <CeldaPersona nombre={p.empleado_nombre} numero={p.numero_contrato} />,
          },
          {
            key: "pendiente",
            header: "Pendiente",
            numeric: true,
            render: (p) => <span className="font-semibold text-neutral-900">{moneda(p.pendiente)}</span>,
          },
          { key: "tipo", header: "Tipo", render: (p) => etiqueta(TIPO_PRESTAMO, p.tipo) },
          { key: "origen", header: "Origen", render: (p) => etiqueta(ORIGEN_PRESTAMO, p.origen) },
          { key: "monto", header: "Monto", numeric: true, render: (p) => moneda(p.monto) },
          {
            key: "cuotas",
            header: "Cuotas",
            numeric: true,
            render: (p) => `${entero(p.cuotas)} × ${moneda(p.monto_cuota)}`,
          },
          {
            key: "aplicado",
            header: "Aplicado",
            numeric: true,
            render: (p) => (
              <span className="flex flex-col items-end">
                <span>{moneda(p.aplicado)}</span>
                {p.condonado > 0 ? <span className="text-xs text-neutral-500">{moneda(p.condonado)} sin descontar</span> : null}
              </span>
            ),
          },
          { key: "cuotas-pendientes", header: "Cuotas pendientes", numeric: true, render: (p) => entero(p.cuotas_pendientes) },
          {
            key: "proxima",
            header: "Próxima cuota",
            render: (p) => <span className="tabular-nums">{fechaCorta(p.proxima_fecha)}</span>,
          },
          {
            key: "estado",
            header: "Estado",
            render: (p) => {
              const e = estadoVisual(ESTADO_PRESTAMO, p.estado);
              return <StatusBadge label={e.label} tone={e.tone} />;
            },
          },
          ...(puedeGestionar
            ? [
                {
                  key: "acciones",
                  header: <span className="sr-only">Acciones</span>,
                  align: "right" as const,
                  render: (p: PrestamoSaldo) => (
                    <AccionesPrestamo
                      modo="menu"
                      focoTrasCambio={FOCO_TABLA}
                      prestamo={{
                        id: p.prestamo_id,
                        persona: p.empleado_nombre,
                        tipo: p.tipo,
                        estado: p.estado,
                        pendiente: p.pendiente,
                      }}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
