import type { Metadata } from "next";
import Link from "next/link";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta, moneda } from "@nexo/ui";
import { hoyManagua } from "@/lib/fecha-managua";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_NOVEDAD, ESTADO_PLANILLA, estadoVisual } from "@/lib/planilla/estados";
import { ORIGEN_NOVEDAD, TIPO_CONCEPTO, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, diasTexto, horasTexto } from "@/lib/planilla/formato";
import { leerFecha, rangoMes, mesDe } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { consultarRpc, contratosOpciones } from "@/lib/planilla/servidor";
import type { EstadoNovedad, NovedadFila, OrigenNovedad } from "@/lib/planilla/tipos";
import { SinAccesoPlanilla } from "../periodos/compartido";
import { conceptosDeNovedad } from "../periodos/datos";
import { AnularNovedad, AnularNovedadProvider, ErrorAnularNovedad } from "./anular-novedad";
import { FiltrosNovedades } from "./filtros";
import { NuevaNovedad, type ConceptoOpcion } from "./nueva-novedad";

export const metadata: Metadata = {
  title: "Novedades · Planilla · RRHH",
};

const TITULO = "Novedades";
const ANULABLES: ReadonlySet<OrigenNovedad> = new Set<OrigenNovedad>(["manual", "excel", "asistencia"]);
const ENLACE_PEQUENO =
  "rounded-sm text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Cantidad con la unidad del método del concepto, o el monto en C$. */
function cantidadOMonto(n: NovedadFila): string {
  if (n.monto !== null && n.monto !== undefined) return moneda(n.monto);
  if (n.concepto_metodo === "horas") return horasTexto(n.cantidad);
  if (n.concepto_metodo === "dias") return diasTexto(n.cantidad);
  return decimal(n.cantidad, 4);
}

/**
 * Novedades del período (B8, movimientos.ver): ingresos y deducciones que
 * entran en la planilla cuyo período incluye su fecha. Fuente:
 * `planilla_novedades_listado(p_desde, p_hasta, p_contrato_id)`; estado y
 * origen se filtran en el servidor sobre esas filas. Por defecto, el mes
 * actual. "Agregar novedad" (movimientos.crear) abre el formulario con
 * `?agregar=1`; "Anular" (movimientos.eliminar) solo en las manuales, de
 * Excel o de Asistencia que no estén en una planilla aprobada o pagada. Si
 * anular falla, el error queda arriba de la tabla (ErrorAnularNovedad).
 */
export default async function NovedadesPage({ searchParams }: PageProps<"/planillas/novedades">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.novedadesVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las novedades" permiso="Ver movimientos" />;
  }

  const hoy = hoyManagua();
  const mesActual = rangoMes(mesDe(hoy));
  const desde = leerFecha(sp.desde, mesActual.inicio);
  const hasta = leerFecha(sp.hasta, mesActual.fin);
  const contratoParam = primero(sp.contrato);
  const contrato = esUuid(contratoParam) ? contratoParam : null;
  const estadoParam = primero(sp.estado);
  const estado: EstadoNovedad | null = esClaveDe(ESTADO_NOVEDAD, estadoParam) ? estadoParam : null;
  const origenParam = primero(sp.origen);
  const origen: OrigenNovedad | null = esClaveDe(ORIGEN_NOVEDAD, origenParam) ? origenParam : null;
  const agregar = primero(sp.agregar) === "1" && permisos.novedadesCrear;

  // planilla_contratos_opciones admite cualquiera de estos permisos; sin ellos no se llama (el filtro no aparece).
  const veContratos =
    permisos.novedadesCrear ||
    permisos.vacacionesRegistrar ||
    permisos.prestamosGestionar ||
    permisos.liquidacionesCalcular ||
    permisos.regimenVer;

  const [listado, contratos, conceptos] = await Promise.all([
    consultarRpc<NovedadFila[]>(
      ctx,
      "planilla_novedades_listado",
      { p_desde: desde, p_hasta: hasta, p_contrato_id: contrato },
      "planilla_novedades_listado"
    ),
    veContratos ? contratosOpciones(ctx) : Promise.resolve(null),
    agregar && permisos.conceptosVer ? conceptosDeNovedad(ctx) : Promise.resolve(null),
  ]);

  const opcionesContrato =
    contratos && contratos.ok ? contratos.valor.map((c) => ({ id: c.contrato_id, etiqueta: c.etiqueta })) : null;
  const filtrosActuales = {
    desde,
    hasta,
    contrato: contrato ?? undefined,
    estado: estado ?? undefined,
    origen: origen ?? undefined,
  };

  const opcionesConcepto: ConceptoOpcion[] =
    conceptos && conceptos.ok
      ? conceptos.valor
          .filter((c) => c.activo && c.permite_novedad && (c.tipo === "devengado" || c.tipo === "deduccion"))
          .map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo as ConceptoOpcion["tipo"], metodo: c.metodo }))
      : [];

  let formulario: React.ReactNode = null;
  if (agregar) {
    const cerrarHref = RUTA.novedades(filtrosActuales);
    if (!permisos.conceptosVer) {
      formulario = (
        <Alert tone="warning" title="No puedes registrar novedades">
          Tu rol no permite ver el catálogo de conceptos, que hace falta para registrar novedades.
        </Alert>
      );
    } else if (!conceptos || !conceptos.ok || !contratos || !contratos.ok) {
      formulario = (
        <Alert tone="warning" title="No se pudo preparar el formulario">
          No se pudieron cargar las personas o los conceptos. Recarga la página e intenta de nuevo.
        </Alert>
      );
    } else if (opcionesConcepto.length === 0) {
      formulario = (
        <Alert tone="warning" title="No hay conceptos para novedades">
          Ningún concepto activo admite novedades. Revísalo en Configuración → Conceptos.
        </Alert>
      );
    } else {
      formulario = (
        <NuevaNovedad
          contratos={contratos.valor.map((c) => ({ id: c.contrato_id, etiqueta: c.etiqueta }))}
          conceptos={opcionesConcepto}
          hoy={hoy}
          cerrarHref={cerrarHref}
        />
      );
    }
  }

  const encabezado = (
    <PageHeader
      title={TITULO}
      description="Ingresos y deducciones que entran en la planilla del período de su fecha."
      actions={
        permisos.novedadesCrear && !agregar ? (
          <ButtonLink href={RUTA.novedades({ ...filtrosActuales, agregar: true })} icon={<NexoIcon name="plus" />} scroll={false}>
            Agregar novedad
          </ButtonLink>
        ) : null
      }
    />
  );

  const filtros = (
    <FiltrosNovedades
      key={JSON.stringify(filtrosActuales)}
      desde={desde}
      hasta={hasta}
      contrato={contrato}
      estado={estado}
      origen={origen}
      contratos={opcionesContrato}
    />
  );

  if (!listado.ok) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        {encabezado}
        {filtros}
        {formulario}
        {listado.motivo === "negocio" ? (
          <Alert tone="warning">{listado.mensaje}</Alert>
        ) : listado.motivo === "denegado" ? (
          <EmptyState variant="no-access" title="No tienes acceso a las novedades" description="Pide el permiso «Ver movimientos» a quien administra Nexo." />
        ) : (
          <EmptyState variant="error" title="No se pudieron cargar las novedades" />
        )}
      </div>
    );
  }

  const todas = Array.isArray(listado.valor) ? listado.valor : [];
  const filas = todas.filter((n) => (!estado || n.estado === estado) && (!origen || n.origen === origen));
  const conFiltros = Boolean(contrato || estado || origen);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      {encabezado}
      {filtros}
      {formulario}

      <AnularNovedadProvider>
        <ErrorAnularNovedad />

        <DataTable
          rows={filas}
          rowKey={(n) => n.id}
          caption="Novedades del período"
          empty={
            conFiltros ? (
              <EmptyState
                bare
                variant="no-results"
                title="No hay novedades con estos filtros"
                action={
                  <ButtonLink href={RUTA.novedades({ desde, hasta })} variant="secondary">
                    Quitar filtros
                  </ButtonLink>
                }
              />
            ) : (
              <EmptyState
                bare
                title="No hay novedades en este período"
                description="Registra horas extra, ausencias, bonos o descuentos para la planilla."
                action={
                  permisos.novedadesCrear && !agregar ? (
                    <ButtonLink href={RUTA.novedades({ desde, hasta, agregar: true })} variant="secondary" icon={<NexoIcon name="plus" />}>
                      Agregar novedad
                    </ButtonLink>
                  ) : null
                }
              />
            )
          }
          columns={[
            { key: "fecha", header: "Fecha", render: (n) => <span className="tabular-nums">{fechaCorta(n.fecha)}</span> },
            {
              key: "persona",
              header: "Persona",
              render: (n) => (
                <span className="flex flex-col">
                  <span className="text-neutral-900">{n.empleado_nombre}</span>
                  <span className="text-xs text-neutral-500 tabular-nums">N.º {n.numero_contrato}</span>
                </span>
              ),
            },
            { key: "concepto", header: "Concepto", render: (n) => n.concepto_nombre },
            { key: "tipo", header: "Tipo", render: (n) => etiqueta(TIPO_CONCEPTO, n.tipo) },
            { key: "valor", header: "Cantidad o monto", numeric: true, render: (n) => cantidadOMonto(n) },
            { key: "origen", header: "Origen", render: (n) => etiqueta(ORIGEN_NOVEDAD, n.origen) },
            {
              key: "estado",
              header: "Estado",
              render: (n) => {
                const v = estadoVisual(ESTADO_NOVEDAD, n.estado);
                return <StatusBadge label={v.label} tone={v.tone} />;
              },
            },
            {
              key: "planilla",
              header: "Planilla",
              render: (n) => {
                if (!n.planilla_id) return "—";
                const v = estadoVisual(ESTADO_PLANILLA, n.planilla_estado);
                return permisos.planillaVer ? (
                  <Link
                    href={RUTA.detalle(n.planilla_id)}
                    className="rounded-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Ver planilla <span className="font-normal text-neutral-500">({v.label.toLowerCase()})</span>
                  </Link>
                ) : (
                  <StatusBadge label={v.label} tone={v.tone} />
                );
              },
            },
            {
              key: "nota",
              header: "Nota",
              width: "12rem",
              truncate: true,
              render: (n) => (n.nota ? <span title={n.nota}>{n.nota}</span> : "—"),
            },
            {
              key: "acciones",
              header: <span className="sr-only">Acciones</span>,
              align: "right",
              render: (n) => {
                if (n.estado === "anulada") return null;
                if (n.origen === "prestamo") {
                  return permisos.prestamosVer ? (
                    <Link href={RUTA.prestamos()} className={ENLACE_PEQUENO}>
                      Se maneja en Préstamos
                    </Link>
                  ) : (
                    <span className="text-xs text-neutral-500">Se maneja en Préstamos</span>
                  );
                }
                if (n.origen === "vacaciones") {
                  return permisos.vacacionesVer ? (
                    <Link href={RUTA.vacaciones()} className={ENLACE_PEQUENO}>
                      Se maneja en Vacaciones
                    </Link>
                  ) : (
                    <span className="text-xs text-neutral-500">Se maneja en Vacaciones</span>
                  );
                }
                if (n.planilla_estado === "aprobada" || n.planilla_estado === "pagada") {
                  return <span className="text-xs text-neutral-500">En planilla aprobada</span>;
                }
                if (!permisos.novedadesAnular || !ANULABLES.has(n.origen)) return null;
                return (
                  <AnularNovedad id={n.id} descripcion={`${n.concepto_nombre} de ${n.empleado_nombre} del ${fechaCorta(n.fecha)}`} />
                );
              },
            },
          ]}
        />
      </AnularNovedadProvider>
    </div>
  );
}
