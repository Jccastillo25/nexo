'use client'

import { Printer, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface ReportActionsIncidentsProps {
  data: any[]
  summary: any[]
  filters: { start: string; end: string; employee: string }
}

export function ReportActionsIncidents({ data, summary, filters }: ReportActionsIncidentsProps) {
  
  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    // Título
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("Reporte de Tardanzas y Ausencias", pageWidth / 2, 20, { align: "center" })
    
    // Subtítulo
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Desde: ${filters.start} | Hasta: ${filters.end} | Empleado: ${filters.employee}`, pageWidth / 2, 28, { align: "center" })

    // Top Retrasos
    doc.setFont("helvetica", "bold")
    doc.text("Top de Retrasos", 14, 40)
    
    const summaryBody = summary.slice(0, 5).map((s, index) => [
      (index + 1).toString(),
      s.name,
      `${s.count} incidencia(s)`,
      `${s.totalMinutes} min`
    ])

    doc.autoTable({
      startY: 45,
      head: [['#', 'Empleado', 'Frecuencia', 'Total Minutos']],
      body: summaryBody,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] }, // Amber
      margin: { left: 14, right: 14 }
    })

    const finalY = (doc as any).lastAutoTable.finalY || 45

    // Detalle de Incidencias
    doc.setFont("helvetica", "bold")
    doc.text("Detalle Cronológico", 14, finalY + 15)

    const tableBody = data.map((inc) => {
      const dateStr = new Date(inc.recorded_at).toLocaleDateString('es-NI', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
      const empName = `${inc.employees?.first_name} ${inc.employees?.last_name}`
      const empCode = inc.employees?.employee_code || 'N/A'
      
      return [
        dateStr,
        empName,
        empCode,
        `+${inc.tardiness_minutes} min`
      ]
    })

    doc.autoTable({
      startY: finalY + 20,
      head: [['Fecha y Hora', 'Empleado', 'Código', 'Tardanza']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9 }, // Slate-900
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate-50
      margin: { left: 14, right: 14 }
    })

    // Pie de página
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
            `Generado el ${new Date().toLocaleString('es-NI')} - Página ${i} de ${pageCount}`,
            pageWidth / 2, 
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        )
    }

    doc.save(`Incidencias_${filters.start}_al_${filters.end}.pdf`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={handlePrint}
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">Imprimir</span>
      </button>

      <button
        onClick={generatePDF}
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 active:bg-slate-900"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Guardar PDF</span>
      </button>
    </div>
  )
}
