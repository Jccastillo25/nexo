'use client'

import { Printer, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface ReportActionsHoursProps {
  data: any[]
  filters: { start: string; end: string; branch: string }
}

export function ReportActionsHours({ data, filters }: ReportActionsHoursProps) {
  
  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    
    // Título
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("Reporte de Horas Trabajadas", pageWidth / 2, 20, { align: "center" })
    
    // Subtítulo
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Desde: ${filters.start} | Hasta: ${filters.end} | Sucursal: ${filters.branch}`, pageWidth / 2, 28, { align: "center" })

    // Preparar Data
    const tableBody = data.map((emp, index) => {
      return [
        (index + 1).toString(), 
        emp.name, 
        emp.code || 'N/A',
        emp.branch, 
        `${emp.daysWorked} día(s)`, 
        `${emp.totalHours} hrs`
      ]
    })

    // Generar Tabla
    doc.autoTable({
      startY: 40,
      head: [['#', 'Empleado', 'Código', 'Sucursal', 'Días Laborados', 'Total Horas']],
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

    doc.save(`Horas_Trabajadas_${filters.start}_al_${filters.end}.pdf`)
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
