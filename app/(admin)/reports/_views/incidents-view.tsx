'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportActions } from '../_components/report-actions'
import { IntegrityScanner } from '../_components/integrity-scanner'
import { getNicaISODate, getNicaRange, formatInNica } from '@/lib/date-utils'

interface IncidentsViewProps {
  start?: string
  end?: string
  employee?: string
}

export function IncidentsView({ start, end, employee }: IncidentsViewProps) {
  const [incidents, setIncidents] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canExport, setCanExport] = useState(false)
  const supabase = createClient()

  const filterStart = start || getNicaISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const filterEnd   = end   || getNicaISODate()

  async function fetchData() {
    setLoading(true)
    
    // We use consolidated view to see tardiness as well
    let query = supabase
      .from('consolidated_attendance_view')
      .select('*')
      .gt('late_minutes', 0)
      .gte('attendance_date', filterStart)
      .lte('attendance_date', filterEnd)

    if (employee && employee !== 'all') {
      query = query.eq('employee_id', employee)
    }

    const { data: recordsData } = await query
    const { data: empData } = await supabase.from('employees').select('id, first_name, last_name').order('first_name')

    setIncidents(recordsData || [])
    setEmployees(empData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [start, end, employee])

  const statsByEmployee = incidents?.reduce((acc: any, curr: any) => {
    const id = curr.employee_id
    if (!acc[id]) {
      acc[id] = { name: curr.full_name, count: 0, totalMinutes: 0 }
    }
    acc[id].count += 1
    acc[id].totalMinutes += curr.late_minutes
    return acc
  }, {})

  const sortedStats = Object.values(statsByEmployee || {}).sort((a: any, b: any) => b.totalMinutes - a.totalMinutes)

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Hub de Reportes</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Tardanzas y Ausencias</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Análisis acumulativo de retrasos bajo el motor Gestor360.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <ReportActions 
            canExport={canExport}
            filters={{ start: filterStart, end: filterEnd, type: 'incidents' }}
          />
        </div>
      </div>

      <div className="max-w-xl">
        <IntegrityScanner 
          start={filterStart} 
          end={filterEnd} 
          onValidated={setCanExport} 
        />
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
        <form className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="type" value="incidents" />
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Desde</label>
            <input type="date" name="start" defaultValue={filterStart} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Hasta</label>
            <input type="date" name="end" defaultValue={filterEnd} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Empleado</label>
            <select name="employee" defaultValue={employee || 'all'} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100">
              <option value="all">Todos</option>
              {employees?.map(e => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800">
              Cargar Reporte
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-3xl bg-white ring-1 ring-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Ranking */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 px-2">Top de Retrasos</h2>
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 space-y-3">
              {sortedStats.map((s: any, i) => (
                <div key={s.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">{i + 1}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">{s.totalMinutes} min</p>
                    <p className="text-[10px] text-slate-400">{s.count} incidencia(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detalle */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 px-2">Detalle de Incidencias</h2>
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4 text-right">Tardanza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidents.map((inc: any) => (
                    <tr key={inc.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-slate-500">
                        {formatInNica(inc.clock_in, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{inc.full_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{inc.employee_code}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-block rounded-xl bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                          +{inc.late_minutes} min
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
