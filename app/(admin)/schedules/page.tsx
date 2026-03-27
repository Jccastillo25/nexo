import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const date = new Date()
  date.setHours(Number(h), Number(m))
  return new Intl.DateTimeFormat('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date)
}

export default async function SchedulesPage() {
  const supabase = await createClient()

  const [
    { data: shifts, count: totalShifts },
    { count: activeAssignments },
  ] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, name, start_time, end_time, break_minutes, tolerance_in, tolerance_out, is_active, days_of_week', { count: 'exact' })
      .order('name'),
    supabase
      .from('employee_shifts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  const active   = shifts?.filter((s) => s.is_active).length ?? 0
  const inactive = (totalShifts ?? 0) - active

  const stats = [
    { label: 'Turnos creados',       value: totalShifts ?? 0 },
    { label: 'Activos',              value: active },
    { label: 'Inactivos',            value: inactive },
    { label: 'Asignaciones activas', value: activeAssignments ?? 0 },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Operación
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Horarios</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Turnos definidos para la operación. Configura entrada, salida, descanso y tolerancias.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/schedules/matrix"
            className="shrink-0 rounded-2xl border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
          >
            Matriz de Diagnóstico
          </Link>
          <Link
            href="/schedules/assignments"
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver asignaciones
          </Link>
          <Link
            href="/schedules/new"
            className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nuevo turno
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla de turnos */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Turnos configurados
          </h2>
        </div>

        {shifts && shifts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Turno</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Días</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Horario</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Descanso</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tolerancia</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{shift.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                          const isActive = ((shift as any).days_of_week as number[])?.includes(d)
                          const labels = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
                          return (
                            <span 
                              key={d} 
                              className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                                isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {labels[d]}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="font-medium text-slate-900">{fmtTime(shift.start_time)}</span>
                      <span className="mx-1 text-slate-300">-</span>
                      <span className="font-medium text-slate-900">{fmtTime(shift.end_time)}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {shift.break_minutes} min
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="flex flex-col text-xs">
                        <span>E: {shift.tolerance_in}m</span>
                        <span>S: {shift.tolerance_out}m</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          shift.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {shift.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/schedules/${shift.id}/edit`}
                        className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">
              No hay turnos configurados aún.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Los turnos aparecerán aquí una vez que sean creados.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
