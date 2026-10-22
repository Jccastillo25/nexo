import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import {
  Alert,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
  fechaCorta,
  moneda,
  type DataTableColumn,
} from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, ayudaDeError } from "@/lib/planilla/rutas";
import { AVISO_CONTADOR, NO_ASESORIA } from "@/lib/planilla/estados";
import { REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { montoConSigno, sumarMontos } from "@/lib/planilla/formato";
import { leerFecha } from "@/lib/planilla/periodos";
import type { SimulacionRegimenFila } from "@/lib/planilla/tipos";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { BloqueFallo, PaginaSinAcceso, type AccesoPantalla } from "../configuracion/_compartido/estados";
import { FiltroFecha } from "../configuracion/_compartido/filtro-fecha";

export const metadata: Metadata = {
  title: "Simulador de régimen · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Simulador de régimen",
  pantalla: "el simulador de régimen",
  permiso: "Ver régimen de contratación",
};

/**
 * A3. Simulador de costo mensual por régimen (planilla_simular_regimen,
 * regimen.ver). No guarda nada. Todos los montos son los de la RPC; la vista
 * solo suma para los KPIs (sumarMontos). Sin planilla.ver ni
 * compensacion.ver la RPC devuelve salario y costos en null: la pantalla
 * oculta esas columnas y los KPIs (el gestor no ve salarios).
 */
export default async function SimuladorRegimenPage({ searchParams }: PageProps<"/planillas/simulador-regimen">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.regimenVer) return <PaginaSinAcceso {...ACCESO} />;

  const hoy = hoyManagua();
  const fecha = leerFecha(params.fecha, hoy);
  const resultado = await consultarRpc<SimulacionRegimenFila[]>(
    ctx,
    "planilla_simular_regimen",
    { p_fecha: fecha },
    "planilla_simular_regimen",
    "No se pudo simular el costo por régimen. Intenta de nuevo."
  );

  const encabezado = (
    <PageHeader
      title="Simulador de régimen"
      description={`Simulación con los parámetros vigentes al ${fechaCorta(fecha)}. No guarda nada.`}
    />
  );
  const filtro = (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <FiltroFecha key={fecha} fecha={fecha} hoy={hoy} label="Parámetros vigentes al" hrefHoy={RUTA.simuladorRegimen()} />
    </div>
  );
  const avisoFijo = (
    <Alert tone="info" title="Simulación: no se guarda ni cambia ningún contrato">
      <p>{AVISO_CONTADOR}</p>
      <p className="mt-1">{NO_ASESORIA}</p>
    </Alert>
  );

  if (!resultado.ok) {
    return (
      <div className="flex flex-col gap-6">
        {encabezado}
        {filtro}
        <BloqueFallo
          fallo={resultado}
          que="la simulación"
          titulo="No se pudo simular"
          acceso={ACCESO}
          ayuda={ayudaDeError(resultado.mensaje, permisos)}
        />
      </div>
    );
  }

  const filas = Array.isArray(resultado.valor) ? resultado.valor : [];
  const veMontos = filas.some((f) => f.salario_mensual !== null || f.costo_laboral !== null);
  const avisos = filas.length > 0 ? filas[0].avisos : [];
  const n = filas.length;

  const columnas: DataTableColumn<SimulacionRegimenFila>[] = [
    {
      key: "persona",
      header: "Persona",
      render: (f) => (
        <span className="flex min-w-0 flex-col">
          <span>{f.empleado_nombre}</span>
          <span className="text-xs font-normal text-neutral-500 tabular-nums">N.º {f.numero_contrato}</span>
        </span>
      ),
    },
    {
      key: "regimen",
      header: "Régimen actual",
      render: (f) =>
        f.regimen_actual ? etiqueta(REGIMEN, f.regimen_actual) : <StatusBadge label="Sin régimen" tone="negative" />,
    },
  ];
  if (veMontos) {
    columnas.push(
      { key: "salario", header: "Salario mensual", numeric: true, render: (f) => moneda(f.salario_mensual) },
      { key: "laboral", header: "Costo laboral", numeric: true, render: (f) => moneda(f.costo_laboral) },
      { key: "servicios", header: "Costo servicios profesionales", numeric: true, render: (f) => moneda(f.costo_servicios) },
      { key: "diferencia", header: "Diferencia", numeric: true, render: (f) => montoConSigno(f.diferencia) },
      { key: "inss", header: "INSS patronal", numeric: true, render: (f) => moneda(f.inss_patronal) },
      { key: "inatec", header: "INATEC", numeric: true, render: (f) => moneda(f.inatec) },
      {
        key: "prov-laboral",
        header: "Provisiones (laboral)",
        numeric: true,
        render: (f) => moneda(f.provisiones_laboral),
      },
      {
        key: "prov-servicios",
        header: "Provisiones (servicios)",
        numeric: true,
        render: (f) => moneda(f.provisiones_servicios),
      }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {encabezado}
      {filtro}
      {avisoFijo}
      <AvisosPlanilla avisos={avisos} />

      {n > 0 && veMontos ? (
        <section aria-labelledby="simulador-resumen" className="flex flex-col gap-3">
          <h2 id="simulador-resumen" className="sr-only">
            Resumen de la simulación
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Si todos fueran régimen laboral"
              value={moneda(sumarMontos(filas.map((f) => f.costo_laboral)))}
              hint="Costo mensual: salario, INSS patronal, INATEC y provisiones"
            />
            <MetricCard
              label="Si todos fueran servicios profesionales"
              value={moneda(sumarMontos(filas.map((f) => f.costo_servicios)))}
              hint="Costo mensual: salario y las prestaciones que lleva su régimen"
            />
            <MetricCard
              label="Diferencia mensual"
              value={montoConSigno(sumarMontos(filas.map((f) => f.diferencia)))}
              hint={`Lo que cuesta de más el régimen laboral · ${n === 1 ? "1 contrato activo" : `${n} contratos activos`}`}
            />
          </div>
        </section>
      ) : null}

      {n > 0 && !veMontos ? (
        <Alert tone="info" title="Tu rol no permite ver salarios">
          Se muestran solo el régimen actual y los avisos. Los costos los ve quien puede ver planillas o la compensación de
          los contratos.
        </Alert>
      ) : null}

      <DataTable
        rows={filas}
        rowKey={(f) => f.contrato_id}
        rowHref={(f) => RUTA.regimenContrato(f.contrato_id)}
        caption={`Costo mensual por régimen de cada contrato activo al ${fechaCorta(fecha)}`}
        empty={
          <EmptyState
            bare
            title="No hay contratos activos con salario"
            description={`El simulador compara los contratos activos con salario al ${fechaCorta(fecha)}.`}
          />
        }
        columns={columnas}
      />

      {n > 0 ? (
        <p className="text-xs text-neutral-500">
          En régimen laboral la persona recibe un neto menor por el INSS laboral y el IR. La retención de IR de servicios
          profesionales no es costo de la empresa.
        </p>
      ) : null}
    </div>
  );
}
