import { createClient } from '@/lib/supabase/server'

export default async function RecordsPage() {
  const supabase = await createClient()

  // Fetch from attendance_logs instead of time_records
  const { data: records } = await supabase
    .from('attendance_logs')
    .select('id, clock_in, clock_out, status, source_origin, employees(first_name, last_name), branches(name)')
    .order('clock_in', { ascending: false })
    .limit(50)

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Asistencia Unificada
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Registros de Jornada
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Historial de sesiones de trabajo registradas. Cada fila representa una jornada completa (entrada y salida).
        </p>
      </div>

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Últimas 50 sesiones
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
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Entrada</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Salida</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const emp = r.employees as unknown as { first_name: string; last_name: string } | null
                  const br  = r.branches  as unknown as { name: string } | null
                  
                  const dtIn  = new Date(r.clock_in)
                  const dtOut = r.clock_out ? new Date(r.clock_out) : null
                  
                  const dateStr = dtIn.toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Managua' })
                  const inStr = dtIn.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Managua' })
                  const outStr = dtOut ? dtOut.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Managua' }) : '---'

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900">{emp ? `${emp.first_name} ${emp.last_name}` : '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase">{dateStr}</div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">{br?.name ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-700">{inStr}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        {dtOut ? (
                           <span className="font-semibold text-slate-700">{outStr}</span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-blue-500/20">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                              EN CURSO
                           </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          r.status === 'on_time' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.status === 'on_time' ? 'Puntual' : 'Retraso'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {r.source_origin || 'KIOSKO'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No hay jornadas registradas aún.</p>
            <p className="mt-1 text-xs text-slate-400">
              Usa el Monitor Operativo o el Kiosko para iniciar una sesión.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
