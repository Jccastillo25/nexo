import type { Metadata } from "next";
import type { ReactNode } from "react";
import { contextoActual } from "@nexo/auth";
import {
  Alert,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  TabLinks,
  entero,
  moneda,
  type DataTableColumn,
} from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc, type ContextoPlanilla } from "@/lib/planilla/servidor";
import { RUTA, urlCsvDeclaracion } from "@/lib/planilla/rutas";
import { REGIMEN, TIPO_DECLARACION, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, porcentajeExacto, sumarCantidades, sumarMontos } from "@/lib/planilla/formato";
import { esMes, etiquetaMes, mesAnterior, mesDe, primerDiaMes } from "@/lib/planilla/periodos";
import type { DeclaracionInatec, DeclaracionInss, DeclaracionIr, Resultado, TipoDeclaracion } from "@/lib/planilla/tipos";
import { SelectorMes } from "@/components/planilla/selector-mes";
import { BotonExportarCsv } from "@/components/planilla/boton-exportar-csv";
import { BloqueFallo, PaginaSinAcceso, type AccesoPantalla } from "../configuracion/_compartido/estados";
import { primero } from "../configuracion/_compartido/lectura";

export const metadata: Metadata = {
  title: "Declaraciones · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Declaraciones",
  pantalla: "las declaraciones",
  permiso: "Generar declaraciones",
};

const TIPOS = Object.keys(TIPO_DECLARACION) as TipoDeclaracion[];
const RPC = {
  inss: "planilla_declaracion_inss",
  inatec: "planilla_declaracion_inatec",
  ir: "planilla_declaracion_ir",
} as const;

type Datos =
  | { tipo: "inss"; filas: DeclaracionInss[] }
  | { tipo: "inatec"; filas: DeclaracionInatec[] }
  | { tipo: "ir"; filas: DeclaracionIr[] };

/** Solo la declaración de la pestaña activa (cada consulta queda auditada en la base). */
async function leerDeclaracion(
  ctx: ContextoPlanilla,
  tipo: TipoDeclaracion,
  mes: string
): Promise<Resultado<Datos>> {
  const args = { p_mes: primerDiaMes(mes) };
  const generico = "No se pudo generar la declaración. Intenta de nuevo.";
  if (tipo === "inss") {
    const r = await consultarRpc<DeclaracionInss[]>(ctx, RPC.inss, args, RPC.inss, generico);
    return r.ok ? { ok: true, valor: { tipo, filas: Array.isArray(r.valor) ? r.valor : [] } } : r;
  }
  if (tipo === "inatec") {
    const r = await consultarRpc<DeclaracionInatec[]>(ctx, RPC.inatec, args, RPC.inatec, generico);
    return r.ok ? { ok: true, valor: { tipo, filas: Array.isArray(r.valor) ? r.valor : [] } } : r;
  }
  const r = await consultarRpc<DeclaracionIr[]>(ctx, RPC.ir, args, RPC.ir, generico);
  return r.ok ? { ok: true, valor: { tipo, filas: Array.isArray(r.valor) ? r.valor : [] } } : r;
}

function Persona({ nombre }: { nombre: string }) {
  return <span className="font-medium text-neutral-900">{nombre}</span>;
}

/** Pie de una tabla de declaración: totales de presentación (sumarMontos, en centavos). */
function Totales({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-wrap justify-end gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="font-semibold text-neutral-900 tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function TablaInss({ filas }: { filas: DeclaracionInss[] }) {
  const columnas: DataTableColumn<DeclaracionInss>[] = [
    { key: "persona", header: "Persona", render: (f) => <Persona nombre={f.empleado_nombre} /> },
    { key: "cedula", header: "Cédula", render: (f) => f.documento_identidad ?? "—" },
    {
      key: "inss",
      header: "N.º INSS",
      render: (f) => f.numero_inss ?? <span className="text-neutral-500">Sin registrar</span>,
    },
    { key: "dias", header: "Días", numeric: true, render: (f) => decimal(f.dias, 2) },
    { key: "salario", header: "Salario INSS", numeric: true, render: (f) => moneda(f.salario_inss) },
    { key: "laboral", header: "INSS laboral", numeric: true, render: (f) => moneda(f.inss_laboral) },
    { key: "patronal", header: "INSS patronal", numeric: true, render: (f) => moneda(f.inss_patronal) },
  ];
  return (
    <DataTable
      rows={filas}
      rowKey={(f) => f.empleado_id}
      caption="Declaración del INSS por persona"
      columns={columnas}
      footer={
        <Totales
          items={[
            ["Personas", entero(filas.length)],
            ["Días", decimal(sumarCantidades(filas.map((f) => f.dias), 2), 2)],
            ["Salario INSS", moneda(sumarMontos(filas.map((f) => f.salario_inss)))],
            ["INSS laboral", moneda(sumarMontos(filas.map((f) => f.inss_laboral)))],
            ["INSS patronal", moneda(sumarMontos(filas.map((f) => f.inss_patronal)))],
          ]}
        />
      }
    />
  );
}

function BloqueInatec({ filas }: { filas: DeclaracionInatec[] }) {
  if (filas.length === 1) {
    const f = filas[0];
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Base" value={moneda(f.base)} hint="Salarios que pagan INATEC" />
        <MetricCard label="Tasa" value={porcentajeExacto(f.tasa)} />
        <MetricCard label="Monto a pagar" value={moneda(f.monto)} />
        <MetricCard label="Empleados" value={entero(f.empleados)} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info">La tasa de INATEC cambió dentro del mes: hay una fila por cada tasa.</Alert>
      <DataTable
        rows={filas}
        rowKey={(f) => String(f.tasa)}
        caption="Declaración de INATEC por tasa"
        columns={[
          { key: "tasa", header: "Tasa", render: (f) => porcentajeExacto(f.tasa) },
          { key: "base", header: "Base", numeric: true, render: (f) => moneda(f.base) },
          { key: "monto", header: "Monto", numeric: true, render: (f) => moneda(f.monto) },
          { key: "empleados", header: "Empleados", numeric: true, render: (f) => entero(f.empleados) },
        ]}
        footer={
          <Totales
            items={[
              ["Base", moneda(sumarMontos(filas.map((f) => f.base)))],
              ["Monto a pagar", moneda(sumarMontos(filas.map((f) => f.monto)))],
            ]}
          />
        }
      />
    </div>
  );
}

function TablaIr({ filas }: { filas: DeclaracionIr[] }) {
  return (
    <DataTable
      rows={filas}
      rowKey={(f) => `${f.empleado_id}-${f.regimen}`}
      caption="Declaración de retenciones de IR por persona y régimen"
      columns={[
        { key: "persona", header: "Persona", render: (f) => <Persona nombre={f.empleado_nombre} /> },
        { key: "cedula", header: "Cédula", render: (f) => f.documento_identidad ?? "—" },
        { key: "regimen", header: "Régimen", render: (f) => etiqueta(REGIMEN, f.regimen) },
        { key: "bruta", header: "Renta bruta", numeric: true, render: (f) => moneda(f.renta_bruta) },
        { key: "inss", header: "INSS laboral", numeric: true, render: (f) => moneda(f.inss_laboral) },
        { key: "neta", header: "Renta neta", numeric: true, render: (f) => moneda(f.renta_neta) },
        { key: "ir", header: "IR retenido", numeric: true, render: (f) => moneda(f.ir_retenido) },
      ]}
      footer={
        <Totales
          items={[
            ["Renta bruta", moneda(sumarMontos(filas.map((f) => f.renta_bruta)))],
            ["INSS laboral", moneda(sumarMontos(filas.map((f) => f.inss_laboral)))],
            ["Renta neta", moneda(sumarMontos(filas.map((f) => f.renta_neta)))],
            ["IR retenido", moneda(sumarMontos(filas.map((f) => f.ir_retenido)))],
          ]}
        />
      }
    />
  );
}

/**
 * A5. Declaraciones del mes (INSS, INATEC e IR de la DGI) desde las planillas
 * aprobadas o pagadas cuyo período termina en el mes
 * (planilla_declaracion_*, declaraciones.generar). Por defecto, el mes
 * anterior. "Exportar CSV" exige además reportes.exportar (el Route Handler
 * vuelve a validar los dos).
 */
export default async function DeclaracionesPage({ searchParams }: PageProps<"/planillas/declaraciones">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.declaracionesGenerar) return <PaginaSinAcceso {...ACCESO} />;

  const tipoParam = primero(params.tipo);
  const tipo: TipoDeclaracion = esClaveDe(TIPO_DECLARACION, tipoParam) ? tipoParam : "inss";
  const mesParam = primero(params.mes);
  const mes = esMes(mesParam) ? mesParam : mesAnterior(mesDe(hoyManagua()));
  const nombreMes = etiquetaMes(mes);

  const resultado = await leerDeclaracion(ctx, tipo, mes);
  const filas = resultado.ok ? resultado.valor.filas.length : 0;
  const puedeExportar = permisos.planillaExportar && resultado.ok && filas > 0;

  let contenido: ReactNode;
  if (!resultado.ok) {
    contenido = <BloqueFallo fallo={resultado} que="la declaración" titulo="No se pudo generar la declaración" acceso={ACCESO} />;
  } else if (filas === 0) {
    contenido = (
      <EmptyState
        title={`No hay datos para declarar en ${nombreMes.toLowerCase()}`}
        description="Solo cuentan las planillas aprobadas o pagadas cuyo período termina en el mes."
      />
    );
  } else if (resultado.valor.tipo === "inss") {
    const sinNumero = resultado.valor.filas.some((f) => !f.numero_inss);
    contenido = (
      <div className="flex flex-col gap-4">
        {sinNumero ? <Alert tone="warning">El expediente todavía no guarda el número de INSS.</Alert> : null}
        <TablaInss filas={resultado.valor.filas} />
      </div>
    );
  } else if (resultado.valor.tipo === "inatec") {
    contenido = <BloqueInatec filas={resultado.valor.filas} />;
  } else {
    contenido = <TablaIr filas={resultado.valor.filas} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Declaraciones"
        description="Usa solo las planillas aprobadas o pagadas cuyo período termina en el mes."
        actions={
          puedeExportar ? (
            <BotonExportarCsv url={urlCsvDeclaracion(tipo, mes)} nombreArchivo={`declaracion-${tipo}-${mes}.csv`} />
          ) : null
        }
        tabs={
          <TabLinks
            label="Tipo de declaración"
            items={TIPOS.map((t) => ({ label: TIPO_DECLARACION[t], href: RUTA.declaraciones(t, mes), active: t === tipo }))}
          />
        }
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <SelectorMes mes={mes} label="Mes de la declaración" />
      </div>

      <Alert tone="info">
        Formato oficial (VET de la DGI, SIE del INSS): pendiente de integración. El CSV sirve para revisar y transcribir.
        Plazos de pago: valor pendiente de confirmar con el contador.
      </Alert>

      <section aria-labelledby="declaracion-titulo" className="flex flex-col gap-3">
        <h2 id="declaracion-titulo" className="text-base font-semibold text-neutral-900">
          {TIPO_DECLARACION[tipo]} · {nombreMes}
        </h2>
        {contenido}
      </section>
    </div>
  );
}
