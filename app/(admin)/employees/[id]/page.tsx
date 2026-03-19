import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'resumen' } = await searchParams
  const supabase = await createClient()

  const [
    { data: employeeData },
    { data: recentRecords },
    { data: leaveRequests },
    { data: shift },
    { data: contract },
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
      .from('employee_shifts')
      .select('id, is_active, start_date, created_at, shifts(name, start_time, end_time)')
      .eq('employee_id', id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('contracts')
      .select('*')
      .eq('employee_id', id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const employee = employeeData as unknown as any

  if (!employee) notFound()

  const branch    = employee.branches as unknown as { name: string } | null
  const shiftData = shift?.shifts    as unknown as { name: string; start_time: string; end_time: string } | null

  const infoRows = [
    { label: 'Correo',           value: employee.email ?? '—' },
    { label: 'Teléfono',         value: employee.phone ?? '—' },
    { label: 'Sucursal',         value: branch?.name ?? '—' },
    { label: 'Ingreso',          value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-NI') : '—' },
    { label: 'Cédula',           value: employee.national_id ?? '—' },
    { label: 'INSS',             value: employee.social_security_id ?? '—' },
  ]

  const tabClass = (currentTab: string) => 
    `px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
      tab === currentTab
        ? 'border-white text-white'
        : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
    }`

  // Construir Timeline
  const timelineEvents = []
  
  if (employee.hire_date) {
    timelineEvents.push({
      title: 'Ingreso a la empresa',
      date: new Date(employee.hire_date).toLocaleDateString('es-NI'),
      description: 'Registro inicial como colaborador.',
      icon: '🏢'
    })
  }
  
  if (shift) {
    timelineEvents.push({
      title: 'Cambio de turno asignado',
      date: shift.created_at ? new Date(shift.created_at).toLocaleDateString('es-NI') : '—',
      description: `Turno actual: ${shiftData?.name ?? '—'}`,
      icon: '⏱️'
    })
  }

  if (recentRecords && recentRecords.length > 0) {
    const lastRecord = recentRecords[0]
    timelineEvents.push({
      title: 'Última marcación',
      date: new Date(lastRecord.recorded_at).toLocaleString('es-NI', { timeZone: 'America/Managua' }),
      description: `Tipo: ${eventTypeLabels[lastRecord.event_type]?.label ?? lastRecord.event_type}`,
      icon: '📍'
    })
  }

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={`${employee.first_name ?? 'Empleado'} ${employee.last_name ?? ''}`}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-slate-100 shadow"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 ring-4 ring-slate-100 shadow">
              <span className="text-2xl font-bold text-slate-500">
                {employee.first_name?.[0] ?? ''}{employee.last_name?.[0] ?? ''}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Empleados</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {employee.first_name ?? '—'} {employee.last_name ?? ''}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Perfil de Colaborador</p>
            <div className="mt-2 flex gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {employee.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {!employee.employee_code && (
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                  Pendiente de PIN
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/employees/${employee.id}/edit`}
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
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

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar px-2">
        <Link href={`/employees/${employee.id}?tab=resumen`} className={tabClass('resumen')}>
          Resumen
        </Link>
        <Link href={`/employees/${employee.id}?tab=contrato`} className={tabClass('contrato')}>
          Contrato Activo
        </Link>
        <Link href={`/employees/${employee.id}?tab=timeline`} className={tabClass('timeline')}>
          Línea de Vida
        </Link>
      </div>

      {/* Tab: Resumen */}
      {tab === 'resumen' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Datos generales */}
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Datos principales</h2>
            </div>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {infoRows.map((row) => (
                <div key={row.label} className="px-6 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{row.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Últimas marcaciones */}
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                <h2 className="text-base font-semibold text-slate-900">Últimas marcaciones</h2>
              </div>
              <div className="flex-1 overflow-x-auto">
                {recentRecords && recentRecords.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha y hora</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentRecords.slice(0, 5).map((r) => {
                        const et = eventTypeLabels[r.event_type] ?? { label: r.event_type, cls: 'bg-slate-100 text-slate-600' }
                        return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${et.cls}`}>
                                {et.label}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                              {new Date(r.recorded_at).toLocaleString('es-NI', { timeZone: 'America/Managua' })}
                            </td>
                            <td className="px-6 py-3.5">
                              {r.tardiness_minutes && r.tardiness_minutes > 0 ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  +{r.tardiness_minutes}m Tarde
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">OK</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">Sin marcaciones registradas recientemente.</div>
                )}
              </div>
            </div>

            {/* Permisos */}
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">Permisos recientes</h2>
              </div>
              <div className="flex-1 overflow-x-auto">
                {leaveRequests && leaveRequests.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fechas</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaveRequests.map((lr) => {
                        const lt = lr.leave_types as unknown as { name: string } | null
                        const st = leaveStatusConfig[lr.status] ?? { label: lr.status, cls: 'bg-slate-100 text-slate-600' }
                        return (
                          <tr key={lr.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3.5 font-medium text-slate-900 text-xs">{lt?.name ?? '—'}</td>
                            <td className="px-6 py-3.5 text-slate-600 text-[11px] whitespace-nowrap">
                              {new Date(lr.start_date).toLocaleDateString('es-NI')} - {new Date(lr.end_date).toLocaleDateString('es-NI')}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">Sin permisos registrados.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Contrato */}
      {tab === 'contrato' && (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 animate-in fade-in duration-300">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Contrato Activo</h2>
              <p className="mt-1 text-sm text-slate-500">Información del acuerdo laboral actual.</p>
            </div>
            {contract ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 uppercase tracking-wider">
                Vigente
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 uppercase tracking-wider">
                Sin Contrato
              </span>
            )}
          </div>

          {contract ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Contrato</span>
                <p className="mt-2 text-lg font-medium text-slate-900 capitalize">{contract.contract_type ?? 'No especificado'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha de Inicio</span>
                <p className="mt-2 text-lg font-medium text-slate-900">
                  {contract.start_date ? new Date(contract.start_date).toLocaleDateString('es-NI') : '—'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha de Fin</span>
                <p className="mt-2 text-lg font-medium text-slate-900">
                  {contract.end_date ? new Date(contract.end_date).toLocaleDateString('es-NI') : 'Indeterminado'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salario</span>
                <p className="mt-2 text-lg font-medium text-slate-900">
                  {contract.salary ? `C$ ${Number(contract.salary).toLocaleString('es-NI')}` : 'No especificado'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
              <p>El colaborador actual no tiene un contrato registrado en el sistema.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {tab === 'timeline' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 animate-in fade-in duration-300">
          <h2 className="text-xl font-bold text-slate-900 mb-8 pl-4">Línea de Vida del Colaborador</h2>
          
          <div className="relative border-l-2 border-slate-100 ml-6 pb-4">
            {timelineEvents.map((evt, idx) => (
              <div key={idx} className="mb-10 ml-8 relative">
                <div className="absolute -left-[45px] top-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ring-4 ring-white shadow-sm text-lg">
                  {evt.icon}
                </div>
                <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100 ml-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{evt.date}</span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{evt.title}</h3>
                  <p className="text-sm text-slate-600 mt-2">{evt.description}</p>
                </div>
              </div>
            ))}

            {timelineEvents.length === 0 && (
              <div className="ml-8 text-sm text-slate-400">No hay eventos para mostrar en la línea de vida.</div>
            )}
          </div>
        </div>
      )}

    </section>
  )
}
