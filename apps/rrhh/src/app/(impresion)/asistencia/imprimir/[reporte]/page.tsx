import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import type { Database } from "@/lib/supabase/database.types";
import { permisosAsistencia } from "@/lib/permisos-asistencia";
import { hoyManagua } from "@/lib/fecha-managua";
import { prepararExportacion } from "@/lib/reportes-asistencia/datos";
import type { DocumentoReporte } from "@/lib/reportes-asistencia/documento";
import { esReporte, filtrosAQuery, leerFiltros } from "@/lib/reportes-asistencia/formato";
import { rutaReporte } from "@/lib/reportes-asistencia/rutas";
import BotonImprimir from "./boton-imprimir";

export const metadata: Metadata = { title: "Imprimir reporte · Asistencia" };

/** Texto seguro dentro de un string CSS de <style> (sin cerrar la etiqueta). */
function textoCss(valor: string): string {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\3c ").replace(/[\r\n]+/g, " ")}"`;
}

/**
 * Vista de impresión de un reporte: mismo contenido, encabezado y pie que
 * el PDF, sin paginación (hasta 5000 filas). Exige
 * `rrhh.asistencia.reportes.exportar` y registra cada apertura en la
 * auditoría con formato "impresion".
 */
export default async function ImprimirReportePage({ params, searchParams }: PageProps<"/asistencia/imprimir/[reporte]">) {
  const { reporte } = await params;
  if (!esReporte(reporte)) notFound();
  const sp = await searchParams;

  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosAsistencia()]);
  const { filtros, error } = leerFiltros(reporte, sp, hoyManagua());
  const volver = rutaReporte(reporte, filtrosAQuery(reporte, filtros));

  if (!permisos.reportesExportar) {
    return (
      <Aviso volver={volver} titulo="No tienes permiso para imprimir reportes">
        Tu rol no permite exportar ni imprimir reportes de Asistencia. Pide acceso a tu administrador.
      </Aviso>
    );
  }
  if (error) {
    return (
      <Aviso volver={volver} titulo="No se puede imprimir con estos filtros">
        {error}
      </Aviso>
    );
  }

  const preparado = await prepararExportacion(supabase, companyId, reporte, filtros, "impresion");
  if (!preparado.ok) {
    return (
      <Aviso volver={volver} titulo="No se pudo preparar la impresión">
        {preparado.mensaje}
      </Aviso>
    );
  }

  return <Documento doc={preparado.valor.documento} volver={volver} />;
}

function Aviso({ titulo, children, volver }: { titulo: string; children: React.ReactNode; volver: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold text-neutral-900">{titulo}</h1>
      <p role="alert" className="text-sm text-neutral-600">
        {children}
      </p>
      <Link href={volver} className="text-sm font-medium text-blue-600 hover:text-blue-700">
        Volver al reporte
      </Link>
    </main>
  );
}

function Documento({ doc, volver }: { doc: DocumentoReporte; volver: string }) {
  const tamano = doc.orientacion === "landscape" ? "A4 landscape" : "A4 portrait";
  const css = `
@page {
  size: ${tamano};
  margin: 12mm 12mm 16mm 12mm;
  @bottom-left { content: ${textoCss(`${doc.emitido} · Página `)} counter(page) " de " counter(pages); font-size: 8pt; }
}
@media print {
  html, body { background: white !important; }
}`;

  return (
    <>
      <style>{css}</style>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-6 text-sm print:max-w-none print:p-0 print:text-[9pt]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 print:hidden">
          <Link href={volver} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Volver al reporte
          </Link>
          <BotonImprimir />
        </div>

        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-neutral-900">{doc.empresa}</p>
            {doc.empresaRuc ? <p className="text-xs text-neutral-600">RUC {doc.empresaRuc}</p> : null}
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 print:text-[15pt]">{doc.titulo}</h1>
          <p className="text-neutral-700">Período: {doc.periodo} · Hora de Nicaragua</p>
          {doc.filtros.length > 0 ? <p className="text-xs text-neutral-600">Filtros: {doc.filtros.join(" · ")}</p> : null}
        </header>

        {doc.ficha.length > 0 ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
            {doc.ficha.map((f) => (
              <div key={f.label} className="flex gap-2">
                <dt className="font-semibold text-neutral-900">{f.label}:</dt>
                <dd className="text-neutral-700">{f.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-left text-xs print:text-[7.5pt]">
            <thead className="[display:table-header-group]">
              <tr className="bg-neutral-100">
                {doc.tabla.columnas.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`border border-neutral-300 px-1.5 py-1 font-semibold text-neutral-900 ${c.derecha ? "text-right" : ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.tabla.filas.length === 0 ? (
                <tr>
                  <td colSpan={doc.tabla.columnas.length} className="border border-neutral-300 px-1.5 py-3 text-center text-neutral-600">
                    No hay filas para estos filtros.
                  </td>
                </tr>
              ) : (
                doc.tabla.filas.map((f) => (
                  <tr key={f.id} className="break-inside-avoid">
                    {f.celdas.map((celda, i) => (
                      <td
                        key={doc.tabla.columnas[i].key}
                        className={`border border-neutral-300 px-1.5 py-1 align-top text-neutral-800 ${doc.tabla.columnas[i].derecha ? "whitespace-nowrap text-right tabular-nums" : ""}`}
                      >
                        {celda}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="totales-titulo" className="break-inside-avoid">
          <h2 id="totales-titulo" className="font-semibold text-neutral-900">
            Totales del período
          </h2>
          <table className="mt-1 text-xs print:text-[8.5pt]">
            <tbody>
              {doc.totales.map((t) => (
                <tr key={t.label}>
                  <th scope="row" className="pr-4 text-left font-semibold text-neutral-900">
                    {t.label}
                  </th>
                  <td className="pr-4 text-right tabular-nums text-neutral-800">{t.valor}</td>
                  <td className="text-neutral-600">{t.hint ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {doc.notas.map((nota) => (
          <p key={nota} className="text-xs italic text-neutral-600">
            {nota}
          </p>
        ))}

        {doc.firmas ? (
          <div className="mt-12 grid grid-cols-2 gap-10 break-inside-avoid">
            {["Colaborador", "Responsable"].map((rol) => (
              <div key={rol} className="border-t border-neutral-500 pt-1 text-center text-xs text-neutral-700">
                {rol}
              </div>
            ))}
          </div>
        ) : null}

        <footer className="mt-4 border-t border-neutral-200 pt-2 text-xs text-neutral-500">{doc.emitido}</footer>
      </main>
    </>
  );
}
