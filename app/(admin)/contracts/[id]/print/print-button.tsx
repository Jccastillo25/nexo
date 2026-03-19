'use client'

import { markContractAsPrinted } from '../../../../actions/contracts'
import { useState } from 'react'

export function PrintButton({ id }: { id: string }) {
  const [printing, setPrinting] = useState(false)

  const handlePrint = async () => {
    setPrinting(true)
    try {
      // 1. Mark as printed in the DB
      const res = await markContractAsPrinted(id)
      if (res.error) {
        alert(`Error al registrar impresión: ${res.error}`)
        return
      }
      // 2. Open print dialog
      window.print()
    } catch (e) {
      console.error(e)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <button 
      onClick={handlePrint}
      disabled={printing}
      className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50"
    >
      {printing ? 'Preparando...' : 'Confirmar e Imprimir'}
    </button>
  )
}
