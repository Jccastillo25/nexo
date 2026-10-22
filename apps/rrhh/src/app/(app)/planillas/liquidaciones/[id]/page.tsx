import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, MetricCard, PageHeader, StatusBadge, fechaCorta, fechaHora, moneda } from "@nexo/ui";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua } from "@/lib/fecha-managua";
import { consultarRpc, usuarioActualId } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import {
  ESTADO_LIQUIDACION,
  SOLO_LECTURA_LIQUIDACION,
  esAutorDeLiquidacion,
  estadoVisual,
  hayAvisosContador,
} from "@/lib/planilla/estados";
import { CAUSA_LIQUIDACION, CAUSA_LIQUIDACION_TODAS, METODO_PAGO, REGIMEN, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, diasTexto, tarifa } from "@/lib/planilla/formato";
import type { LiquidacionDetalle, LiquidacionDocumento, LineaLiquidacion } from "@/lib/planilla/tipos";
import { FalloLectura, SinAcceso } from "../_compartido/fallo-lectura";
import { TablaLineas, type FilaLinea } from "../_compartido/tabla-lineas";
import { AccionesLiquidacion } from "./acciones-liquidacion";

export const metadata: Metadata = {
  title: "Liquidación · RRHH",
};

const ACCESO = { pantalla: "Liquidaciones", permiso: "Ver liquidaciones" };
const NO_ENCONTRADA = "Liquidación no encontrada.";

function filasDe(lineas: LineaLiquidacion[], tipo: LineaLiquidacion["tipo"]): FilaLinea[] {
  return lineas
    .filter((x) => x.tipo === tipo)
    .map((x, i) => ({
      clave: `${tipo}-${i}-${x.concepto}`,
      concepto: x.nombre,
      articulo: x.articulo,
      dias: x.dias,
      diario: x.diario,
      monto: x.monto,
    }));
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{termino}</dt>
      <dd className="text-sm text-neutral-900 tabular-nums">{children}</dd>
    </div>
  );
}

/** Aviso según el estado (solo lectura, pagada, anulada). */
function AvisoEstado({ l, puedeSimular }: { l: LiquidacionDocumento; puedeSimular: boolean }) {
  if (l.estado === "aprobada") {
    return (
      <Alert tone="info" title={`Aprobada el ${fechaHora(l.aprobada_en)}`}>
        {SOLO_LECTURA_LIQUIDACION}
      </Alert>
    );
  }
  if (l.estado === "pagada") {
    const referencia = l.referencia_pago ? ` · Ref. ${l.referencia_pago}` : "";
    return (
      <Alert tone="info" title={`Pagada el ${fechaCorta(l.fecha_pago)} con ${etiqueta(METODO_PAGO, l.metodo_pago).toLowerCase()}${referencia}`}>
        Aprobada el {fechaHora(l.aprobada_en)}. Una liquidación pagada ya no se anula: la corrección de un pago está pendiente de
        definir con el contador.
      </Alert>
    );
  }
  if (l.estado === "anulada") {
    const simulable = esClaveDe(CAUSA_LIQUIDACION, l.causa);
    return (
      <Alert
        tone="warning"
        title={`Anulada el ${fechaHora(l.anulada_en)}`}
        action={
          puedeSimular ? (
            <ButtonLink
              href={RUTA.simuladorLiquidacion({
                contrato: l.contrato_id,
                egreso: l.fecha_egreso,
                causa: simulable ? l.causa : undefined,
              })}
              variant="secondary"
              size="sm"
            >
              Simular otra liquidación
            </ButtonLink>
          ) : null
        }
      >
        Motivo: {l.motivo_anulacion ?? "—"}.
        {l.aprobada_en ? " El contrato sigue finalizado: un contrato finalizado no se reabre." : ""}
      </Alert>
    );
  }
  return null;
}

/**
 * Documento de liquidación (C8), con liquidaciones.ver. Fuente:
 * planilla_liquidacion_detalle (la fila guardada sin hash ni resultado, la
 * empresa y las líneas). Todos los montos son los guardados por la RPC; la
 * vista no suma ni recalcula. Calculada: se puede volver a calcular y la
 * aprueba otra persona. Aprobada o pagada: solo lectura.
 */
export default async function LiquidacionPage({ params }: PageProps<"/planillas/liquidaciones/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  const volver = { href: RUTA.liquidaciones(), label: "Liquidaciones" };

  if (!permisos.liquidacionesVer) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Liquidación" back={volver} />
        <SinAcceso {...ACCESO} />
      </div>
    );
  }

  const [detalleR, userId] = await Promise.all([
    consultarRpc<LiquidacionDetalle>(ctx, "planilla_liquidacion_detalle", { p_liquidacion_id: id }, "planilla_liquidacion_detalle"),
    usuarioActualId(),
  ]);
  if (!detalleR.ok) {
    if (detalleR.motivo === "negocio" && detalleR.mensaje === NO_ENCONTRADA) notFound();
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title="Liquidación" back={volver} />
        <FalloLectura fallo={detalleR} titulo="No se pudo cargar la liquidación" acceso={ACCESO} />
      </div>
    );
  }
  if (!detalleR.valor?.liquidacion) notFound();

  const l = detalleR.valor.liquidacion;
  const lineas = Array.isArray(detalleR.valor.lineas) ? detalleR.valor.lineas : [];
  const pagos = filasDe(lineas, "devengado");
  const deducciones = filasDe(lineas, "deduccion");
  const estado = estadoVisual(ESTADO_LIQUIDACION, l.estado);
  const causa = etiqueta(CAUSA_LIQUIDACION_TODAS, l.causa);
  // Solo un contrato activo se finaliza al aprobar (D3): ahí aplican la fecha de
  // egreso y el permiso de finalizar contratos. La RPC vuelve a validarlo.
  const contratoActivo = l.contrato_estado === "activo";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={`Liquidación de ${l.empleado_nombre}`}
        description={`Contrato N.º ${l.numero_contrato} · Egreso ${fechaCorta(l.fecha_egreso)} · ${causa}`}
        meta={<StatusBadge label={estado.label} tone={estado.tone} />}
        back={volver}
      />

      <AccionesLiquidacion
        liquidacion={{
          id: l.id,
          estado: l.estado,
          persona: l.empleado_nombre,
          fechaEgreso: l.fecha_egreso,
          neto: l.neto,
          avisosContador: hayAvisosContador(l.avisos),
          contratoActivo,
        }}
        permisos={{
          recalcular: permisos.liquidacionesCalcular,
          aprobar: permisos.liquidacionesAprobar,
          pagar: permisos.liquidacionesPagar,
          anular: permisos.liquidacionesAnular,
          imprimir: permisos.liquidacionesVer,
          finalizarContratos: permisos.contratosFinalizar,
        }}
        esAutor={esAutorDeLiquidacion(l, userId)}
        hoy={hoyManagua()}
      />

      <AvisoEstado l={l} puedeSimular={permisos.liquidacionesCalcular} />

      {l.estado === "calculada" ? (
        <section aria-labelledby="para-aprobar" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 id="para-aprobar" className="text-sm font-semibold text-neutral-900">
            Para aprobar
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>La aprueba una persona distinta de quien la creó o la calculó.</li>
            {contratoActivo ? (
              <li>
                El contrato sigue activo: al aprobar se finaliza con la fecha de egreso ({fechaCorta(l.fecha_egreso)}). Se puede
                aprobar desde ese día, y hace falta también el permiso de finalizar contratos.
              </li>
            ) : (
              <li>El contrato ya no está activo: aprobar la liquidación no lo cambia.</li>
            )}
            <li>
              Si cambió algo después del cálculo (saldo de vacaciones, préstamos, salario), vuelve a calcularla antes de aprobar.
              {permisos.contratosVer ? (
                <>
                  {" "}
                  <Link
                    href={RUTA.fichaContrato(l.contrato_id)}
                    className="rounded-sm font-medium text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Ver el contrato
                  </Link>
                </>
              ) : null}
            </li>
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="liquidacion-resumen" className="flex flex-col gap-3">
        <h2 id="liquidacion-resumen" className="sr-only">
          Totales de la liquidación
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Devengado" value={moneda(l.total_devengado)} hint="Pagos de la liquidación" />
          <MetricCard
            label="Deducciones"
            value={moneda(l.total_deducciones)}
            hint={deducciones.length > 0 ? "Saldo de préstamos, nunca del aguinaldo" : "Sin préstamos pendientes"}
          />
          <MetricCard label="Neto a pagar" value={moneda(l.neto)} hint="Devengado menos deducciones" />
        </div>
      </section>

      <AvisosPlanilla avisos={l.avisos} titulo="Avisos de la liquidación" />

      <TablaLineas
        id="liquidacion-pagos"
        titulo="Pagos"
        caption="Pagos de la liquidación"
        filas={pagos}
        totalLabel="Total devengado"
        total={l.total_devengado}
      />

      {deducciones.length > 0 ? (
        <TablaLineas
          id="liquidacion-deducciones"
          titulo="Deducciones"
          caption="Deducciones de la liquidación"
          filas={deducciones}
          totalLabel="Total de deducciones"
          total={l.total_deducciones}
        />
      ) : null}

      <p className="text-sm text-neutral-500">El aguinaldo no lleva descuentos (art. 97 del Código del Trabajo).</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="liquidacion-datos" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 id="liquidacion-datos" className="text-sm font-semibold text-neutral-900">
            Datos del cálculo
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dato termino="Régimen">{etiqueta(REGIMEN, l.regimen)}</Dato>
            <Dato termino="Inicio del contrato">{fechaCorta(l.fecha_inicio)}</Dato>
            <Dato termino="Antigüedad desde">{fechaCorta(l.fecha_antiguedad)}</Dato>
            <Dato termino="Antigüedad">{l.meses_antiguedad === null ? "—" : `${decimal(l.meses_antiguedad, 2)} meses`}</Dato>
            <Dato termino="Salario mensual">{moneda(l.salario_mensual)}</Dato>
            <Dato termino="Salario diario">{tarifa(l.salario_diario)}</Dato>
            <Dato termino="Vacaciones pagadas">{diasTexto(l.dias_vacaciones)}</Dato>
            <Dato termino="Saldo de vacaciones al egreso">{diasTexto(l.dias_vacaciones_saldo)}</Dato>
            <Dato termino="Días de salario pendiente">{diasTexto(l.dias_salario_pendiente)}</Dato>
            {l.meses_confianza !== null ? <Dato termino="Meses adicionales (art. 47)">{decimal(l.meses_confianza, 2)}</Dato> : null}
          </dl>
          {l.nota ? <p className="mt-3 text-sm whitespace-pre-line text-neutral-700">Nota: {l.nota}</p> : null}
        </section>

        <section aria-labelledby="liquidacion-trazabilidad" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 id="liquidacion-trazabilidad" className="text-sm font-semibold text-neutral-900">
            Trazabilidad
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dato termino="Preparada">{fechaHora(l.created_at)}</Dato>
            <Dato termino="Calculada">{fechaHora(l.calculada_en)}</Dato>
            <Dato termino="Aprobada">{fechaHora(l.aprobada_en)}</Dato>
            <Dato termino="Pagada">
              {l.pagada_en
                ? `${fechaCorta(l.fecha_pago)} · ${etiqueta(METODO_PAGO, l.metodo_pago)}${l.referencia_pago ? ` · Ref. ${l.referencia_pago}` : ""}`
                : "—"}
            </Dato>
            <Dato termino="Anulada">
              {l.anulada_en ? `${fechaHora(l.anulada_en)}${l.motivo_anulacion ? ` · ${l.motivo_anulacion}` : ""}` : "—"}
            </Dato>
          </dl>
        </section>
      </div>
    </div>
  );
}
