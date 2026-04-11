'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportActions } from '../_components/report-actions'
import { IntegrityScanner } from '../_components/integrity-scanner'
import { getNicaISODate, getNicaRange } from '@/lib/date-utils'

interface HoursViewProps {
  start?: string
  end?: string
  branch?: string
}

export function HoursView({ start, end, branch }: HoursViewProps) {
  const [results, setResults] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canExport, setCanExport] = useState(false)
  const supabase = createClient()

  const filterStart = start || getNicaISODate(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000))
  const filterEnd   = end   || getNicaISODate()

  async function fetchData() {
    setLoading(true)
    const { start: utcStart, end: utcEnd } = getNicaRange(filterStart, filterEnd)

    // Using consolidated view for consistent math
    let query = supabase
      .from('consolidated_attendance_view')
      .select('*')
      .gte('attendance_date', filterStart)
      .lte('attendance_date', filterEnd)

    if (branch && branch !== 'all') {
      query = query.eq('branch_id', branch)
    }

    const { data: records } = await query
    const { data: branchesData } = await supabase.from('branches').select('id, name').order('name')

    // Aggregate by employee
    const empMap: Record<string, any> = {}
    records?.forEach((r: any) => {
      const empId = r.employee_id
      if (!empMap[empId]) {
        empMap[empId] = { 
          name: r.full_name, 
          code: r.employee_code,
          branch: r.branch_id, // simplified for now
          totalHours: 0,
          daysWorkedSet: new Set()
        }
      }
      empMap[empId].totalHours += r.net_hours
      empMap[empId].daysWorkedSet.add(r.attendance_date)
    })

    const finalResults = Object.values(empMap).map((emp: any) => ({
      ...emp,
      totalHours: emp.totalHours.toFixed(2),
      daysWorked: emp.daysWorkedSet.size
    }))

    setResults(finalResults)
    setBranches(branchesData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [start, end, branch])

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 app-surface p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Hub de Reportes</p>
          <h1 className="mt-2 text-3xl font-black text-white tracking-tight">Pre-nómina (Cálculo de Horas)</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Consolidado de tiempo laborado para cálculo de nómina.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <ReportActions 
            canExport={canExport}
            filters={{ start: filterStart, end: filterEnd, branch: branch || 'all', type: 'hours' }}
          />
        </div>
      </div>

      <div className="max-w-xl">
        <IntegrityScanner 
          start={filterStart} 
          end={filterEnd} 
          branchId={branch}
          onValidated={setCanExport}
        />
      </div>

      <div className="app-surface p-6 print:hidden">
        <form className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="type" value="hours" />
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Desde</label>
            <input type="date" name="start" defaultValue={filterStart} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Hasta</label>
            <input type="date" name="end" defaultValue={filterEnd} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Sucursal</label>
            <select name="branch" defaultValue={branch || 'all'} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="all">Todas</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-blue-500 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 hover:-translate-y-0.5 active:translate-y-0">
              Cargar Cálculos
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center app-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="app-surface overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4 text-center">Días Laborados</th>
                <th className="px-6 py-4 text-right">Total Horas (Netas)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {results.length > 0 ? (
                results.map((emp: any) => (
                  <tr key={emp.code} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{emp.name}</p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase">{emp.code}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-black text-blue-400 border border-blue-500/20">
                        {emp.daysWorked} día(s)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-white">{emp.totalHours}</span>
                      <span className="ml-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest">hrs</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500 text-sm font-medium">No hay datos procesados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
