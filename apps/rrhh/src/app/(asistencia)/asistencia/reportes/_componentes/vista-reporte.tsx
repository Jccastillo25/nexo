import { contextoActual } from "@nexo/auth";
import {
  Alert,
  ButtonLink,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Pagination,
  StatusBadge,
  type DataTableColumn,
} from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosAsistencia } from "@/lib/permisos-asistencia";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarReporte, obtenerOpciones, type Resultado } from "@/lib/reportes-asistencia/datos";
import {
  entero,
  estadoDia,
  filtrosAQuery,
  INFO_REPORTE,
  leerFiltros,
  limiteEnPantalla,
  MAX_FILAS_SIN_EXPORTAR,
  NOTA_SIN_MARCAS,
  NOTA_SOBRE_JORNADA,
  resolverContrato,
  TAMANO_PAGINA,
} from "@/lib/reportes-asistencia/formato";
import { tablaDe, totalesDe, type FilaTabla } from "@/lib/reportes-asistencia/tabla";
import { rutaReporte } from "@/lib/reportes-asistencia/rutas";
import type { DatosReporte, FiltrosReporte, OpcionesReporte, Reporte } from "@/lib/reportes-asistencia/tipos";
import FiltrosReporteForm, { type EmpleadoFiltro } from "./filtros-reporte";
import AccionesExportar from "./acciones-exportar";

type Props = {
  reporte: Reporte;
  searchParams: Record<string, string | string[] | undefined>;
};

/**
 * Pantalla de un reporte de Asistencia (Server Component). Los filtros
 * viven en la URL; sin `rrhh.asistencia.reportes.ver` no consulta nada.
 * Exportar/Imprimir solo aparecen con `rrhh.asistencia.reportes.exportar`.
 *
 * Tope de filas (20261021164902): sin el permiso de exportar, las RPC no
 * devuelven más de 200 filas por llamada (salvo la tarjeta). La pantalla pide
 * lo que diga `limiteEnPantalla` y avisa si el resultado quedó cortado. El PDF
 * y la impresión siguen pidiendo 5 000 filas, solo con el permiso de exportar.
 */
export async function VistaReporte({ reporte, searchParams }: Props) {
  const info = INFO_REPORTE[reporte];
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosAsistencia()]);

  if (!permisos.reportesVer) {
    return <SinAcceso titulo={info.titulo} descripcion={info.descripcion} />;
  }

  const hoy = hoyManagua();
  const { filtros, error } = leerFiltros(reporte, searchParams, hoy);
  const limite = limiteEnPantalla(reporte, permisos.reportesExportar);
  const pagina = { limit: limite, offset: info.paginado ? (filtros.pagina - 1) * TAMANO_PAGINA : 0 };

  let opciones: Resultado<OpcionesReporte>;
  let datos: Resultado<DatosReporte> | null = null;
  let aplicados: FiltrosReporte = filtros;
  let seleccion: "falta_empleado" | "falta_contrato" | "invalido" | null = null;

  if (reporte === "tarjeta") {
    opciones = await obtenerOpciones(supabase, companyId);
    if (!error && opciones.ok) {
      const contrato = resolverContrato(opciones.valor.empleados, filtros.empleadoId, filtros.contratoId);
      if (contrato.estado === "ok") {
        aplicados = { ...filtros, contratoId: contrato.contratoId };
        datos = await consultarReporte(supabase, companyId, reporte, aplicados, pagina);
      } else {
        seleccion = contrato.estado;
      }
    }
  } else {
    [opciones, datos] = await Promise.all([
      obtenerOpciones(supabase, companyId),
      error ? Promise.resolve(null) : consultarReporte(supabase, companyId, reporte, filtros, pagina),
    ]);
  }

  // Acceso denegado por la RPC (rol cambiado entre la carga del menú y la consulta).
  if ((datos && !datos.ok && datos.motivo === "denegado") || (!opciones.ok && opciones.motivo === "denegado")) {
    return <SinAcceso titulo={info.titulo} descripcion={info.descripcion} />;
  }

  const listas = opciones.ok ? opciones.valor : { departamentos: [], puestos: [], empleados: [] };
  const empleados: EmpleadoFiltro[] = listas.empleados.map((e) =>
    reporte === "tarjeta" ? { id: e.id, label: e.label, contratos: e.contratos ?? [] } : { id: e.id, label: e.label }
  );
  const query = filtrosAQuery(reporte, aplicados);
  const valido = datos?.ok ? datos.valor : null;
  const puedeExportar = permisos.reportesExportar && valido !== null && valido.total > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={info.titulo}
        description={info.descripcion}
        actions={
          puedeExportar ? (
            <AccionesExportar reporte={reporte} query={query} desde={aplicados.desde} hasta={aplicados.hasta} />
          ) : undefined
        }
      />

      <FiltrosReporteForm
        key={filtrosAQuery(reporte, filtros)}
        reporte={reporte}
        hoy={hoy}
        valores={filtros}
        departamentos={listas.departamentos}
        puestos={listas.puestos}
        empleados={empleados}
      />

      {!opciones.ok ? (
        <Alert tone="warning">No se pudieron cargar las listas de departamentos, puestos y personas. Recarga la página.</Alert>
      ) : null}

      {error ? (
        <Alert tone="warning">{error}</Alert>
      ) : seleccion === "falta_empleado" ? (
        <EmptyState
          title="Elige una persona"
          description="La tarjeta individual muestra el detalle día a día de un contrato. Elige la persona en los filtros y pulsa Consultar."
        />
      ) : seleccion === "falta_contrato" ? (
        <EmptyState
          title="Elige un contrato"
          description="Esta persona tiene varios contratos. Elige uno en los filtros y pulsa Consultar."
        />
      ) : seleccion === "invalido" ? (
        <Alert tone="warning">
          La persona o el contrato elegido no es válido para este reporte. Vuelve a elegirlo en los filtros.
        </Alert>
      ) : datos && !datos.ok ? (
        <Alert tone="warning">{datos.mensaje}</Alert>
      ) : valido ? (
        <Resultados reporte={reporte} datos={valido} filtros={aplicados} limite={limite} />
      ) : null}
    </div>
  );
}

function SinAcceso({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={titulo} description={descripcion} />
      <EmptyState variant="no-access" title="No tienes acceso a los reportes de Asistencia" />
    </div>
  );
}

function Resultados({
  reporte,
  datos,
  filtros,
  limite,
}: {
  reporte: Reporte;
  datos: DatosReporte;
  filtros: FiltrosReporte;
  limite: number;
}) {
  const info = INFO_REPORTE[reporte];
  const tabla = tablaDe(datos);
  const totales = totalesDe(reporte, datos.totales, datos.total);
  const columnas: DataTableColumn<FilaTabla>[] = tabla.columnas.map((c, i) => ({
    key: c.key,
    header: c.header,
    align: c.derecha ? "right" : "left",
    className:
      c.key === "observaciones"
        ? "min-w-48"
        : c.key === "persona"
          ? "min-w-44"
          : c.derecha || c.key === "fecha" || c.key === "estado"
            ? "whitespace-nowrap tabular-nums"
            : undefined,
    render: (f) => {
      if (c.key === "estado" && f.estado) {
        const e = estadoDia(f.estado);
        return <StatusBadge label={e.label} tone={e.tone} />;
      }
      return f.celdas[i];
    },
  }));

  const notas = [
    ...(reporte !== "tardanzas" ? [NOTA_SIN_MARCAS] : []),
    ...(reporte === "resumen" ? [NOTA_SOBRE_JORNADA] : []),
  ];
  // Sin paginar, la RPC devolvió menos filas que el total: el resultado quedó cortado.
  const cortado = !info.paginado && datos.total > tabla.filas.length;

  return (
    <>
      <section aria-label="Totales del período" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totales.map((t) => (
          <MetricCard key={t.label} label={t.label} value={t.valor} hint={t.hint} />
        ))}
      </section>

      {notas.map((nota) => (
        <p key={nota} className="text-xs text-neutral-500">
          {nota}
        </p>
      ))}

      {cortado ? (
        <Alert tone="warning">
          {limite === MAX_FILAS_SIN_EXPORTAR
            ? `Se muestran las primeras ${entero(MAX_FILAS_SIN_EXPORTAR)} filas de ${entero(datos.total)}. Para ver todas, acota el rango de fechas o los filtros; para el reporte completo en PDF, pide a quien administra Nexo el permiso de exportar reportes.`
            : `Se muestran las primeras ${entero(tabla.filas.length)} filas de ${entero(datos.total)}. Acota el rango de fechas o los filtros para ver el resto.`}
        </Alert>
      ) : null}

      {datos.total === 0 ? (
        <EmptyState
          variant="no-results"
          title="No hay filas para estos filtros"
          description="Amplía el rango de fechas o quita algún filtro y vuelve a consultar."
        />
      ) : tabla.filas.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="Esta página no tiene filas"
          description="El reporte tiene menos páginas de las que pediste."
          action={
            <ButtonLink href={rutaReporte(reporte, filtrosAQuery(reporte, filtros, 1))} variant="secondary">
              Ir a la primera página
            </ButtonLink>
          }
        />
      ) : (
        <DataTable<FilaTabla>
          rows={tabla.filas}
          rowKey={(f) => f.id}
          columns={columnas}
          caption={info.titulo}
          footer={
            info.paginado ? (
              <Pagination
                page={filtros.pagina}
                pageSize={TAMANO_PAGINA}
                total={datos.total}
                hrefForPage={(p) => rutaReporte(reporte, filtrosAQuery(reporte, filtros, p))}
                itemLabel="filas"
              />
            ) : undefined
          }
        />
      )}
    </>
  );
}
