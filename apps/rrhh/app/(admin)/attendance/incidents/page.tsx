import { createClient } from '@/lib/supabase/server'

type Incident = {
  id: string
  type: string
  minutes: number | null
  status: string
  remarks: string | null
  created_at: string
  employees: { first_name: string; last_name: string; employee_code: string } | null
}

const typeConfig: Record<string, { label: string; cls: string }> = {
  tardiness:           { label: 'Tardanza',          cls: 'bg-amber-100  text-amber-700'  },
  absence:             { label: 'Ausencia',           cls: 'bg-red-100    text-red-700'    },
  early_departure:     { label: 'Salida anticipada',  cls: 'bg-orange-100 text-orange-700' },
  incomplete_punch:    { label: 'Marc. incompleta',   cls: 'bg-slate-100  text-slate-600'  },
  unauthorized_overtime:{ label: 'Horas extra no aut.', cls: 'bg-purple-100 text-purple-700' },
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  open:     { label: 'Abierta',   cls: 'bg-red-100   text-red-700'   },
  reviewed: { label: 'Revisada',  cls: 'bg-amber-100 text-amber-700' },
  closed:   { label: 'Cerrada',   cls: 'bg-green-100 text-green-700' },
}

export default async function IncidentsPage() {
  const supabase = await createClient()

  const { data: rawIncidents } = await supabase
    .from('incidents')
    .select(
      'id, type, minutes, status, remarks, created_at, ' +
      'employees(first_name, last_name, employee_code)'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  const incidents = rawIncidents as unknown as Incident[] | null

  const open      = incidents?.filter((i) => i.status === 'open').length     ?? 0
  const tardiness = incidents?.filter((i) => i.type === 'tardiness').length  ?? 0
  const absence   = incidents?.filter((i) => i.type === 'absence').length    ?? 0
  const others    = (incidents?.length ?? 0) - tardiness - absence

  const stats = [
    { label: 'Abiertas',    value: open },
    { label: 'Tardanzas',   value: tardiness },
    { label: 'Ausencias',   value: absence },
    { label: 'Otros tipos', value: others },
  ]

  return (
    <section className="space-y-6">

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Asistencia</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Incidencias</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Tardanzas, ausencias, marcaciones incompletas y eventos fuera de turno detectados por el sistema.
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

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Incidencias registradas ({incidents?.length ?? 0})
          </h2>
        </div>

        {incidents && incidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empleado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Minutos</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Observaciones</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => {
                  const emp  = inc.employees
                  const type = typeConfig[inc.type]   ?? { label: inc.type,   cls: 'bg-slate-100 text-slate-600' }
                  const st   = statusConfig[inc.status] ?? { label: inc.status, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <tr key={inc.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                        </p>
                        {emp?.employee_code && (
                          <p className="text-xs font-mono text-slate-400">{emp.employee_code}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${type.cls}`}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {inc.minutes != null ? `${inc.minutes} min` : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                        {inc.remarks ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(inc.created_at).toLocaleDateString('es-NI')}
                      </td>
                      <td className="px-6 py-4">
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
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No hay incidencias registradas.</p>
            <p className="mt-1 text-xs text-slate-400">
              Las incidencias se generan automáticamente cuando el sistema detecta anomalías en las marcaciones.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
