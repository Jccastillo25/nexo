'use client'

import { Printer } from 'lucide-react'

export function ReportActions() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={handlePrint}
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 active:bg-slate-900"
      >
        <Printer className="w-4 h-4" />
        Guardar PDF
      </button>
    </div>
  )
}
