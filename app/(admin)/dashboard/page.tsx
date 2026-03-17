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
      iconBg: 'var(--success-soft)',
      iconColor: 'var(--success)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'Ausencias',
      value: fmt((activeEmployees ?? 0) - (todayCheckins ?? 0)),
      sub: 'sin justificar',
      href: '/attendance/incidents',
      iconBg: 'var(--danger-soft)',
      iconColor: 'var(--danger)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      label: 'Tardanzas Hoy',
      value: fmt(pendingCorrections),
      sub: '> 15 minutos',
      href: '/attendance/corrections',
      iconBg: 'var(--warning-soft)',
      iconColor: 'var(--warning)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      iconBg: 'var(--info-soft)',
      iconColor: 'var(--info)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
  ]

  const quickActions = [
    { label: 'Nuevo empleado', href: '/employees', color: 'var(--primary)', hoverColor: 'var(--primary-hover)' },
    { label: 'Ver registros', href: '/attendance/records', color: 'var(--text-strong)', hoverColor: '#3C4043' },
    { label: 'Gestionar horarios', href: '/schedules', color: 'var(--text-strong)', hoverColor: '#3C4043' },
    { label: 'Ver reportes', href: '/reports', color: 'var(--text-strong)', hoverColor: '#3C4043' },
  ]

  const noData = activeEmployees === null

  return (
    <section className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-strong)' }}>Dashboard</h1>
          <p className="mt-1 text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
            {todayLabel} — Vista de Sucursal Principal
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
          style={{ background: 'var(--text-strong)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Abrir Kiosco
        </Link>
      </div>

      {/* ── No session warning ── */}
      {noData && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--warning-soft)', border: '1px solid #FBBF24' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
            Sin sesión activa — los datos reales aparecerán una vez que inicies sesión.{' '}
            <Link href="/login" className="underline underline-offset-2">Iniciar sesión →</Link>
          </p>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group relative overflow-hidden rounded-2xl bg-white p-5 transition-all hover:shadow-md"
            style={{ border: '1px solid var(--border-soft)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                <p className="mt-2 text-4xl font-bold" style={{ color: 'var(--text-strong)' }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-light)' }}>{stat.sub}</p>
              </div>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: stat.iconBg, color: stat.iconColor }}
              >
                {stat.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent activity ── */}
      <div className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid var(--border-soft)' }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-strong)' }}>Actividad reciente</h2>
          <Link
            href="/attendance/records"
            className="rounded-full px-3 py-1 text-xs font-semibold transition"
            style={{ background: 'var(--bg-app)', color: 'var(--text-muted)' }}
          >
            Ver todos
          </Link>
        </div>

        {recentRecords && recentRecords.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {recentRecords.map((record) => {
              const emp = record.employees as unknown as { first_name: string; last_name: string; photo_url?: string | null } | null
              const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Empleado'
              const initials = emp ? `${emp.first_name[0]}${emp.last_name[0]}` : '?'
              const isIn = record.event_type === 'clock_in'
              const tardanza = record.tardiness_minutes > 0 ? record.tardiness_minutes : 0
              return (
                <div key={record.id} className="flex items-center gap-4 px-6 py-3.5">
                  {emp?.photo_url ? (
                    <img src={emp.photo_url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--bg-app)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{initials}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-light)' }}>{fmtTime(record.recorded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tardanza > 0 && (
                      <span className="status-badge status-warning">+{tardanza} min</span>
                    )}
                    <span className={`status-badge ${isIn ? 'status-success' : 'status-info'}`}>
                      {isIn ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm" style={{ color: 'var(--text-light)' }}>
            No hay actividad registrada aún.
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Acceso rápido</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-xl px-5 py-4 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: action.color }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
