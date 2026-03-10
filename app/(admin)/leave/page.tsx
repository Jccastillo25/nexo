import { createClient } from '@/lib/supabase/server'

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobado',   cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado',  cls: 'bg-red-100 text-red-600' },
  cancelled:{ label: 'Cancelado',  cls: 'bg-slate-100 text-slate-500' },
}

export default async function LeavePage() {
  const supabase = await createClient()

  const [
    { count: pending },
    { count: approved },
    { count: rejected },
    { count: leaveTypes },
    { data: requests },
  ] = await Promise.all([
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('leave_types').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('leave_requests')
      .select('id, status, start_date, end_date, days_requested, reason, employees(first_name, last_name), leave_types(name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const stats = [
    { label: 'Pendientes',         value: pending  ?? 0 },
    { label: 'Aprobadas',          value: approved ?? 0 },
    { label: 'Rechazadas',         value: rejected ?? 0 },
    { label: 'Tipos configurados', value: leaveTypes ?? 0 },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Operación
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Permisos y ausencias
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Control de solicitudes, tipos de permiso, aprobaciones y estado del equipo.
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

      {/* Tabla de solicitudes */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Solicitudes recientes
          </h2>
        </div>

        {requests && requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empleado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fechas</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Días</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const emp = req.employees as unknown as { first_name: string; last_name: string } | null
                  const lt  = req.leave_types as unknown as { name: string } | null
                  const sc  = statusConfig[req.status] ?? { label: req.status, cls: 'bg-slate-100 text-slate-500' }
                  const fmtDate = (d: string) =>
                    new Date(d).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric' })
                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{lt?.name ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {fmtDate(req.start_date)} – {fmtDate(req.end_date)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {Number(req.days_requested)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {req.reason}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">
              No hay solicitudes de permiso registradas.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Las solicitudes aparecerán aquí cuando los empleados las envíen.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
