import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ReportActions } from '../_components/report-actions'
import { getNicaISODate, getNicaRange } from '@/lib/date-utils'

interface AttendanceReportProps {
  searchParams: Promise<{
    date?: string
    branch?: string
  }>
}

export default async function AttendanceReportPage({ searchParams }: AttendanceReportProps) {
  const { date, branch } = await searchParams
  const supabase = await createClient()

  // Filtros
  const filterDate = date || getNicaISODate()
  const { start, end: rangeEnd } = getNicaRange(filterDate)
  
  // Fetch from attendance_logs instead of time_records
  const query = supabase
    .from('attendance_logs')
    .select('id, clock_in, clock_out, status, source_origin, employees(first_name, last_name, employee_code), branches(name)')
    .gte('clock_in', start)
    .lte('clock_in', rangeEnd)
    .order('clock_in', { ascending: true })

  if (branch && branch !== 'all') {
    query.eq('branch_id', branch)
  }

  const { data: records } = await query
  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  // Cálculos rápidos para el resumen (Usando attendance_logs)
  const punctual = records?.filter(r => r.status === 'on_time').length || 0
  const late = records?.filter(r => r.status === 'late').length || 0

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reportes Unificados</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Asistencia Diaria (Monitor 360)</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Análisis de puntualidad y jornadas registradas mediante el sistema omnicanal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportActions />
          <Link
            href="/reports"
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Volver
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
        <form className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Fecha</label>
            <input
              type="date"
              name="date"
              defaultValue={filterDate}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Sucursal</label>
            <select
              name="branch"
              defaultValue={branch || 'all'}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">Todas las sucursales</option>
              {branches?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-10 w-full rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Filtrar Reporte
            </button>
          </div>
        </form>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 border-l-4 border-l-slate-900">
          <p className="text-sm text-slate-500">Jornadas totales</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{records?.length || 0}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500">Puntuales</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{punctual}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 border-l-4 border-l-amber-500">
          <p className="text-sm text-slate-500">Tardanzas</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{late}</p>
        </div>
      </div>

      {/* Tabla */}
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
            {records && records.length > 0 ? (
              records.map(r => {
                const emp = r.employees as any
                const inTime = new Date(r.clock_in).toLocaleTimeString('es-NI', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: true,
                  timeZone: 'America/Managua'
                })
                const outTime = r.clock_out ? new Date(r.clock_out).toLocaleTimeString('es-NI', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: true,
                  timeZone: 'America/Managua'
                }) : '---'

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{emp.employee_code}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{(r.branches as any)?.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-700 font-semibold">{inTime}</td>
                    <td className="px-6 py-4 font-mono text-slate-700 font-semibold">{outTime}</td>
                    <td className="px-6 py-4">
                      {r.status === 'late' ? (
                        <span className="flex items-center gap-1.5 text-amber-600 text-[10px] font-black tracking-widest uppercase">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          RETRASO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black tracking-widest uppercase">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          PUNTUAL
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.source_origin || 'KIOSKO'}</span>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                  No se encontraron jornadas para este día y sucursal en el nuevo sistema.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
