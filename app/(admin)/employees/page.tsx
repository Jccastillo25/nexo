import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export default async function EmployeesPage() {
  const supabase = await createClient()

  const [
    { data: employees, count: total },
    { count: inactive },
    { count: noShift },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, employee_code, first_name, last_name, is_active, hire_date, email, branches(name)', { count: 'exact' })
      .order('first_name'),
    supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not(
        'id',
        'in',
        `(select employee_id from employee_shifts where is_active = true)`,
      ),
  ])

  const stats = [
    { label: 'Total', value: total ?? 0 },
    { label: 'Activos', value: (total ?? 0) - (inactive ?? 0) },
    { label: 'Inactivos', value: inactive ?? 0 },
    { label: 'Sin turno asignado', value: noShift ?? 0 },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Recursos humanos
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Empleados</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Listado maestro de colaboradores con perfil, estado, sucursal y turno asignado.
          </p>
        </div>
        <Link
          href="/employees/new"
          className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + Nuevo empleado
        </Link>
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
            Todos los empleados
          </h2>
        </div>

        {employees && employees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                   <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Correo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Teléfono</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sucursal</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Ingreso</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const branch = emp.branches as unknown as { name: string } | null
                  const hireDate = emp.hire_date
                    ? new Date(emp.hire_date).toLocaleDateString('es-NI', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'
                  return (
                    <tr key={emp.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {emp.employee_code}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {emp.first_name} {emp.last_name}
                      </td>
                       <td className="px-6 py-4 text-slate-500">
                        {emp.email ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {emp.phone ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {branch?.name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{hireDate}</td>
                      <td className="px-6 py-4">
                        <StatusBadge active={emp.is_active} />
                      </td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
                        >
                          Ver perfil
                        </Link>
                        <span className="text-slate-200">|</span>
                        <Link
                          href={`/employees/${emp.id}/edit`}
                          className="text-xs font-semibold text-slate-900 underline-offset-2 hover:underline"
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
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">
              No hay empleados registrados aún.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Los empleados aparecerán aquí una vez que inicies sesión y agregues colaboradores.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
