import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ReportActions } from '../_components/report-actions'
import { getNicaISODate, getNicaRange, formatInNica } from '@/lib/date-utils'

interface HoursReportProps {
  searchParams: Promise<{
    start?: string
    end?: string
    branch?: string
  }>
}

export default async function HoursReportPage({ searchParams }: HoursReportProps) {
  const { start, end, branch } = await searchParams
  const supabase = await createClient()

  const defaultEnd = getNicaISODate()
  const defaultStart = getNicaISODate(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000))

  const filterStart = start || defaultStart
  const filterEnd   = end   || defaultEnd

  const { start: utcStart } = getNicaRange(filterStart)
  const { end: utcEnd } = getNicaRange(filterEnd)

  // Use attendance_logs for much simpler calculation
  let query = supabase
    .from('attendance_logs')
    .select('clock_in, clock_out, employee_id, employees(first_name, last_name, employee_code, branch_id), branches(name)')
    .gte('clock_in', utcStart)
    .lte('clock_in', utcEnd)
    .order('clock_in', { ascending: true })

  if (branch && branch !== 'all') {
    query = query.eq('branch_id', branch)
  }

  const { data: records } = await query
  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  // Procesamiento de horas: Mucho más simple ahora que son sesiones
  const empMap: Record<string, any> = {}

  records?.forEach((r: any) => {
    const empId = r.employee_id
    if (!empMap[empId]) {
      empMap[empId] = { 
        name: `${r.employees.first_name} ${r.employees.last_name}`, 
        code: r.employees.employee_code,
        branch: r.branches?.name || '—',
        totalMinutes: 0,
        daysWorkedSet: new Set()
      }
    }
    
    if (r.clock_in && r.clock_out) {
      const diffMs = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()
      empMap[empId].totalMinutes += Math.max(0, diffMs / 60000)
    }
    empMap[empId].daysWorkedSet.add(r.clock_in.split('T')[0])
  })

  const finalResults = Object.values(empMap).map((emp: any) => ({
    ...emp,
    totalHours: (emp.totalMinutes / 60).toFixed(2),
    daysWorked: emp.daysWorkedSet.size
  }))

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reportes Unificados</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Horas Trabajadas (Monitor 360)</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Consolidado de tiempo laborado basado en sesiones omnicanal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportActions />
          <Link href="/reports" className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            ← Volver
          </Link>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
        <form className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Desde</label>
            <input type="date" name="start" defaultValue={filterStart} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Hasta</label>
            <input type="date" name="end" defaultValue={filterEnd} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Sucursal</label>
            <select name="branch" defaultValue={branch || 'all'} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100">
              <option value="all">Todas</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="h-10 w-full rounded-xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800">
              Cargar Reporte
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4">Empleado</th>
              <th className="px-6 py-4">Sucursal</th>
              <th className="px-6 py-4 text-center">Días Laborados</th>
              <th className="px-6 py-4 text-right">Total Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {finalResults.length > 0 ? (
              finalResults.map((emp: any) => (
                <tr key={emp.code} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{emp.name}</p>
                    <p className="text-[10px] font-mono text-slate-400 uppercase">{emp.code}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{emp.branch}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {emp.daysWorked} día(s)
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-slate-900">{emp.totalHours}</span>
                    <span className="ml-1 text-xs text-slate-400 font-semibold">hrs</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No hay datos de sesiones para procesar en este periodo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[10px] text-slate-400 italic">
        * El cálculo se basa en la suma de todas las sesiones cerradas (clock_in y clock_out) en la tabla unificada.
      </p>
    </section>
  )
}
