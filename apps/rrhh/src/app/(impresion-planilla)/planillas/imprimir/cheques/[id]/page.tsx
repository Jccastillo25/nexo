import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { entero, fechaCorta, moneda } from "@nexo/ui";
import { HojaImpresion } from "@/components/planilla/hoja-impresion";
import { permisosDe } from "@/lib/permisos-rrhh";
import { METODO_PAGO, etiqueta } from "@/lib/planilla/etiquetas";
import { etiquetaPeriodo, rangoFechas } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { detallePlanilla } from "@/app/(app)/planillas/periodos/datos";

export const metadata: Metadata = { title: "Detalle para cheques · Planilla · RRHH" };

const CLASE_ENLACE =
  "rounded-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

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

const CELDA = "border border-neutral-300 px-2 py-1.5 align-top text-neutral-800";
const ENCABEZADO = "border border-neutral-300 px-2 py-1 font-semibold text-neutral-900";

/**
 * Detalle para cheques (B10, reportes.exportar; además planilla.ver para
 * leerla). A4 horizontal, en orden alfabético: N.º, colaborador, contrato,
 * neto a pagar y dos columnas en blanco para llenar a mano (N.º de cheque y
 * firma de recibido; hay una sola referencia de pago por planilla, D10). Solo
 * de planillas aprobadas o pagadas. El total es `totales.neto` de la RPC.
 */
export default async function ChequesPage({ params }: PageProps<"/planillas/imprimir/cheques/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const volver = RUTA.detalle(id);

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.planillaExportar || !permisos.planillaVer) {
    return (
      <Aviso titulo="No tienes permiso" volver={volver}>
        No tienes permiso para imprimir el detalle para cheques.
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
      <Aviso titulo="El detalle para cheques todavía no se puede imprimir" volver={volver}>
        El detalle para cheques se imprime cuando la planilla está aprobada.
      </Aviso>
    );
  }

  const renglones = [...r.valor.renglones].sort(
    (a, b) => a.empleado_nombre.localeCompare(b.empleado_nombre, "es") || a.numero_contrato - b.numero_contrato
  );
  const periodo = etiquetaPeriodo(p.periodo_inicio, p.periodo_fin, p.frecuencia, p.clase);
  const personas = renglones.length;

  return (
    <HojaImpresion
      titulo="Detalle para cheques"
      empresa={empresa}
      orientacion="horizontal"
      volver={{ href: volver, label: "Volver a la planilla" }}
      subtitulo={
        <p>
          Período: {periodo} ({rangoFechas(p.periodo_inicio, p.periodo_fin)}) · Fecha de pago: {fechaCorta(p.fecha_pago)}
          {p.estado === "pagada" && p.metodo_pago ? ` · Método: ${etiqueta(METODO_PAGO, p.metodo_pago)}` : ""}
        </p>
      }
    >
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left text-xs print:text-[8.5pt]">
          <caption className="sr-only">Personas a pagar en esta planilla</caption>
          <thead className="[display:table-header-group]">
            <tr className="bg-neutral-100">
              <th scope="col" className={`${ENCABEZADO} w-12 text-right`}>
                N.º
              </th>
              <th scope="col" className={ENCABEZADO}>
                Colaborador
              </th>
              <th scope="col" className={`${ENCABEZADO} w-24 text-right`}>
                Contrato N.º
              </th>
              <th scope="col" className={`${ENCABEZADO} w-36 text-right`}>
                Neto a pagar
              </th>
              <th scope="col" className={`${ENCABEZADO} w-40`}>
                N.º de cheque
              </th>
              <th scope="col" className={`${ENCABEZADO} w-56`}>
                Firma de recibido
              </th>
            </tr>
          </thead>
          <tbody>
            {renglones.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${CELDA} text-center text-neutral-600`}>
                  La planilla no tiene personas.
                </td>
              </tr>
            ) : (
              renglones.map((rg, i) => (
                <tr key={rg.id} className="break-inside-avoid">
                  <td className={`${CELDA} text-right tabular-nums`}>{i + 1}</td>
                  <td className={CELDA}>{rg.empleado_nombre}</td>
                  <td className={`${CELDA} text-right tabular-nums`}>{rg.numero_contrato}</td>
                  <td className={`${CELDA} text-right whitespace-nowrap tabular-nums`}>{moneda(rg.neto)}</td>
                  <td className={`${CELDA} h-8`} />
                  <td className={`${CELDA} h-8`} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm font-semibold text-neutral-900 tabular-nums">
        Total: {entero(personas)} {personas === 1 ? "persona" : "personas"} · {moneda(p.totales.neto)}
      </p>
    </HojaImpresion>
  );
}
