'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportActions } from '../_components/report-actions'
import { IntegrityScanner } from '../_components/integrity-scanner'
import { getNicaISODate, getNicaRange } from '@/lib/date-utils'

interface AttendanceViewProps {
  date?: string
  branch?: string
}

export function AttendanceView({ date, branch }: AttendanceViewProps) {
  const [records, setRecords] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canExport, setCanExport] = useState(false)
  const supabase = createClient()

  const filterDate = date || getNicaISODate()
  const { start, end: rangeEnd } = getNicaRange(filterDate)

  async function fetchData() {
    setLoading(true)
    
    const { data: recordsData } = await supabase
      .from('attendance_logs')
      .select('id, clock_in, clock_out, status, source_origin, employees(first_name, last_name, employee_code), branches(name)')
      .gte('clock_in', start)
      .lte('clock_in', rangeEnd)
      .order('clock_in', { ascending: true })

    const { data: branchesData } = await supabase.from('branches').select('id, name').order('name')

    setRecords(recordsData || [])
    setBranches(branchesData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [date, branch])

  const punctual = records.filter(r => r.status === 'on_time').length
  const late = records.filter(r => r.status === 'late').length

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Hub de Reportes</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Histórico de Cierres (Asistencia Diaria)</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Análisis de asistencia y jornadas registradas.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <ReportActions
             canExport={canExport}
             filters={{ date: filterDate, branch: branch || 'all', type: 'attendance' }}
          />
        </div>
      </div>

      <div className="max-w-xl">
        <IntegrityScanner 
          start={filterDate} 
          end={filterDate} 
          branchId={branch}
          onValidated={setCanExport}
        />
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
        <form className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="type" value="attendance" />
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Fecha</label>
            <input type="date" name="date" defaultValue={filterDate} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Sucursal</label>
            <select name="branch" defaultValue={branch || 'all'} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100">
              <option value="all">Todas</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800">
              Filtrar Reporte
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-3xl bg-white ring-1 ring-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Entrada</th>
                <th className="px-6 py-4">Salida</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length > 0 ? (
                records.map(r => {
                  const emp = r.employees as any
                  const inTime = new Date(r.clock_in).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true })
                  const outTime = r.clock_out ? new Date(r.clock_out).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">{emp.employee_code}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{(r.branches as any)?.name}</td>
                      <td className="px-6 py-4 font-mono">{inTime}</td>
                      <td className="px-6 py-4 font-mono">{outTime}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black tracking-widest uppercase ${r.status === 'late' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {r.status === 'late' ? 'RETRASO' : 'PUNTUAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{r.source_origin || 'KIOSKO'}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No hay datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
