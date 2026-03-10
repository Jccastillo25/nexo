import { createClient } from '@/lib/supabase/server'

export default async function RecordsPage() {
  const supabase = await createClient()

  const { data: records } = await supabase
    .from('time_records')
    .select('id, event_type, recorded_at, tardiness_minutes, overtime_minutes, status, source, employees(first_name, last_name), branches(name)')
    .order('recorded_at', { ascending: false })
    .limit(50)

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Asistencia
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Registros de marcación
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Historial de todas las marcaciones registradas en el sistema, ordenadas por fecha.
        </p>
      </div>

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Últimos 50 registros
          </h2>
          <span className="text-xs text-slate-400">
            {records?.length ?? 0} resultado{records?.length !== 1 ? 's' : ''}
          </span>
        </div>

        {records && records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empleado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sucursal</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha y hora</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tardanza</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Origen</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const emp = r.employees as unknown as { first_name: string; last_name: string } | null
                  const br  = r.branches  as unknown as { name: string } | null
                  const dt  = new Date(r.recorded_at)
                  const dateStr = dt.toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Managua' })
                  const timeStr = dt.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Managua' })

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">{br?.name ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.event_type === 'clock_in'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.event_type === 'clock_in' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        <span className="text-slate-800">{timeStr}</span>
                        <span className="ml-2 text-xs text-slate-400">{dateStr}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        {r.tardiness_minutes > 0 ? (
                          <span className="font-medium text-amber-600">
                            {r.tardiness_minutes} min
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 capitalize">{r.source}</td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === 'confirmed' ? 'bg-slate-100 text-slate-600' :
                          r.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                                                     'bg-blue-100 text-blue-700'
                        }`}>
                          {r.status === 'confirmed' ? 'Confirmado' : r.status === 'pending' ? 'Pendiente' : 'Corregido'}
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
            <p className="text-sm font-semibold text-slate-500">No hay registros de marcación aún.</p>
            <p className="mt-1 text-xs text-slate-400">
              Los registros aparecerán aquí cuando los empleados marquen asistencia desde el kiosko.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
