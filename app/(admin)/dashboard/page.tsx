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

  const todayLabel = new Intl.DateTimeFormat('es-NI', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

  const [
    { count: activeEmployees },
    { count: todayCheckins },
    { count: pendingCorrections },
    { count: pendingLeave },
    { data: recentRecords },
    { count: totalBranches },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('time_records').select('*', { count: 'exact', head: true }).eq('event_type', 'clock_in').gte('recorded_at', todayISO),
    supabase.from('time_corrections').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('time_records').select('id, event_type, recorded_at, tardiness_minutes, employees(first_name, last_name, photo_url)').order('recorded_at', { ascending: false }).limit(6),
    supabase.from('branches').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    {
      label: 'Presentes Hoy',
      value: fmt(todayCheckins),
      sub: `/ ${fmt(activeEmployees)} empleados`,
      href: '/attendance/records',
      iconBg: 'bg-green-50',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'Sucursales',
      value: fmt(totalBranches),
      sub: 'registradas',
      href: '/organization/branches',
      iconBg: 'bg-blue-50',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      label: 'Correcciones',
      value: fmt(pendingCorrections),
      sub: 'pendientes de revisión',
      href: '/attendance/corrections',
      iconBg: 'bg-amber-50',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      label: 'Permisos',
      value: fmt(pendingLeave),
      sub: 'esperando aprobación',
      href: '/leave',
      iconBg: 'bg-purple-50',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
  ]

  const quickActions = [
    { label: 'Nuevo empleado', href: '/employees', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Ver registros', href: '/attendance/records', color: 'bg-slate-800 hover:bg-slate-700' },
    { label: 'Gestionar horarios', href: '/schedules', color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Ver reportes', href: '/reports', color: 'bg-violet-600 hover:bg-violet-700' },
  ]

  const noData = activeEmployees === null

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{todayLabel}</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Abrir Kiosco
        </Link>
      </div>

      {/* Aviso sin sesión */}
      {noData && (
        <div className="rounded-2xl bg-amber-50 px-6 py-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            Sin sesión activa — los datos reales aparecerán una vez que inicies sesión.{' '}
            <Link href="/login" className="underline underline-offset-2">Iniciar sesión →</Link>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
          >
            <div>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.iconBg}`}>
              {stat.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Actividad reciente</h2>
          <Link href="/attendance/records" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">
            Ver todos
          </Link>
        </div>

        {recentRecords && recentRecords.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentRecords.map((record) => {
              const emp = record.employees as unknown as { first_name: string; last_name: string; photo_url?: string | null } | null
              const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado'
              const initials = emp ? `${emp.first_name[0]}${emp.last_name[0]}` : '?'
              const isIn = record.event_type === 'clock_in'
              const tardanza = record.tardiness_minutes > 0 ? record.tardiness_minutes : 0
              return (
                <div key={record.id} className="flex items-center gap-4 px-6 py-3.5">
                  {/* Avatar */}
                  {emp?.photo_url ? (
                    <img src={emp.photo_url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200">
                      <span className="text-xs font-bold text-slate-500">{initials}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                    <p className="text-xs text-slate-400">{fmtTime(record.recorded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tardanza > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        +{tardanza} min
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isIn ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {isIn ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No hay actividad registrada aún.
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-500">Acceso rápido</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`rounded-2xl px-5 py-4 text-sm font-semibold text-white transition ${action.color}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

    </section>
  )
}
