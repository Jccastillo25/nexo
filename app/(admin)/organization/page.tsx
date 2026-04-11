import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function OrganizationPage() {
  const supabase = await createClient()

  const [
    { data: companies, count: totalCompanies },
    { data: branches,  count: totalBranches  },
    { count: totalMembers },
  ] = await Promise.all([
    supabase.from('companies').select('id, display_name, legal_name, slug, is_active', { count: 'exact' }),
    supabase.from('branches').select('id, name, code, is_active, companies(display_name)', { count: 'exact' }),
    supabase.from('company_memberships').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const stats = [
    { label: 'Empresas',  value: totalCompanies ?? 0 },
    { label: 'Sucursales', value: totalBranches  ?? 0 },
    { label: 'Miembros activos', value: totalMembers ?? 0 },
  ]



  const subModules = [
    { title: 'Empresas',   href: '/organization/companies',    desc: 'Gestiona las empresas del grupo.' },
    { title: 'Sucursales', href: '/organization/branches',     desc: 'Administra sucursales y ubicaciones.' },
    { title: 'Membresías', href: '/organization/memberships',  desc: 'Controla acceso y roles por empresa.' },
  ]

  return (
    <section className="space-y-6">

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Estructura</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Organización</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Estructura del grupo: empresas, sucursales y acceso de miembros.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {subModules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
          >
            <h2 className="text-base font-semibold text-slate-900">{m.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{m.desc}</p>
            <p className="mt-4 text-xs font-semibold text-slate-400 group-hover:text-slate-600">Ir →</p>
          </Link>
        ))}
      </div>

      {/* Empresas */}
      {companies && companies.length > 0 && (
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Empresas registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Razón social</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Slug</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{c.display_name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.legal_name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{c.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sucursales */}
      {branches && branches.length > 0 && (
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Sucursales registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sucursal</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empresa</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => {
                  const co = b.companies as unknown as { display_name: string } | null
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{b.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{b.code ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{co?.display_name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {b.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  )
}
