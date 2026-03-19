import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Printer, Mail } from 'lucide-react'

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

function PinBadge({ hasPin }: { hasPin: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        hasPin
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {hasPin ? 'Sí' : 'No generado'}
    </span>
  )
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; shift?: string }>
}) {
  const { q, branch, shift } = await searchParams
  const supabase = await createClient()

  let selectQuery = 'id, employee_code, first_name, last_name, is_active, hire_date, email, phone, branches!inner(id, name)'
  if (shift) {
    selectQuery += ', employee_shifts!inner(shift_id, is_active)'
  }

  let query = supabase.from('employees').select(selectQuery, { count: 'exact' })

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (branch) {
    query = query.eq('branch_id', branch)
  }
  if (shift) {
    query = query.eq('employee_shifts.shift_id', shift).eq('employee_shifts.is_active', true)
  }

  const [
    { data: employees, count: total },
    { count: inactive },
    { count: noPin },
    { data: branches },
    { data: shiftsList },
  ] = await Promise.all([
    query.order('first_name'),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', false),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('employee_code', null),
    supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    supabase.from('shifts').select('id, name').eq('is_active', true).order('name'),
  ])

  const stats = [
    { label: 'Total', value: total ?? 0 },
    { label: 'Activos', value: (total ?? 0) - (inactive ?? 0) },
    { label: 'Inactivos', value: inactive ?? 0 },
    { label: 'Pendientes de PIN', value: noPin ?? 0 },
  ]

  return (
    <section className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Recursos humanos
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Directorio de Empleados</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Listado maestro de colaboradores con perfil, estado, sucursal y turno asignado.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/employees/new"
            className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nuevo empleado
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form className="relative flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre o correo..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>

          <select
            name="branch"
            defaultValue={branch}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">Todas las sucursales</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            name="shift"
            defaultValue={shift}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            onChange={(e) => e.target.form?.submit()}
          >
            <option value="">Todos los turnos</option>
            {shiftsList?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {(q || branch || shift) && (
            <Link href="/employees" className="h-11 flex items-center px-4 text-sm text-slate-500 hover:text-slate-900">
              Limpiar
            </Link>
          )}
        </form>
        
        {/* Stats Summary Mobile */}
        <div className="flex gap-2 text-xs font-semibold text-slate-500 sm:hidden">
          <span>{total} Total</span>
          <span>•</span>
          <span className="text-green-600">{stats[1].value} Activos</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 relative overflow-hidden">
            <p className="text-sm text-slate-500 relative z-10">{s.label}</p>
            <p className={`mt-3 text-3xl font-bold relative z-10 ${s.label === 'Pendientes de PIN' && s.value > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {s.value}
            </p>
            {s.label === 'Pendientes de PIN' && s.value > 0 && (
               <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-amber-50 to-transparent"></div>
            )}
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Todos los empleados
          </h2>
          {q && (
            <span className="text-xs text-slate-500">
              Mostrando resultados para "{q}"
            </span>
          )}
        </div>

        {employees && employees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Teléfono</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sucursal</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">PIN Generado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const branchObj = emp.branches as unknown as { name: string } | null
                  return (
                    <tr key={emp.id} className="transition hover:bg-slate-50 group">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div className="font-semibold">{emp.first_name} {emp.last_name}</div>
                            <div className="text-xs text-slate-500 font-normal">{emp.email ?? 'Sin correo'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {emp.phone ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {branchObj?.name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <PinBadge hasPin={!!emp.employee_code} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge active={emp.is_active} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button title="Imprimir Credencial" className="text-slate-400 hover:text-slate-900 transition">
                            <Printer size={16} />
                          </button>
                          <button title="Enviar PIN por Email" className="text-slate-400 hover:text-slate-900 transition mr-2">
                            <Mail size={16} />
                          </button>
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
                        </div>
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
              {q || branch || shift ? 'No se encontraron resultados para estos filtros.' : 'No hay empleados registrados aún.'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {q || branch || shift ? 'Prueba cambiando tus criterios de búsqueda.' : 'Los empleados aparecerán aquí una vez que los registres.'}
            </p>
          </div>
        )}
      </div>

    </section>
  )
}

