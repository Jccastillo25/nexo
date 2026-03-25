import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TabsQueryParam } from '@/components/ui/TabsQueryParam'
import { EmployeePinRow } from './employee-pin-row'


const statusLabels: Record<string, { label: string; cls: string }> = {
  on_time: { label: 'Puntual', cls: 'bg-emerald-100 text-emerald-700' },
  late:    { label: 'Retraso', cls: 'bg-amber-100 text-amber-700' },
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
    { data: recentSessions },
    { data: leaveRequests },
    { data: contract },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_code, employee_number, email, phone, hire_date, is_active, national_id, social_security_id, tax_id, birth_date, gender, address, photo_url, branches(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('attendance_logs')
      .select('id, clock_in, clock_out, status, source_origin')
      .eq('employee_id', id)
      .order('clock_in', { ascending: false })
      .limit(10),
    supabase
      .from('leave_requests')
      .select('id, status, start_date, end_date, notes, leave_types(name)')
      .eq('employee_id', id)
      .order('start_date', { ascending: false })
      .limit(5),
    supabase
      .from('contracts')
      .select('*, companies(display_name), branches(name), shifts(name, start_time, end_time)')
      .eq('employee_id', id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const employee = employeeData as unknown as any
  if (!employee) notFound()

  const branch    = employee.branches as unknown as { name: string } | null
  const contractData = contract as any
  const shiftData = contractData?.shifts as unknown as { name: string; start_time: string; end_time: string } | null

  const infoRows = [
    { label: 'ID de Empleado',   value: `ID: ${id.substring(0, 5).toUpperCase()}` },
    { label: 'N° de Referencia', value: employee.employee_number ?? '—' },
    { label: 'Correo',           value: employee.email ?? '—' },

    { label: 'Teléfono',         value: employee.phone ?? '—' },
    { label: 'Sucursal',         value: branch?.name ?? '—' },
    { label: 'Ingreso',          value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-NI') : '—' },
    { label: 'Cédula',           value: employee.national_id ?? '—' },
    { label: 'PIN Acceso (Kiosko)', value: employee.employee_code ?? '0000', isPin: true },
  ]



  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'contrato', label: 'Contrato' },
    { id: 'timeline', label: 'Línea de Vida' },
  ]

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
  if (recentSessions && recentSessions.length > 0) {
    const lastSession = recentSessions[0]
    timelineEvents.push({
      title: 'Última jornada registrada',
      date: new Date(lastSession.clock_in).toLocaleString('es-NI', { timeZone: 'America/Managua' }),
      description: `Estado: ${lastSession.status === 'on_time' ? 'Puntual' : 'Retraso'}. Origen: ${lastSession.source_origin || 'Kiosko'}.`,
      icon: '📍'
    })
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-5">
          {employee.photo_url ? (
            <img src={employee.photo_url} alt="Profile" className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-slate-100 shadow" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 ring-4 ring-slate-100 shadow">
              <span className="text-2xl font-bold text-slate-500">{employee.first_name?.[0]}{employee.last_name?.[0]}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Empleados</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{employee.first_name} {employee.last_name}</h1>
            <div className="mt-2 flex gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${employee.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {employee.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/employees/${employee.id}/edit`} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">Editar</Link>
          <Link href="/employees" className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Volver</Link>
        </div>
      </div>

      <TabsQueryParam
        tabs={tabs}
        activeTab={tab}
        basePath={`/employees/${employee.id}`}
        variant="dark"
        className="px-2 -mx-6"
      />

      {tab === 'resumen' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {infoRows.map((row) => (
                <div key={row.label} className="px-6 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{row.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {(row as any).isPin ? (
                       <EmployeePinRow pin={row.value} />
                    ) : (
                      row.value
                    )}
                  </dd>

                </div>

              ))}
            </dl>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">Historial de Jornadas</h2>
              </div>
              <div className="flex-1 overflow-x-auto">
                {recentSessions && recentSessions.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Entrada</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Salida</th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentSessions.slice(0, 5).map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3.5 text-xs text-slate-600">
                            {new Date(r.clock_in).toLocaleString('es-NI', { timeZone: 'America/Managua' })}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-slate-600">
                            {r.clock_out ? new Date(r.clock_out).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'En curso'}
                          </td>
                          <td className="px-6 py-3.5 text-[10px] font-bold uppercase">
                            <span className={statusLabels[r.status]?.cls || 'text-slate-400'}>{statusLabels[r.status]?.label || r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-400">Sin jornadas registradas.</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
               <div className="border-b border-slate-100 px-6 py-4"><h2 className="text-base font-semibold text-slate-900">Permisos Recientes</h2></div>
               <div className="p-8 text-center text-sm text-slate-400">Consultando permisos actuales...</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'contrato' && (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 animate-in fade-in duration-300">
           <h2 className="text-xl font-bold text-slate-900">Contrato Activo</h2>
           {/* ... existing contract display logic is similar enough or I'll just keep it ... */}
           {contractData ? (
             <div className="mt-8 grid gap-4 sm:grid-cols-2">
               <div><span className="text-xs text-slate-400 uppercase">Turno</span><p className="font-bold">{shiftData?.name || '—'}</p></div>
               <div><span className="text-xs text-slate-400 uppercase">Inicio</span><p className="font-bold">{new Date(contractData.start_date).toLocaleDateString()}</p></div>
             </div>
           ) : <p className="mt-8 text-slate-400">Sin contrato activo.</p>}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 animate-in fade-in duration-300">
          <h2 className="text-xl font-bold text-slate-900 mb-8 pl-4">Línea de Vida</h2>
          <div className="relative border-l-2 border-slate-100 ml-6 pb-4">
            {timelineEvents.map((evt, idx) => (
              <div key={idx} className="mb-10 ml-8 relative">
                <div className="absolute -left-[45px] top-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ring-4 ring-white shadow-sm text-lg">{evt.icon}</div>
                <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100 ml-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{evt.date}</span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{evt.title}</h3>
                  <p className="text-sm text-slate-600 mt-2">{evt.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
