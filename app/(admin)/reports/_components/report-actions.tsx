'use client'

import { Printer, Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface ReportActionsProps {
  data?: any[]
  summary?: { total: number; punctual: number; late: number }
  filters: { 
    date?: string; 
    start?: string; 
    end?: string; 
    branch?: string; 
    company_id?: string;
    type?: string;
  }
  canExport?: boolean
}

export function ReportActions({ data, summary, filters, canExport = false }: ReportActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const supabase = createClient()

  const generateProfessionalPDF = async () => {
    if (!canExport) return

    setIsGenerating(true)
    try {
      // 1. Call the Supabase Edge Function
      const { data: response, error } = await supabase.functions.invoke('generate-report', {
        body: {
          start: filters.start || filters.date,
          end: filters.end || filters.date,
          branch_id: filters.branch,
          company_id: filters.company_id,
          type: filters.type || 'attendance'
        }
      })

      if (error) throw error

      // 2. Handle the Blob and trigger download
      // Note: invoke returns { data, error }. data is the blob/buffer
      const blob = new Blob([response], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reporte_Gestor360_${filters.date || filters.start}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Error al generar el reporte profesional. Verifique la consola para más detalles.')
    } finally {
      setIsGenerating(false)
    }
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
        onClick={generateProfessionalPDF}
        disabled={!canExport || isGenerating}
        className={`flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition focus:outline-none ${
          !canExport 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">Descargar Reporte Legal</span>
      </button>
    </div>
  )
}
