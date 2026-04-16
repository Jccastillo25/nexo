import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EmployeeTableRow } from './employee-table-row'


export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; shift?: string; company_id?: string }>
}) {
  const { q, branch, shift, company_id } = await searchParams
  const supabase = await createClient()

  let selectQuery = 'id, employee_code, first_name, last_name, is_active, hire_date, email, phone, photo_url, job_position_id, branches(id, name), job_positions(id, name), contracts(id, status, end_date)'
  if (shift) {
    selectQuery += ', employee_shifts!inner(shift_template_id, is_active)'
  }

  let query = supabase.from('employees').select(selectQuery, { count: 'exact' })

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (branch) {
    query = query.eq('branch_id', branch)
  }
  if (shift) {
    query = query.eq('employee_shifts.shift_template_id', shift).eq('employee_shifts.is_active', true)
  }
  if (company_id && company_id !== 'all') {
    query = query.eq('company_id', company_id)
  }

  // Helper to apply filters to head queries
  const applyParams = (qObj: any) => {
    let q2 = qObj
    if (company_id && company_id !== 'all') {
      q2 = q2.eq('company_id', company_id)
    }
    return q2
  }

  try {
    const [
      results,
      inactiveResult,
      noPinResult,
      branchesResult,
      shiftsListResult,
    ] = await Promise.all([
      query.order('first_name'),
      applyParams(supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', false)),
      applyParams(supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true).is('employee_code', null)),
      applyParams(supabase.from('branches').select('id, name').eq('is_active', true).order('name')),
      supabase.from('shift_templates').select('id, name').eq('is_active', true).order('name'),
    ])

    const employees = (results.data as unknown as any[]) || []
    const total = results.count || 0
    const inactive = inactiveResult.count || 0
    const noPin = noPinResult.count || 0
    const branches = branchesResult.data || []
    const shiftsList = shiftsListResult.data || []



    const stats = [
      { label: 'Total', value: total },
      { label: 'Activos', value: Math.max(0, total - inactive) },
      { label: 'Inactivos', value: inactive },
      { label: 'Pendientes de PIN', value: noPin },
    ]

    return (
      <section className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">
              Recursos humanos
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight">Directorio de Empleados</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Listado maestro de colaboradores con perfil, estado, sucursal y turno asignado.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/employees/new"
              className="shrink-0 rounded-2xl bg-blue-500 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              + Nuevo empleado
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="app-surface p-5 relative overflow-hidden group hover:border-slate-500 transition-all">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-2 relative z-10">{s.label}</p>
              <p className={`text-3xl font-black relative z-10 tracking-tight ${s.label === 'Pendientes de PIN' && s.value > 0 ? 'text-amber-400' : 'text-white'}`}>
                {s.value}
              </p>
              {s.label === 'Pendientes de PIN' && s.value > 0 && (
                <div className="absolute inset-0 bg-amber-500/5 transition-opacity group-hover:bg-amber-500/10"></div>
              )}
            </div>
          ))}
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
                className="h-11 w-full rounded-2xl border border-slate-700 bg-slate-800/50 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>

            <select
              name="branch"
              defaultValue={branch}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Todas las sucursales</option>
              {branches?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              name="shift"
              defaultValue={shift}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Todos los turnos</option>
              {shiftsList?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {(q || branch || shift) && (
              <Link href="/employees" className="h-11 flex items-center px-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Limpiar filtros
              </Link>
            )}
            <button type="submit" className="hidden">Buscar</button>
          </form>
          
          <div className="flex gap-2 text-xs font-semibold text-slate-400 sm:hidden">
            <span>{total} Total</span>
            <span>•</span>
            <span className="text-green-400">{Math.max(0, total - inactive)} Activos</span>
          </div>
        </div>

        {/* Tabla */}
        <div className="app-surface overflow-hidden">
          <div className="border-b border-slate-700/50 px-6 py-5 flex items-center justify-between">
            <h2 className="text-base font-black text-white tracking-tight uppercase">
              Todos los empleados
            </h2>
          </div>

          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr className="text-left">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Puesto</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sucursal</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Contrato</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">PIN</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {employees.map((emp) => (
                    <EmployeeTableRow key={emp.id} emp={emp} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-slate-500">
              No se encontraron empleados para esta organización.
            </div>
          )}
        </div>
      </section>
    )
  } catch (error) {
    console.error('Error loading employees:', error)
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center app-surface p-8 text-center">
        <div className="mb-4 rounded-full bg-red-500/10 border border-red-500/20 p-3 text-red-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-white tracking-tight uppercase">Error al cargar datos</h2>
        <p className="mt-2 text-center text-sm text-slate-400 break-all max-w-md">
          {error instanceof Error ? error.message : 'Problema de conexión con la base de datos.'}
        </p>
        <Link href="/employees" className="mt-6 rounded-xl bg-slate-800 border border-slate-700 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-500 transition-all">
          Reintentar
        </Link>
      </div>
    )
  }
}
