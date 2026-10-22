import type { Metadata } from "next";
import type { ReactNode } from "react";
import { contextoActual } from "@nexo/auth";
import { Alert, DataTable, EmptyState, MetricCard, PageHeader, fechaCorta, fechaHora, moneda } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, ayudaDeError, conQuery } from "@/lib/planilla/rutas";
import { AVISO_CONTADOR } from "@/lib/planilla/estados";
import { diasTexto, sumarMontos, tarifa } from "@/lib/planilla/formato";
import { esMes, etiquetaMes, leerFecha, leerMes, mesDe, primerDiaMes } from "@/lib/planilla/periodos";
import type { PasivoFila, ProvisionFila } from "@/lib/planilla/tipos";
import { SelectorMes } from "@/components/planilla/selector-mes";
import { BloqueFallo, PaginaSinAcceso, type AccesoPantalla } from "../configuracion/_compartido/estados";
import { FiltroFecha } from "../configuracion/_compartido/filtro-fecha";
import { leerFilasContadas, primero } from "../configuracion/_compartido/lectura";
import { GenerarProvisiones } from "./provisiones-panel";

export const metadata: Metadata = {
  title: "Pasivo laboral · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Pasivo laboral",
  pantalla: "el pasivo laboral",
  permiso: "Ver planillas",
};

type CopiaFila = Pick<
  ProvisionFila,
  "contrato_id" | "fecha_corte" | "vacaciones_monto" | "aguinaldo_monto" | "indemnizacion_monto" | "total" | "generado_en"
>;

function MontoYDias({ monto, dias }: { monto: number; dias: number }) {
  return (
    <span className="flex flex-col items-end">
      <span>{moneda(monto)}</span>
      <span className="text-xs text-neutral-500">{diasTexto(dias, 4)}</span>
    </span>
  );
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-900 tabular-nums">{children}</dd>
    </div>
  );
}

/** Lo más reciente de una lista de textos ISO (fechas o marcas de tiempo). */
function maximo(valores: readonly string[]): string | null {
  let m: string | null = null;
  for (const v of valores) if (m === null || v > m) m = v;
  return m;
}

/**
 * A4. Pasivo laboral vivo (planilla_pasivo_laboral, planilla.ver): lo que se
 * debe a una fecha en vacaciones, aguinaldo e indemnización de cada contrato
 * activo, con el salario actual. Montos de la RPC; la vista solo suma para
 * los KPIs (sumarMontos). Debajo, la copia mensual de provisiones
 * (rrhh.provisiones, planilla.ver) y el botón para guardarla
 * (planilla_provisiones_generar, planilla.generar).
 */
export default async function PasivoPage({ searchParams }: PageProps<"/planillas/pasivo">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.planillaVer) return <PaginaSinAcceso {...ACCESO} />;

  const hoy = hoyManagua();
  const fecha = leerFecha(params.fecha, hoy);
  const mesParam = primero(params.mes);
  const mes = leerMes(mesParam, hoy);

  const [pasivo, copia] = await Promise.all([
    consultarRpc<PasivoFila[]>(
      ctx,
      "planilla_pasivo_laboral",
      { p_fecha: fecha },
      "planilla_pasivo_laboral",
      "No se pudo calcular el pasivo laboral. Intenta de nuevo."
    ),
    leerFilasContadas<CopiaFila>(
      ctx.supabase
        .schema("rrhh")
        .from("provisiones")
        .select("contrato_id, fecha_corte, vacaciones_monto, aguinaldo_monto, indemnizacion_monto, total, generado_en", {
          count: "exact",
        })
        .eq("company_id", ctx.companyId)
        .eq("mes", primerDiaMes(mes)),
      "provisiones: copia del mes",
      "No se pudo cargar la copia de provisiones. Intenta de nuevo."
    ),
  ]);

  const filas = pasivo.ok && Array.isArray(pasivo.valor) ? pasivo.valor : [];
  const n = filas.length;
  const nombreMes = etiquetaMes(mes);
  const futuro = mes > mesDe(hoy);

  const copiaFilas = copia.ok ? copia.valor.filas : [];
  const copiaIncompleta = copia.ok && copia.valor.conteo !== null && copia.valor.conteo > copiaFilas.length;
  const copiaGuardada = copiaFilas.length > 0 ? maximo(copiaFilas.map((f) => f.generado_en)) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pasivo laboral"
        description="Lo que la empresa debe a una fecha en vacaciones, aguinaldo e indemnización de los contratos activos."
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <FiltroFecha
          key={fecha}
          fecha={fecha}
          hoy={hoy}
          label="Pasivo al"
          hrefHoy={conQuery(RUTA.pasivo(), { mes: esMes(mesParam) ? mesParam : undefined })}
        />
      </div>

      <Alert tone="info">
        {AVISO_CONTADOR} El pasivo usa el salario actual de cada contrato (cambia el valor, no el tiempo).
      </Alert>

      {!pasivo.ok ? (
        <BloqueFallo
          fallo={pasivo}
          que="el pasivo laboral"
          titulo="No se pudo calcular el pasivo"
          acceso={ACCESO}
          ayuda={ayudaDeError(pasivo.mensaje, permisos)}
        />
      ) : n === 0 ? (
        <EmptyState
          title={`No hay contratos activos al ${fechaCorta(fecha)}`}
          description="El pasivo se calcula para los contratos activos con salario."
        />
      ) : (
        <>
          <section aria-labelledby="pasivo-resumen">
            <h2 id="pasivo-resumen" className="sr-only">
              Resumen del pasivo
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Pasivo total"
                value={moneda(sumarMontos(filas.map((f) => f.total)))}
                hint={`${n === 1 ? "1 contrato activo" : `${n} contratos activos`} al ${fechaCorta(fecha)}`}
              />
              <MetricCard
                label="Vacaciones"
                value={moneda(sumarMontos(filas.map((f) => f.vacaciones_monto)))}
                hint="Saldo de días por el salario diario actual"
              />
              <MetricCard
                label="Aguinaldo"
                value={moneda(sumarMontos(filas.map((f) => f.aguinaldo_monto)))}
                hint="Días acumulados del aguinaldo en curso"
              />
              <MetricCard
                label="Indemnización"
                value={moneda(sumarMontos(filas.map((f) => f.indemnizacion_monto)))}
                hint="Contratos por tiempo indeterminado (art. 45)"
              />
            </div>
          </section>

          <DataTable
            rows={filas}
            rowKey={(f) => f.contrato_id}
            caption={`Pasivo laboral por contrato al ${fechaCorta(fecha)}`}
            columns={[
              {
                key: "persona",
                header: "Persona",
                render: (f) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-neutral-900">{f.empleado_nombre}</span>
                    <span className="text-xs text-neutral-500 tabular-nums">N.º {f.numero_contrato}</span>
                  </span>
                ),
              },
              { key: "total", header: "Total", numeric: true, render: (f) => <span className="font-medium">{moneda(f.total)}</span> },
              { key: "salario", header: "Salario mensual", numeric: true, render: (f) => moneda(f.salario_mensual) },
              { key: "diario", header: "Diario", numeric: true, render: (f) => tarifa(f.salario_diario) },
              {
                key: "vacaciones",
                header: "Vacaciones",
                numeric: true,
                render: (f) => <MontoYDias monto={f.vacaciones_monto} dias={f.vacaciones_dias} />,
              },
              {
                key: "aguinaldo",
                header: "Aguinaldo",
                numeric: true,
                render: (f) => <MontoYDias monto={f.aguinaldo_monto} dias={f.aguinaldo_dias} />,
              },
              {
                key: "indemnizacion",
                header: "Indemnización",
                numeric: true,
                render: (f) => <MontoYDias monto={f.indemnizacion_monto} dias={f.indemnizacion_dias} />,
              },
            ]}
          />
        </>
      )}

      <section
        aria-labelledby="provisiones-mes"
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 id="provisiones-mes" className="text-sm font-semibold text-neutral-900">
              Provisiones mensuales
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              Guarda la foto del pasivo a fin de mes para el histórico y la contabilidad. Se puede repetir: no duplica.
            </p>
          </div>
          <SelectorMes mes={mes} label="Mes de las provisiones" />
        </div>

        {!copia.ok ? (
          <BloqueFallo
            fallo={copia}
            que="la copia de provisiones"
            acceso={{ pantalla: "las provisiones", permiso: ACCESO.permiso }}
          />
        ) : copiaFilas.length === 0 ? (
          <p className="text-sm text-neutral-600">Todavía no se guardó la copia de {nombreMes}.</p>
        ) : (
          <>
            {copiaIncompleta ? (
              <Alert tone="warning">
                La copia tiene más contratos de los que se pueden mostrar aquí: los totales están incompletos.
              </Alert>
            ) : null}
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato label={`Copia de ${nombreMes}`}>
                {copiaFilas.length === 1 ? "1 contrato" : `${copiaFilas.length} contratos`}
              </Dato>
              <Dato label="Fecha de corte">{fechaCorta(maximo(copiaFilas.map((f) => f.fecha_corte)))}</Dato>
              <Dato label="Guardada el">{fechaHora(copiaGuardada)}</Dato>
              <Dato label="Total">{moneda(sumarMontos(copiaFilas.map((f) => f.total)))}</Dato>
              <Dato label="Vacaciones">{moneda(sumarMontos(copiaFilas.map((f) => f.vacaciones_monto)))}</Dato>
              <Dato label="Aguinaldo">{moneda(sumarMontos(copiaFilas.map((f) => f.aguinaldo_monto)))}</Dato>
              <Dato label="Indemnización">{moneda(sumarMontos(copiaFilas.map((f) => f.indemnizacion_monto)))}</Dato>
            </dl>
          </>
        )}

        {permisos.planillaGenerar ? (
          <GenerarProvisiones mes={mes} futuro={futuro} copiaDel={copiaGuardada} />
        ) : null}
      </section>
    </div>
  );
}
