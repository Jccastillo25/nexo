import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const date = new Date()
  date.setHours(Number(h), Number(m))
  return new Intl.DateTimeFormat('es-NI', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function SchedulesPage() {
  const supabase = await createClient()

  const [
    { data: shifts, count: totalShifts },
    { count: activeAssignments },
  ] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, name, start_time, end_time, break_minutes, tolerance_in, tolerance_out, is_active', { count: 'exact' })
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
        <Link
          href="/schedules/assignments"
          className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ver asignaciones
        </Link>
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
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Entrada</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Salida</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Descanso</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tolerancia E.</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tolerancia S.</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {shift.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {fmtTime(shift.start_time)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {fmtTime(shift.end_time)}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {shift.break_minutes} min
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {shift.tolerance_in} min
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {shift.tolerance_out} min
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
