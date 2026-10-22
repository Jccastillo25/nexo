import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { fechaCorta, moneda } from "@nexo/ui";
import { EncabezadoImpresion, HojaImpresion, PaginaImpresion, PieImpresion, textoEmision } from "@/components/planilla/hoja-impresion";
import { permisosDe } from "@/lib/permisos-rrhh";
import { AGUINALDO_SIN_DEDUCCIONES } from "@/lib/planilla/estados";
import { REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { cantidadConUnidad, diasTexto } from "@/lib/planilla/formato";
import { etiquetaPeriodo, rangoFechas } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import type { Linea, Renglon } from "@/lib/planilla/tipos";
import { detallePlanilla } from "@/app/(app)/planillas/periodos/datos";

export const metadata: Metadata = { title: "Colillas de pago · Planilla · RRHH" };

const CLASE_ENLACE =
  "rounded-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/** Aviso a pantalla completa (sin documento): permiso, estado o planilla vacía. */
function Aviso({ titulo, children, volver }: { titulo: string; children: React.ReactNode; volver: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold text-neutral-900">{titulo}</h1>
      <p role="alert" className="text-sm text-neutral-600">
        {children}
      </p>
      <Link href={volver} className={CLASE_ENLACE}>
        Volver a la planilla
      </Link>
    </main>
  );
}

/** Tabla de ingresos o deducciones de una colilla (Concepto · Cantidad · Monto). */
function TablaColilla({ titulo, lineas, vacio }: { titulo: string; lineas: Linea[]; vacio: string }) {
  return (
    <table className="w-full border-collapse text-left text-xs print:text-[8.5pt]">
      <caption className="mb-1 text-left text-sm font-semibold text-neutral-900">{titulo}</caption>
      <thead>
        <tr className="bg-neutral-100">
          <th scope="col" className="border border-neutral-300 px-2 py-1 font-semibold text-neutral-900">
            Concepto
          </th>
          <th scope="col" className="w-32 border border-neutral-300 px-2 py-1 text-right font-semibold text-neutral-900">
            Cantidad
          </th>
          <th scope="col" className="w-32 border border-neutral-300 px-2 py-1 text-right font-semibold text-neutral-900">
            Monto
          </th>
        </tr>
      </thead>
      <tbody>
        {lineas.length === 0 ? (
          <tr>
            <td colSpan={3} className="border border-neutral-300 px-2 py-1 text-neutral-600">
              {vacio}
            </td>
          </tr>
        ) : (
          lineas.map((l, i) => (
            <tr key={`${l.concepto_codigo}-${i}`} className="break-inside-avoid">
              <td className="border border-neutral-300 px-2 py-1 text-neutral-800">{l.concepto_nombre}</td>
              <td className="border border-neutral-300 px-2 py-1 text-right whitespace-nowrap text-neutral-800 tabular-nums">
                {cantidadConUnidad(l.cantidad, l.unidad)}
              </td>
              <td className="border border-neutral-300 px-2 py-1 text-right whitespace-nowrap text-neutral-800 tabular-nums">
                {moneda(l.monto)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ordenadas(lineas: Linea[], tipo: Linea["tipo"]): Linea[] {
  return lineas.filter((l) => l.tipo === tipo).sort((a, b) => a.orden - b.orden);
}

/**
 * Colillas imprimibles (B9, planilla.ver; layout (impresion-planilla), que ya
 * exige rrhh.ver_modulo). Una colilla por página (A4 vertical); con
 * `?contrato=` solo la de esa persona. Solo de planillas aprobadas o pagadas.
 *
 * Cada colilla lleva TODAS las líneas de ingresos y de deducciones del
 * renglón (D12) y nunca los aportes patronales ni las provisiones. Los
 * totales y el neto son los del renglón (la RPC), sin sumar en la vista.
 * Título "Colilla de pago" con "Salario mensual" (régimen laboral) o "Recibo
 * de honorarios" con "Honorario mensual" (servicios profesionales).
 */
export default async function ColillasPage({ params, searchParams }: PageProps<"/planillas/imprimir/colillas/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const sp = await searchParams;
  const contratoParam = Array.isArray(sp.contrato) ? sp.contrato[0] : sp.contrato;
  const contratoId = esUuid(contratoParam) ? contratoParam : null;
  const volver = contratoId ? RUTA.persona(id, contratoId) : RUTA.detalle(id);

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.planillaVer) {
    return (
      <Aviso titulo="No tienes permiso para imprimir colillas" volver={volver}>
        Tu rol no permite ver planillas. Pide el permiso «Ver planillas» a quien administra Nexo.
      </Aviso>
    );
  }

  const r = await detallePlanilla(ctx, id);
  if (r === "no-encontrada") notFound();
  if (!r.ok) {
    return (
      <Aviso titulo="No se pudo preparar la impresión" volver={volver}>
        {r.motivo === "negocio" ? r.mensaje : "No se pudo cargar la planilla. Intenta de nuevo en unos minutos."}
      </Aviso>
    );
  }

  const { planilla: p, empresa } = r.valor;
  if (p.estado !== "aprobada" && p.estado !== "pagada") {
    return (
      <Aviso titulo="Las colillas todavía no se pueden imprimir" volver={volver}>
        Las colillas se imprimen cuando la planilla está aprobada.
      </Aviso>
    );
  }

  let renglones: Renglon[] = r.valor.renglones;
  if (contratoParam !== undefined) {
    renglones = contratoId ? renglones.filter((rg) => rg.contrato_id === contratoId) : [];
    if (renglones.length === 0) notFound();
  }
  if (renglones.length === 0) {
    return (
      <Aviso titulo="No hay colillas para imprimir" volver={volver}>
        La planilla no tiene personas.
      </Aviso>
    );
  }

  const periodo = etiquetaPeriodo(p.periodo_inicio, p.periodo_fin, p.frecuencia, p.clase);
  const emitido = textoEmision();
  const esAguinaldo = p.clase === "aguinaldo";

  return (
    <HojaImpresion
      titulo={renglones.length === 1 ? `Colilla de ${renglones[0].empleado_nombre}` : `Colillas de ${periodo}`}
      encabezado={false}
      orientacion="vertical"
      volver={{ href: volver, label: "Volver a la planilla" }}
      emitido={emitido}
    >
      {renglones.map((rg) => {
        const honorarios = rg.regimen === "servicios_profesionales";
        const titulo = honorarios ? "Recibo de honorarios" : "Colilla de pago";
        const ingresos = ordenadas(rg.lineas, "devengado");
        const deducciones = ordenadas(rg.lineas, "deduccion");
        return (
          <PaginaImpresion key={rg.id} aria-label={`${titulo} de ${rg.empleado_nombre}`}>
            <EncabezadoImpresion
              nivel="h2"
              empresa={empresa}
              titulo={titulo}
              subtitulo={
                <p>
                  Período: {periodo} ({rangoFechas(p.periodo_inicio, p.periodo_fin)}) · Fecha de pago: {fechaCorta(p.fecha_pago)}
                </p>
              }
            />

            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
              <div className="flex gap-2">
                <dt className="font-semibold text-neutral-900">Colaborador:</dt>
                <dd className="text-neutral-800">{rg.empleado_nombre}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-neutral-900">Contrato N.º:</dt>
                <dd className="text-neutral-800 tabular-nums">{rg.numero_contrato}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-neutral-900">Régimen:</dt>
                <dd className="text-neutral-800">{etiqueta(REGIMEN, rg.regimen)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-neutral-900">{honorarios ? "Honorario mensual:" : "Salario mensual:"}</dt>
                <dd className="text-neutral-800 tabular-nums">{moneda(rg.salario_mensual)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-neutral-900">Días pagados:</dt>
                <dd className="text-neutral-800 tabular-nums">{diasTexto(rg.dias_pagados, 4)}</dd>
              </div>
            </dl>

            <TablaColilla titulo="Ingresos" lineas={ingresos} vacio="Sin ingresos." />
            {esAguinaldo && deducciones.length === 0 ? (
              <p className="text-xs text-neutral-600">{AGUINALDO_SIN_DEDUCCIONES}</p>
            ) : (
              <TablaColilla titulo="Deducciones" lineas={deducciones} vacio="Sin deducciones." />
            )}

            <table className="ml-auto text-sm print:text-[9.5pt]">
              <tbody>
                <tr>
                  <th scope="row" className="pr-6 text-left font-medium text-neutral-700">
                    Total ingresos
                  </th>
                  <td className="text-right text-neutral-900 tabular-nums">{moneda(rg.devengado)}</td>
                </tr>
                <tr>
                  <th scope="row" className="pr-6 text-left font-medium text-neutral-700">
                    Total deducciones
                  </th>
                  <td className="text-right text-neutral-900 tabular-nums">{moneda(rg.deducciones)}</td>
                </tr>
                <tr className="border-t border-neutral-400">
                  <th scope="row" className="pt-1 pr-6 text-left font-semibold text-neutral-900">
                    Neto a recibir
                  </th>
                  <td className="pt-1 text-right font-semibold text-neutral-900 tabular-nums">{moneda(rg.neto)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-10 grid grid-cols-2 gap-10 break-inside-avoid">
              <div className="border-t border-neutral-500 pt-1 text-center text-xs text-neutral-700">
                Recibí conforme · Firma del colaborador
              </div>
              <div className="border-t border-neutral-500 pt-1 text-center text-xs text-neutral-700">Fecha</div>
            </div>

            <PieImpresion texto={emitido} />
          </PaginaImpresion>
        );
      })}
    </HojaImpresion>
  );
}
