import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ContractsPage() {
  const supabase = await createClient()

  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      *,
      employees (first_name, last_name, email),
      shifts (name, start_time, end_time)
    `)
    .order('created_at', { ascending: false })

  const total = contracts?.length ?? 0
  const active = contracts?.filter(c => c.status === 'active').length ?? 0
  const expiring = contracts?.filter(c => {
    if (!c.end_date) return false
    const end = new Date(c.end_date)
    const now = new Date()
    const diff = end.getTime() - now.getTime()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }).length ?? 0

  const stats = [
    { label: 'Contrataciones', value: total },
    { label: 'Contratos Activos', value: active },
    { label: 'Por vencer (30d)', value: expiring, alert: expiring > 0 },
  ]

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Gestión Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Contrataciones</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Administra los contratos de tus colaboradores, plantillas legales y vinculación con turnos operativos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/contracts/templates"
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Plantillas
          </Link>
          <Link
            href="/contracts/new"
            className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nueva contratación
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${
            s.alert ? 'ring-orange-200 bg-orange-50/30' : ''
          }`}>
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className={`mt-3 text-3xl font-bold ${s.alert ? 'text-orange-600' : 'text-slate-900'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Contract List */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Historial de Contratos</h2>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Últimos 50 registros
          </div>
        </div>

        {contracts && contracts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Empleado</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tipo / Salario</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Horario Asignado</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Vigencia</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((contract) => {
                  const emp = contract.employees
                  const shift = contract.shifts
                  return (
                    <tr key={contract.id} className="group hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{emp?.first_name} {emp?.last_name}</p>
                        <p className="text-xs text-slate-500">{emp?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">{contract.contract_type}</p>
                        <p className="text-xs font-medium text-slate-400">${contract.salary?.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {shift ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{shift.name}</span>
                            <span className="text-[11px] text-slate-500">{shift.start_time} - {shift.end_time}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-red-400 font-bold italic">Sin horario</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex flex-col text-xs font-medium">
                          <span>Inicia: {new Date(contract.start_date).toLocaleDateString()}</span>
                          {contract.end_date && (
                            <span className="text-slate-400 italic">Vence: {new Date(contract.end_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          contract.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {contract.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/contracts/${contract.id}/edit`}
                          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-20 text-center space-y-3">
             <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
             </div>
             <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">No hay contratos registrados</p>
                <p className="text-xs text-slate-400">Comienza contratando a un colaborador usando el asistente.</p>
             </div>
          </div>
        )}
      </div>
    </section>
  )
}
