import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const roleLabels: Record<string, string> = {
  owner:      'Propietario',
  admin:      'Administrador',
  rrhh:       'RRHH',
  supervisor: 'Supervisor',
  viewer:     'Visor',
}

const roleColors: Record<string, string> = {
  owner:      'bg-violet-100 text-violet-700',
  admin:      'bg-blue-100   text-blue-700',
  rrhh:       'bg-teal-100   text-teal-700',
  supervisor: 'bg-amber-100  text-amber-700',
  viewer:     'bg-slate-100  text-slate-600',
}

export default async function MembershipsPage() {
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('company_memberships')
    .select('id, role, is_active, created_at, profiles(email, full_name), companies(display_name)')
    .order('role')

  const active   = memberships?.filter((m) => m.is_active).length  ?? 0
  const inactive = (memberships?.length ?? 0) - active

  const roleCount = (memberships ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-6">

      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Organización</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Membresías</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Usuarios con acceso al sistema, su rol y empresa asignada.
          </p>
        </div>
        <Link
          href="/organization"
          className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Organización
        </Link>
      </div>

      {/* Resumen por rol */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{roleCount[role] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Stats generales */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total',     value: memberships?.length ?? 0 },
          { label: 'Activas',   value: active },
          { label: 'Inactivas', value: inactive },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Miembros con acceso</h2>
        </div>

        {memberships && memberships.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empresa</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rol</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Desde</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memberships.map((m) => {
                  const profile = m.profiles as unknown as { email: string; full_name: string | null } | null
                  const co      = m.companies as unknown as { display_name: string } | null
                  const roleCls = roleColors[m.role] ?? 'bg-slate-100 text-slate-600'
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{profile?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{profile?.email ?? ''}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{co?.display_name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleCls}`}>
                          {roleLabels[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(m.created_at).toLocaleDateString('es-NI')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {m.is_active ? 'Activo' : 'Inactivo'}
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
            <p className="text-sm font-semibold text-slate-500">No hay membresías configuradas.</p>
            <p className="mt-1 text-xs text-slate-400">
              Crea un usuario administrador en Supabase y asígnalo a una empresa para comenzar.
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
