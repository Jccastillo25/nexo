import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-NI')
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Managua',
  }).format(new Date(iso))
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    { count: activeEmployees },
    { count: todayCheckins },
    { count: pendingCorrections },
    { count: pendingLeave },
    { data: recentRecords },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('time_records')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'clock_in')
      .gte('recorded_at', todayISO),
    supabase
      .from('time_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('time_records')
      .select('id, event_type, recorded_at, tardiness_minutes, employees(first_name, last_name)')
      .order('recorded_at', { ascending: false })
      .limit(6),
  ])

  const stats = [
    { label: 'Empleados activos', value: fmt(activeEmployees), href: '/employees' },
    { label: 'Entradas hoy', value: fmt(todayCheckins), href: '/attendance/records' },
    { label: 'Correcciones pendientes', value: fmt(pendingCorrections), href: '/attendance/corrections' },
    { label: 'Permisos pendientes', value: fmt(pendingLeave), href: '/leave' },
  ]

  const quickActions = [
    { label: 'Nuevo empleado', href: '/employees' },
    { label: 'Ver registros', href: '/attendance/records' },
    { label: 'Gestionar horarios', href: '/schedules' },
    { label: 'Ver reportes', href: '/reports' },
  ]

  const noData = activeEmployees === null

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Resumen general
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Vista ejecutiva para monitorear asistencia, incidencias y actividad
          reciente de la operación.
        </p>
      </div>

      {/* Aviso sin sesión */}
      {noData && (
        <div className="rounded-3xl bg-amber-50 px-6 py-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            Sin sesión activa — los datos reales aparecerán una vez que inicies sesión con tu cuenta de administrador.{' '}
            <Link href="/login" className="underline underline-offset-2">
              Iniciar sesión →
            </Link>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Actividad reciente
          </h2>
          <Link
            href="/attendance/records"
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Ver todos
          </Link>
        </div>

        {recentRecords && recentRecords.length > 0 ? (
          <div className="mt-5 space-y-2">
            {recentRecords.map((record) => {
              const emp = record.employees as unknown as { first_name: string; last_name: string } | null
              const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado'
              const typeLabel = record.event_type === 'clock_in' ? 'Entrada' : 'Salida'
              const tardanza =
                record.tardiness_minutes > 0
                  ? ` · ${record.tardiness_minutes} min tardanza`
                  : ''
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm text-slate-700">
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${record.event_type === 'clock_in' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                      {typeLabel}
                    </span>
                    {name}
                    {tardanza && (
                      <span className="ml-1 text-amber-600">{tardanza}</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">
                    {fmtTime(record.recorded_at)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No hay actividad registrada aún.
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-3xl bg-slate-900 px-5 py-6 text-left text-white transition hover:bg-slate-800"
          >
            <p className="text-sm text-white/60">Acceso rápido</p>
            <p className="mt-2 text-lg font-semibold">{action.label}</p>
          </Link>
        ))}
      </div>

    </section>
  )
}
