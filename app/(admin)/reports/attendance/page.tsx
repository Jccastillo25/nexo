import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
  const filterDate = date || new Date().toISOString().split('T')[0]
  const startOfDay = `${filterDate}T00:00:00Z`
  const endOfDay = `${filterDate}T23:59:59Z`

  const query = supabase
    .from('time_records')
    .select('id, event_type, recorded_at, tardiness_minutes, status, employees(first_name, last_name, employee_code), branches(name)')
    .gte('recorded_at', startOfDay)
    .lte('recorded_at', endOfDay)
    .order('recorded_at', { ascending: true })

  if (branch && branch !== 'all') {
    query.eq('branch_id', branch)
  }

  const { data: records } = await query
  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  // Cálculos rápidos para el resumen
  const clockIns = records?.filter(r => r.event_type === 'clock_in') || []
  const punctual = clockIns.filter(r => r.tardiness_minutes === 0).length
  const late = clockIns.filter(r => r.tardiness_minutes > 0).length

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reportes</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Asistencia Diaria</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Análisis de puntualidad y marcas registradas para el día seleccionado.
          </p>
        </div>
        <Link
          href="/reports"
          className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      {/* Filtros */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
          <p className="text-sm text-slate-500">Marcaciones totales</p>
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
              <th className="px-6 py-4">Evento</th>
              <th className="px-6 py-4">Hora Real</th>
              <th className="px-6 py-4">Diferencia</th>
              <th className="px-6 py-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records && records.length > 0 ? (
              records.map(r => {
                const emp = r.employees as any
                const time = new Date(r.recorded_at).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true })
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {emp.first_name} {emp.last_name}
                      <span className="block text-[10px] font-mono text-slate-400 capitalize">{emp.employee_code}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{(r.branches as any)?.name}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.event_type === 'clock_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.event_type === 'clock_in' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 font-semibold">{time}</td>
                    <td className="px-6 py-4">
                      {r.tardiness_minutes > 0 ? (
                        <span className="text-amber-600 font-bold">+{r.tardiness_minutes} min</span>
                      ) : (
                        <span className="text-emerald-500 italic">En hora</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.tardiness_minutes > 0 ? (
                        <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          RETRASO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                  No se encontraron marcas para este día y sucursal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
