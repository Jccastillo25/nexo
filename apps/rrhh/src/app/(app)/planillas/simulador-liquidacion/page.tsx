import type { Metadata } from "next";
import Link from "next/link";
import { contextoActual } from "@nexo/auth";
import { Alert, EmptyState, MetricCard, PageHeader, fechaCorta, moneda } from "@nexo/ui";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { ayudaDeError, consultarRpc, contratosOpciones } from "@/lib/planilla/servidor";
import { SIMULACION_NO_GUARDA } from "@/lib/planilla/estados";
import { REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, diasTexto, tarifa } from "@/lib/planilla/formato";
import type { LiquidacionSimulada } from "@/lib/planilla/tipos";
import { FalloLectura, SinAcceso } from "../liquidaciones/_compartido/fallo-lectura";
import { TablaLineas, type FilaLinea } from "../liquidaciones/_compartido/tabla-lineas";
import { leerSimulacion } from "./parametros";
import { PrepararLiquidacion } from "./preparar-liquidacion";
import { SimuladorForm, type ContratoSimulable } from "./simulador-form";

export const metadata: Metadata = {
  title: "Simulador de liquidación · RRHH",
};

const ACCESO = { pantalla: "Simulador de liquidación", permiso: "Calcular liquidaciones" };
const DESCRIPCION = "Calcula la liquidación final de un contrato con las reglas vigentes antes de prepararla.";
const CLASE_ENLACE =
  "rounded-sm font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Simulador de liquidación (C7), con liquidaciones.calcular. El estado vive en
 * la URL; el Server Component llama a planilla_liquidacion_simular y muestra
 * exactamente lo que devuelve (líneas, préstamos que se descontarían, totales
 * y avisos): la vista no suma ni recalcula. No guarda nada; "Preparar
 * liquidación" sí la guarda (planilla_liquidacion_crear).
 */
export default async function SimuladorLiquidacionPage({ searchParams }: PageProps<"/planillas/simulador-liquidacion">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);

  if (!permisos.liquidacionesCalcular) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Simulador de liquidación" />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const hoy = hoyManagua();
  const { valores, valida, errores, pedida } = leerSimulacion(sp);
  const [opcionesR, simulacionR] = await Promise.all([
    contratosOpciones(ctx),
    valida
      ? consultarRpc<LiquidacionSimulada>(
          ctx,
          "planilla_liquidacion_simular",
          {
            p_contrato_id: valida.contratoId,
            p_fecha_egreso: valida.egreso,
            p_causa: valida.causa,
            p_dias_vacaciones: valida.vacaciones,
            p_dias_salario_pendiente: valida.pendiente,
            p_meses_confianza: valida.confianza,
          },
          "planilla_liquidacion_simular",
          "No se pudo simular la liquidación. Intenta de nuevo."
        )
      : Promise.resolve(null),
  ]);

  const encabezado = <PageHeader title="Simulador de liquidación" description={DESCRIPCION} />;

  if (!opcionesR.ok) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {encabezado}
        <FalloLectura fallo={opcionesR} titulo="No se pudo cargar la lista de contratos" acceso={ACCESO} />
      </div>
    );
  }

  const contratos: ContratoSimulable[] = opcionesR.valor.map((c) => ({
    contratoId: c.contrato_id,
    etiqueta: `${c.empleado_nombre} · N.º ${c.numero_contrato}${
      c.estado === "finalizado" ? ` (finalizado el ${fechaCorta(c.fecha_fin_real)})` : ""
    }`,
    fechaFin: c.estado === "finalizado" ? c.fecha_fin_real : null,
  }));
  const persona = valida ? opcionesR.valor.find((c) => c.contrato_id === valida.contratoId) : undefined;
  // Enlaces de ayuda para un error de negocio (régimen, parámetros…), solo los que el rol puede abrir.
  const ayuda = simulacionR && !simulacionR.ok && simulacionR.motivo === "negocio" ? ayudaDeError(simulacionR.mensaje, permisos) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {encabezado}

      {contratos.length === 0 ? (
        <Alert tone="info" title="No hay contratos para simular">
          Solo se simula la liquidación de contratos activos o finalizados.
        </Alert>
      ) : (
        <SimuladorForm key={JSON.stringify(valores)} contratos={contratos} valores={valores} errores={errores} hoy={hoy} />
      )}

      {!pedida ? (
        <EmptyState
          title="Elige el contrato, la fecha de egreso y la causa"
          description="La simulación usa el salario, la antigüedad y el saldo de vacaciones registrados, con los parámetros de ley vigentes."
        />
      ) : !valida ? (
        <Alert tone="warning" title="Revisa los datos de la simulación">
          Corrige los campos marcados y vuelve a simular.
        </Alert>
      ) : simulacionR && !simulacionR.ok ? (
        simulacionR.motivo === "negocio" ? (
          <Alert tone="warning" title="No se pudo simular la liquidación">
            <p>{simulacionR.mensaje}</p>
            {ayuda.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {ayuda.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className={CLASE_ENLACE}>
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : (
          <FalloLectura fallo={simulacionR} titulo="No se pudo simular la liquidación" acceso={ACCESO} />
        )
      ) : simulacionR?.ok && simulacionR.valor ? (
        <Resultado
          s={simulacionR.valor}
          persona={persona?.empleado_nombre ?? null}
          finContrato={persona?.estado === "finalizado" ? persona.fecha_fin_real : null}
          vacacionesManual={valida.vacaciones !== null}
          preparar={{
            contratoId: valida.contratoId,
            egreso: valida.egreso,
            causa: valida.causa,
            pendiente: valida.pendiente,
            confianza: valida.confianza,
          }}
          puedeVerLiquidaciones={permisos.liquidacionesVer}
        />
      ) : (
        <EmptyState variant="error" title="No se pudo simular la liquidación" />
      )}
    </div>
  );
}

function Resultado({
  s,
  persona,
  finContrato,
  vacacionesManual,
  preparar,
  puedeVerLiquidaciones,
}: {
  s: LiquidacionSimulada;
  persona: string | null;
  /** Fecha de fin real si el contrato ya está finalizado: la única fecha de egreso con la que se puede preparar. */
  finContrato: string | null;
  vacacionesManual: boolean;
  preparar: React.ComponentProps<typeof PrepararLiquidacion>["simulacion"];
  puedeVerLiquidaciones: boolean;
}) {
  const lineas = Array.isArray(s.lineas) ? s.lineas : [];
  const deducciones = Array.isArray(s.deducciones) ? s.deducciones : [];
  const pagos: FilaLinea[] = lineas.map((x, i) => ({
    clave: `p-${i}-${x.concepto}`,
    concepto: x.nombre,
    detalle: x.desde ? `Desde ${fechaCorta(x.desde)}` : null,
    articulo: x.articulo,
    dias: x.dias,
    diario: x.diario,
    monto: x.monto,
  }));
  const filasDeducciones: FilaLinea[] = deducciones.map((x, i) => ({
    clave: `d-${i}-${x.origen_id}`,
    concepto: x.nombre,
    detalle: x.monto < x.pendiente ? `Saldo pendiente: ${moneda(x.pendiente)}` : null,
    articulo: x.articulo,
    dias: null,
    diario: null,
    monto: x.monto,
  }));

  return (
    <section aria-labelledby="simulacion-resultado" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="simulacion-resultado" className="text-base font-semibold text-neutral-900">
          Resultado{persona ? ` · ${persona}` : ""}
        </h2>
        <p className="text-sm text-neutral-500">
          Egreso {fechaCorta(s.fecha_egreso)} · Régimen {etiqueta(REGIMEN, s.regimen).toLowerCase()} · Salario mensual{" "}
          {moneda(s.salario_mensual)}
        </p>
      </div>

      <Alert tone="info">{SIMULACION_NO_GUARDA}</Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total de la liquidación" value={moneda(s.total)} hint="Antes de descontar préstamos" />
        <MetricCard
          label="Deducciones de préstamos"
          value={moneda(s.total_deducciones)}
          hint={deducciones.length > 0 ? "Nunca del aguinaldo (art. 97)" : "Sin préstamos pendientes"}
        />
        <MetricCard label="Neto a pagar" value={moneda(s.neto)} hint="Total menos deducciones" />
        <MetricCard label="Salario diario" value={tarifa(s.diario)} hint="Base de los pagos por días" />
        <MetricCard
          label="Antigüedad"
          value={decimal(s.meses_antiguedad, 2)}
          unit="meses"
          hint={`Desde ${fechaCorta(s.fecha_antiguedad)}`}
        />
        <MetricCard
          label="Vacaciones del saldo"
          value={s.dias_vacaciones_saldo === null ? "—" : decimal(s.dias_vacaciones_saldo, 2)}
          unit={s.dias_vacaciones_saldo === null ? undefined : "días"}
          tone={vacacionesManual ? "warning" : "neutral"}
          hint={
            vacacionesManual
              ? `La simulación usa ${diasTexto(s.dias_vacaciones)} escritos a mano`
              : `Se pagan ${diasTexto(s.dias_vacaciones)}`
          }
        />
      </div>

      <AvisosPlanilla avisos={s.avisos} titulo="Avisos de la simulación" />

      <TablaLineas
        id="simulacion-pagos"
        titulo="Pagos"
        caption="Pagos de la liquidación simulada"
        filas={pagos}
        totalLabel="Total de la liquidación"
        total={s.total}
      />

      {filasDeducciones.length > 0 ? (
        <TablaLineas
          id="simulacion-deducciones"
          titulo="Deducciones"
          caption="Préstamos que se descontarían en la liquidación"
          filas={filasDeducciones}
          totalLabel="Total de deducciones"
          total={s.total_deducciones}
        />
      ) : null}

      <p className="text-sm text-neutral-500">
        Los préstamos pendientes se descuentan al preparar la liquidación, nunca del aguinaldo.
      </p>

      <PrepararLiquidacion
        simulacion={preparar}
        vacacionesManual={vacacionesManual}
        finContrato={finContrato}
        puedeVerLiquidaciones={puedeVerLiquidaciones}
      />
    </section>
  );
}
