import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type EmployeeShift = {
  id: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  employees: {
    first_name: string
    last_name: string
    employee_code: string
    branches: { name: string } | null
  } | null
  shifts: { name: string; start_time: string; end_time: string } | null
}

export default async function AssignmentsPage() {
  const supabase = await createClient()

  const { data: rawAssignments } = await supabase
    .from('employee_shifts')
    .select(
      'id, start_date, end_date, is_active, ' +
      'employees(first_name, last_name, employee_code, branches(name)), ' +
      'shifts(name, start_time, end_time)'
    )
    .order('is_active', { ascending: false })
    .limit(100)

  const assignments = rawAssignments as unknown as EmployeeShift[] | null

  const active   = assignments?.filter((a) => a.is_active).length  ?? 0
  const inactive = (assignments?.length ?? 0) - active

  const stats = [
    { label: 'Asignaciones totales',  value: assignments?.length ?? 0 },
    { label: 'Activas',               value: active },
    { label: 'Inactivas',             value: inactive },
  ]

  return (
    <section className="space-y-6">

      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Horarios</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Asignaciones de turnos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Relación entre empleados y los turnos que tienen asignados.
          </p>
        </div>
        <Link
          href="/schedules"
          className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Turnos
        </Link>
        <Link
          href="/schedules/assignments/new"
          className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + Asignar Turno
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Asignaciones</h2>
        </div>

        {assignments && assignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empleado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sucursal</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Turno</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Inicio</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fin</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const emp    = a.employees
                  const shift  = a.shifts
                  const branch = emp?.branches
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                        </p>
                        {emp?.employee_code && (
                          <p className="text-xs font-mono text-slate-400">{emp.employee_code}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{branch?.name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{shift?.name ?? '—'}</p>
                        {shift && (
                          <p className="text-xs text-slate-400">
                            {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {a.start_date ? new Date(a.start_date).toLocaleDateString('es-NI') : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {a.end_date ? new Date(a.end_date).toLocaleDateString('es-NI') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {a.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No hay asignaciones de turno registradas.</p>
            <p className="mt-1 text-xs text-slate-400">
              Asigna un turno a cada empleado para que el sistema pueda calcular asistencia.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
