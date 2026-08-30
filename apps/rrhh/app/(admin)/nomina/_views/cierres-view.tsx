'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Cierre {
  id: string
  period_start: string
  period_end: string
  status: string
  total_employees: number
  total_hours: number
  total_amount: number
  notes: string | null
  created_at: string
  closed_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft:    { label: 'Borrador',  class: 'text-slate-400 bg-slate-700' },
  closed:   { label: 'Cerrado',   class: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' },
  approved: { label: 'Aprobado',  class: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' },
}

export function CierresView() {
  const [cierres, setCierres] = useState<Cierre[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchCierres() {
    setLoading(true)
    const { data } = await supabase
      .from('payroll_closures')
      .select('*')
      .order('created_at', { ascending: false })
    setCierres(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCierres()
  }, [])

  async function updateStatus(id: string, status: string) {
    const update: Record<string, any> = { status }
    if (status === 'closed') update.closed_at = new Date().toISOString()
    if (status === 'approved') update.approved_at = new Date().toISOString()
    await supabase.from('payroll_closures').update(update).eq('id', id)
    fetchCierres()
  }

  async function deleteCierre(id: string) {
    if (!confirm('¿Eliminar este cierre?')) return
    await supabase.from('payroll_closures').delete().eq('id', id)
    fetchCierres()
  }

  function openPDF(cierre: Cierre) {
    const url = `/nomina/print?type=cierre&start=${cierre.period_start}&end=${cierre.period_end}`
    window.open(url, '_blank', 'width=1000,height=800')
  }

  return (
    <section className="space-y-6">
      <div className="app-surface p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nómina</p>
        <h1 className="mt-2 text-3xl font-black text-white tracking-tight">Cierres de Período</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Historial de planillas procesadas y cerradas.
        </p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center app-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : cierres.length === 0 ? (
        <div className="app-surface p-12 text-center">
          <p className="text-slate-500 text-sm font-medium">No hay cierres registrados.</p>
          <p className="mt-1 text-[11px] text-slate-600">Genera y guarda una planilla desde la pestaña "Planilla de Nómina".</p>
        </div>
      ) : (
        <div className="app-surface overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4 text-center">Empleados</th>
                <th className="px-6 py-4 text-center">Horas</th>
                <th className="px-6 py-4 text-right">Monto Neto</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-center">Creado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {cierres.map(c => {
                const st = STATUS_LABELS[c.status] || STATUS_LABELS.draft
                return (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white font-mono">
                        {c.period_start} → {c.period_end}
                      </p>
                      {c.notes && <p className="text-[10px] text-slate-500 mt-0.5">{c.notes}</p>}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-300">{c.total_employees}</td>
                    <td className="px-6 py-4 text-center font-mono text-slate-300">{Number(c.total_hours).toFixed(1)}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-blue-400">
                      C$ {Number(c.total_amount).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${st.class}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-[11px] text-slate-500">
                      {new Date(c.created_at).toLocaleDateString('es-NI')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openPDF(c)}
                          className="rounded-lg bg-slate-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-600 transition"
                        >
                          PDF
                        </button>
                        {c.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(c.id, 'closed')}
                            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:bg-amber-500/30 transition"
                          >
                            Cerrar
                          </button>
                        )}
                        {c.status === 'closed' && (
                          <button
                            onClick={() => updateStatus(c.id, 'approved')}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/30 transition"
                          >
                            Aprobar
                          </button>
                        )}
                        {c.status === 'draft' && (
                          <button
                            onClick={() => deleteCierre(c.id)}
                            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
