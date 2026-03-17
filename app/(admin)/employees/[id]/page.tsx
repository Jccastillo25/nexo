import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PinManager } from './pin-manager'

const eventTypeLabels: Record<string, { label: string; cls: string }> = {
  clock_in:    { label: 'Entrada',         cls: 'bg-green-100 text-green-700'  },
  clock_out:   { label: 'Salida',          cls: 'bg-slate-100 text-slate-600'  },
  break_start: { label: 'Inicio descanso', cls: 'bg-amber-100 text-amber-700' },
  break_end:   { label: 'Fin descanso',    cls: 'bg-blue-100  text-blue-700'  },
}

const leaveStatusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobado',  cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100   text-red-700'   },
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: employee },
    { data: recentRecords },
    { data: leaveRequests },
    { data: pin },
    { data: shift },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, email, phone, hire_date, is_active, national_id, social_security_id, tax_id, birth_date, gender, address, photo_url, branches(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('time_records')
      .select('id, event_type, recorded_at, tardiness_minutes, overtime_minutes, source')
      .eq('employee_id', id)
      .order('recorded_at', { ascending: false })
      .limit(10),
    supabase
      .from('leave_requests')
      .select('id, status, start_date, end_date, notes, leave_types(name)')
      .eq('employee_id', id)
      .order('start_date', { ascending: false })
      .limit(5),
    supabase
      .from('employee_pins')
      .select('id, pin, is_active, created_at, last_revealed_at, last_reset_at')
      .eq('employee_id', id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('employee_shifts')
      .select('id, is_active, start_date, shifts(name, start_time, end_time)')
      .eq('employee_id', id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (!employee) notFound()

  const branch    = employee.branches as unknown as { name: string } | null
  const shiftData = shift?.shifts    as unknown as { name: string; start_time: string; end_time: string } | null

  const infoRows = [
    { label: 'Código PIN',       value: 'Protegido (Ver panel de Seguridad)' },
    { label: 'Correo',           value: employee.email ?? '—' },
    { label: 'Teléfono',         value: employee.phone ?? '—' },
    { label: 'Sucursal',         value: branch?.name ?? '—' },
    { label: 'Ingreso',          value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-NI') : '—' },
    { label: 'Turno',            value: shiftData ? `${shiftData.name} (${shiftData.start_time.slice(0, 5)}–${shiftData.end_time.slice(0, 5)})` : '—' },
    { label: 'PIN en historial', value: pin ? 'Sí' : 'No' },
    { label: 'PIN creado',       value: pin?.created_at ? new Date(pin.created_at).toLocaleDateString('es-NI') : '—' },
    { label: 'Último reveal',    value: pin?.last_revealed_at ? new Date(pin.last_revealed_at).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : '—' },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-slate-100 shadow"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 ring-4 ring-slate-100 shadow">
              <span className="text-2xl font-bold text-slate-500">
                {employee.first_name[0]}{employee.last_name[0]}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Empleados</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Perfil de Colaborador</p>
            <div className="mt-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {employee.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/employees/${employee.id}/edit`}
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Editar perfil
          </Link>
          <Link
            href="/employees"
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Empleados
          </Link>
        </div>
      </div>

      {/* PIN de seguridad */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <PinManager employeeId={employee.id} currentPin={employee.employee_code ?? '0000'} />
      </div>

      {/* Datos generales */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Datos profesionales</h2>
        </div>
        <dl className="divide-y divide-slate-100">
          {infoRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[180px_1fr] gap-4 px-6 py-4">
              <dt className="text-sm font-medium text-slate-500">{row.label}</dt>
              <dd className="text-sm text-slate-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Últimas marcaciones */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Últimas marcaciones</h2>
        </div>
        {recentRecords && recentRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha y hora</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tardanza</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Horas extra</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRecords.map((r) => {
                  const et = eventTypeLabels[r.event_type] ?? { label: r.event_type, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${et.cls}`}>
                          {et.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs">
                        {new Date(r.recorded_at).toLocaleString('es-NI', { timeZone: 'America/Managua' })}
                      </td>
                      <td className="px-6 py-3.5">
                        {r.tardiness_minutes && r.tardiness_minutes > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            +{r.tardiness_minutes} min
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {r.overtime_minutes && r.overtime_minutes > 0 ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            +{r.overtime_minutes} min
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-400 capitalize">{r.source ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            Sin marcaciones registradas.
          </div>
        )}
      </div>

      {/* Permisos recientes */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Permisos recientes</h2>
        </div>
        {leaveRequests && leaveRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Inicio</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fin</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Notas</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveRequests.map((lr) => {
                  const lt = lr.leave_types as unknown as { name: string } | null
                  const st = leaveStatusConfig[lr.status] ?? { label: lr.status, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <tr key={lr.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-medium text-slate-900">{lt?.name ?? '—'}</td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs">
                        {new Date(lr.start_date).toLocaleDateString('es-NI')}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs">
                        {new Date(lr.end_date).toLocaleDateString('es-NI')}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 max-w-xs truncate">{lr.notes ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            Sin permisos registrados.
          </div>
        )}
      </div>

    </section>
  )
}
