import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { fechaCorta, fechaHora, moneda } from "@nexo/ui";
import { HojaImpresion } from "@/components/planilla/hoja-impresion";
import { permisosDe } from "@/lib/permisos-rrhh";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { separarAvisos } from "@/lib/planilla/estados";
import { CAUSA_LIQUIDACION_TODAS, METODO_PAGO, REGIMEN, etiqueta } from "@/lib/planilla/etiquetas";
import { decimal, tarifa } from "@/lib/planilla/formato";
import type { LiquidacionDetalle, LineaLiquidacion } from "@/lib/planilla/tipos";

export const metadata: Metadata = { title: "Imprimir liquidación · RRHH" };

const NO_ENCONTRADA = "Liquidación no encontrada.";
const CLASE_ENLACE =
  "w-fit rounded-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function Aviso({ titulo, children, volver }: { titulo: string; children: React.ReactNode; volver: { href: string; label: string } }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold text-neutral-900">{titulo}</h1>
      <p role="alert" className="text-sm text-neutral-600">
        {children}
      </p>
      <Link href={volver.href} className={CLASE_ENLACE}>
        {volver.label}
      </Link>
    </main>
  );
}

function TablaImpresa({
  titulo,
  lineas,
  totalLabel,
  total,
}: {
  titulo: string;
  lineas: LineaLiquidacion[];
  totalLabel: string;
  total: number;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="mb-1 text-left text-sm font-semibold text-neutral-900">{titulo}</caption>
      <thead>
        <tr className="border-b border-neutral-300 text-xs text-neutral-600">
          <th scope="col" className="py-1.5 pr-3 font-semibold">
            Concepto
          </th>
          <th scope="col" className="py-1.5 pr-3 font-semibold">
            Artículo
          </th>
          <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
            Días
          </th>
          <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
            Diario
          </th>
          <th scope="col" className="py-1.5 text-right font-semibold">
            Monto
          </th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((x, i) => (
          <tr key={`${i}-${x.concepto}`} className="border-b border-neutral-100 break-inside-avoid">
            <td className="py-1.5 pr-3 text-neutral-900">{x.nombre}</td>
            <td className="py-1.5 pr-3 text-neutral-700">{x.articulo ?? "—"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{decimal(x.dias, 4)}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{tarifa(x.diario)}</td>
            <td className="py-1.5 text-right tabular-nums">{moneda(x.monto)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-neutral-300 font-semibold text-neutral-900">
          <th scope="row" colSpan={4} className="py-1.5 pr-3 text-left">
            {totalLabel}
          </th>
          <td className="py-1.5 text-right tabular-nums">{moneda(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-neutral-500">{termino}</dt>
      <dd className="text-neutral-900 tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Liquidación imprimible (C9), con liquidaciones.ver, dentro de
 * (impresion-planilla) (sin NexoShell; el layout exige rrhh.ver_modulo). Solo
 * aprobada o pagada. Todos los montos son los guardados por
 * planilla_liquidacion_detalle; los avisos van como notas.
 */
export default async function ImprimirLiquidacionPage({ params }: PageProps<"/planillas/imprimir/liquidacion/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  const volver = { href: RUTA.liquidacion(id), label: "Volver a la liquidación" };

  if (!permisos.liquidacionesVer) {
    return (
      <Aviso titulo="No tienes permiso para imprimir liquidaciones" volver={{ href: "/dashboard", label: "Volver a RRHH" }}>
        Pide el permiso «Ver liquidaciones» a quien administra Nexo.
      </Aviso>
    );
  }

  const detalleR = await consultarRpc<LiquidacionDetalle>(
    ctx,
    "planilla_liquidacion_detalle",
    { p_liquidacion_id: id },
    "planilla_liquidacion_detalle"
  );
  if (!detalleR.ok) {
    if (detalleR.motivo === "negocio" && detalleR.mensaje === NO_ENCONTRADA) notFound();
    return (
      <Aviso titulo="No se pudo preparar la impresión" volver={volver}>
        {detalleR.motivo === "error" ? "Intenta de nuevo en unos minutos." : detalleR.mensaje}
      </Aviso>
    );
  }
  if (!detalleR.valor?.liquidacion) notFound();

  const { liquidacion: l, empresa } = detalleR.valor;
  if (l.estado !== "aprobada" && l.estado !== "pagada") {
    return (
      <Aviso titulo="La liquidación todavía no se puede imprimir" volver={volver}>
        La liquidación se imprime cuando está aprobada.
      </Aviso>
    );
  }

  const lineas = Array.isArray(detalleR.valor.lineas) ? detalleR.valor.lineas : [];
  const pagos = lineas.filter((x) => x.tipo === "devengado");
  const deducciones = lineas.filter((x) => x.tipo === "deduccion");
  const { contador, otros } = separarAvisos(l.avisos);
  const notas = [...otros, ...contador.map((c) => `Valor pendiente de confirmar con el contador: ${c}`)];
  const causa = etiqueta(CAUSA_LIQUIDACION_TODAS, l.causa);
  const estadoTexto =
    l.estado === "pagada"
      ? `Aprobada el ${fechaHora(l.aprobada_en)} · Pagada el ${fechaCorta(l.fecha_pago)} con ${etiqueta(METODO_PAGO, l.metodo_pago).toLowerCase()}${
          l.referencia_pago ? ` · Ref. ${l.referencia_pago}` : ""
        }`
      : `Aprobada el ${fechaHora(l.aprobada_en)}`;

  return (
    <HojaImpresion
      titulo="Liquidación final"
      empresa={empresa}
      subtitulo={
        <p className="text-sm">
          {l.empleado_nombre} · Contrato N.º {l.numero_contrato} · Egreso {fechaCorta(l.fecha_egreso)}
        </p>
      }
      volver={volver}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 print:grid-cols-3">
        <Dato termino="Colaborador">{l.empleado_nombre}</Dato>
        <Dato termino="Contrato">N.º {l.numero_contrato}</Dato>
        <Dato termino="Régimen">{etiqueta(REGIMEN, l.regimen)}</Dato>
        <Dato termino="Inicio del contrato">{fechaCorta(l.fecha_inicio)}</Dato>
        <Dato termino="Antigüedad desde">{fechaCorta(l.fecha_antiguedad)}</Dato>
        <Dato termino="Egreso">{fechaCorta(l.fecha_egreso)}</Dato>
        <Dato termino="Causa">{causa}</Dato>
        <Dato termino="Salario mensual">{moneda(l.salario_mensual)}</Dato>
        <Dato termino="Salario diario">{tarifa(l.salario_diario)}</Dato>
      </dl>

      <TablaImpresa titulo="Pagos" lineas={pagos} totalLabel="Total devengado" total={l.total_devengado} />
      {deducciones.length > 0 ? (
        <TablaImpresa titulo="Deducciones" lineas={deducciones} totalLabel="Total de deducciones" total={l.total_deducciones} />
      ) : null}

      <div className="flex justify-end">
        <dl className="grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 break-inside-avoid">
          <dt className="text-neutral-600">Total devengado</dt>
          <dd className="text-right tabular-nums">{moneda(l.total_devengado)}</dd>
          <dt className="text-neutral-600">Total de deducciones</dt>
          <dd className="text-right tabular-nums">{moneda(l.total_deducciones)}</dd>
          <dt className="border-t border-neutral-300 pt-1 font-semibold text-neutral-900">Neto a recibir</dt>
          <dd className="border-t border-neutral-300 pt-1 text-right font-semibold text-neutral-900 tabular-nums">{moneda(l.neto)}</dd>
        </dl>
      </div>

      <section aria-labelledby="liquidacion-notas" className="flex flex-col gap-1 break-inside-avoid">
        <h2 id="liquidacion-notas" className="text-sm font-semibold text-neutral-900">
          Notas
        </h2>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-neutral-700">
          <li>El aguinaldo no lleva descuentos (art. 97 del Código del Trabajo).</li>
          {notas.map((n, i) => (
            <li key={`${i}-${n}`}>{n}</li>
          ))}
          <li>{estadoTexto}.</li>
        </ul>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 break-inside-avoid sm:grid-cols-2 print:grid-cols-2">
        <div className="flex flex-col gap-1 border-t border-neutral-400 pt-2 text-xs text-neutral-700">
          <span>Recibí conforme · Colaborador</span>
          <span className="text-neutral-500">{l.empleado_nombre}</span>
        </div>
        <div className="flex flex-col gap-1 border-t border-neutral-400 pt-2 text-xs text-neutral-700">
          <span>Empleador</span>
          <span className="text-neutral-500">{empresa?.nombre ?? "—"}</span>
        </div>
      </div>
    </HojaImpresion>
  );
}
