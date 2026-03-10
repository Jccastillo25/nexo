import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AttendancePage() {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    { count: todayTotal },
    { count: todayCheckins },
    { count: todayCheckouts },
    { count: pendingCorrections },
    { count: openIncidents },
    { data: recentRecords },
  ] = await Promise.all([
    supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true })
      .gte('recorded_at', todayISO),
    supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'clock_in')
      .gte('recorded_at', todayISO),
    supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'clock_out')
      .gte('recorded_at', todayISO),
    supabase
      .from('time_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('time_records')
      .select('id, event_type, recorded_at, tardiness_minutes, status, employees(first_name, last_name), branches(name)')
      .gte('recorded_at', todayISO)
      .order('recorded_at', { ascending: false })
      .limit(10),
  ])

  const stats = [
    { label: 'Marcaciones hoy', value: todayTotal ?? 0 },
    { label: 'Entradas', value: todayCheckins ?? 0 },
    { label: 'Salidas', value: todayCheckouts ?? 0 },
    { label: 'Correcciones pendientes', value: pendingCorrections ?? 0 },
  ]

  const modules = [
    {
      title: 'Registros',
      desc: 'Historial completo de marcaciones por fecha, empleado y sucursal.',
      href: '/attendance/records',
      badge: null,
    },
    {
      title: 'Correcciones',
      desc: 'Solicitudes de corrección de marcaciones enviadas por empleados.',
      href: '/attendance/corrections',
      badge: pendingCorrections ? `${pendingCorrections} pendiente${pendingCorrections !== 1 ? 's' : ''}` : null,
    },
    {
      title: 'Incidencias',
      desc: 'Tardanzas, ausencias, horas extra y salidas fuera de turno.',
      href: '/attendance/incidents',
      badge: openIncidents ? `${openIncidents} abierta${openIncidents !== 1 ? 's' : ''}` : null,
    },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Operación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Asistencia</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Monitoreo de marcaciones de hoy, correcciones pendientes e incidencias activas.
        </p>
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

      {/* Sub-módulos */}
      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-900 group-hover:text-slate-700">
                {m.title}
              </h2>
              {m.badge && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {m.badge}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">{m.desc}</p>
            <p className="mt-4 text-xs font-semibold text-slate-400 group-hover:text-slate-600">
              Ir al módulo →
            </p>
          </Link>
        ))}
      </div>

      {/* Feed del día */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Marcaciones de hoy
          </h2>
          <Link
            href="/attendance/records"
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Ver historial
          </Link>
        </div>

        {recentRecords && recentRecords.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Empleado</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tipo</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Hora</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tardanza</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentRecords.map((r) => {
                  const emp = r.employees as unknown as { first_name: string; last_name: string } | null
                  const br = r.branches as unknown as { name: string } | null
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-800">
                        {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                        {br && <span className="ml-2 text-xs text-slate-400">{br.name}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.event_type === 'clock_in' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {r.event_type === 'clock_in' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {new Intl.DateTimeFormat('es-NI', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Managua' }).format(new Date(r.recorded_at))}
                      </td>
                      <td className="py-3 pr-4">
                        {r.tardiness_minutes > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {r.tardiness_minutes} min
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === 'confirmed' ? 'bg-slate-100 text-slate-600' :
                          r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
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
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No hay marcaciones registradas hoy.
          </div>
        )}
      </div>

    </section>
  )
}
