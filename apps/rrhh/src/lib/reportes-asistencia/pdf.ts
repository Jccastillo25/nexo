/**
 * Generador del PDF de un reporte de Asistencia (servidor, runtime nodejs).
 * jspdf 4.2.1 + jspdf-autotable 5.0.8, Helvetica estándar (codificación
 * WinAnsi: acentos, ñ, "·" y "—" se ven bien), sin logo. A4 horizontal salvo
 * la tarjeta individual (vertical).
 *
 * Encabezado en la primera página (empresa + RUC, título, período, filtros
 * y, en la tarjeta, la ficha de la persona); la cabecera de la tabla se
 * repite en cada página; pie en todas las páginas con la emisión y
 * "Página X de Y"; totales, notas y (tarjeta) firmas al final.
 */
import { jsPDF } from "jspdf";
import autoTable, { type CellInput, type RowInput, type Styles } from "jspdf-autotable";
import type { DocumentoReporte } from "./documento";

const MARGEN = 12;
const MARGEN_INFERIOR = 16;
const TEXTO: [number, number, number] = [23, 23, 23];
const TEXTO_SUAVE: [number, number, number] = [82, 82, 82];
const LINEA: [number, number, number] = [212, 212, 212];
const FONDO_CABECERA: [number, number, number] = [245, 245, 245];

type ConTabla = { lastAutoTable?: { finalY?: number } | false };

function finalY(pdf: jsPDF, porDefecto: number): number {
  const ultima = (pdf as unknown as ConTabla).lastAutoTable;
  return ultima && typeof ultima.finalY === "number" ? ultima.finalY : porDefecto;
}

export function generarPdf(doc: DocumentoReporte): ArrayBuffer {
  const pdf = new jsPDF({ orientation: doc.orientacion, unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: `${doc.titulo} · ${doc.periodo}`, subject: doc.empresa, creator: "Nexo · Asistencia" });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  let y = MARGEN + 4;

  // ---- encabezado
  pdf.setTextColor(...TEXTO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  // Nombre largo: se parte a la mitad del ancho útil para no pisar el RUC.
  const empresa = pdf.splitTextToSize(doc.empresa, util / 2) as string[];
  pdf.text(empresa, MARGEN, y);
  if (doc.empresaRuc) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`RUC ${doc.empresaRuc}`, ancho - MARGEN, y, { align: "right" });
  }
  y += 8 + (empresa.length - 1) * 4.8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(doc.titulo, MARGEN, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Período: ${doc.periodo} · Hora de Nicaragua`, MARGEN, y);
  y += 5;
  if (doc.filtros.length > 0) {
    pdf.setFontSize(9);
    pdf.setTextColor(...TEXTO_SUAVE);
    const lineas = pdf.splitTextToSize(`Filtros: ${doc.filtros.join(" · ")}`, util) as string[];
    pdf.text(lineas, MARGEN, y);
    y += lineas.length * 4.2;
    pdf.setTextColor(...TEXTO);
  }

  if (doc.ficha.length > 0) {
    autoTable(pdf, {
      startY: y,
      theme: "plain",
      margin: { left: MARGEN, right: MARGEN },
      styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 0.8, bottom: 0.8, left: 0, right: 2 }, textColor: TEXTO },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
      body: doc.ficha.map((f) => [f.label, f.valor]),
    });
    y = finalY(pdf, y) + 2;
  }

  // ---- tabla principal
  const columnStyles: Record<number, Partial<Styles>> = {};
  doc.tabla.columnas.forEach((c, i) => {
    if (c.derecha) columnStyles[i] = { halign: "right" };
  });
  const cuerpo: RowInput[] =
    doc.tabla.filas.length > 0
      ? doc.tabla.filas.map((f) => f.celdas)
      : [[{ content: "No hay filas para estos filtros.", colSpan: doc.tabla.columnas.length, styles: { halign: "center" } } as CellInput]];

  autoTable(pdf, {
    startY: y + 1,
    theme: "grid",
    showHead: "everyPage",
    margin: { left: MARGEN, right: MARGEN, top: MARGEN, bottom: MARGEN_INFERIOR },
    styles: {
      font: "helvetica",
      fontSize: doc.orientacion === "landscape" ? 7.5 : 7,
      cellPadding: 1.4,
      overflow: "linebreak",
      textColor: TEXTO,
      lineColor: LINEA,
      lineWidth: 0.1,
      valign: "middle",
    },
    headStyles: { fillColor: FONDO_CABECERA, textColor: TEXTO, fontStyle: "bold" },
    columnStyles,
    head: [doc.tabla.columnas.map((c) => c.header)],
    body: cuerpo,
  });
  y = finalY(pdf, y) + 6;

  // ---- totales
  // Página nueva para totales/notas/firmas: repite una línea que identifica
  // el documento (en la tarjeta, la persona), para que una hoja suelta no
  // quede sin contexto.
  const persona = doc.ficha.find((f) => f.label === "Persona")?.valor;
  const espacio = (necesario: number) => {
    if (y + necesario > alto - MARGEN_INFERIOR) {
      pdf.addPage();
      y = MARGEN + 4;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...TEXTO_SUAVE);
      pdf.text([doc.titulo, persona, doc.periodo].filter(Boolean).join(" · "), MARGEN, y);
      pdf.setTextColor(...TEXTO);
      y += 8;
    }
  };
  espacio(10 + doc.totales.length * 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Totales del período", MARGEN, y);
  autoTable(pdf, {
    startY: y + 2,
    theme: "plain",
    tableWidth: Math.min(util, 150),
    margin: { left: MARGEN, right: MARGEN, bottom: MARGEN_INFERIOR },
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 0.8, bottom: 0.8, left: 0, right: 3 }, textColor: TEXTO },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { halign: "right", cellWidth: 30 } },
    body: doc.totales.map((t) => [t.label, t.valor, t.hint ?? ""]),
  });
  y = finalY(pdf, y) + 5;

  // ---- notas
  for (const nota of doc.notas) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    const lineas = pdf.splitTextToSize(nota, util) as string[];
    espacio(lineas.length * 3.8);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(...TEXTO_SUAVE);
    pdf.text(lineas, MARGEN, y);
    pdf.setTextColor(...TEXTO);
    y += lineas.length * 3.8 + 1;
  }

  // ---- firmas (tarjeta)
  if (doc.firmas) {
    espacio(28);
    y += 16;
    const anchoFirma = (util - 20) / 2;
    pdf.setDrawColor(...TEXTO_SUAVE);
    pdf.setLineWidth(0.2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    [
      { x: MARGEN, label: "Colaborador" },
      { x: MARGEN + anchoFirma + 20, label: "Responsable" },
    ].forEach(({ x, label }) => {
      pdf.line(x, y, x + anchoFirma, y);
      pdf.text(label, x + anchoFirma / 2, y + 5, { align: "center" });
    });
  }

  // ---- pie en cada página
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...TEXTO_SUAVE);
    pdf.text(`${doc.emitido} · Página ${i} de ${paginas}`, MARGEN, alto - 8);
  }

  return pdf.output("arraybuffer");
}
