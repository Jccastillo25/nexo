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

      <div className="mb-8">
        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Estructura</p>
        <h1 className="text-3xl font-black text-white tracking-tight">Organización</h1>
        <p className="mt-2 text-sm text-slate-400">
          Estructura del grupo: empresas, sucursales y acceso de miembros.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="app-surface p-5 relative overflow-hidden group hover:border-slate-500 transition-all">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-2">{s.label}</p>
            <p className="text-3xl font-black text-white tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {subModules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group app-surface p-6 transition-all hover:border-slate-500 hover:bg-slate-800"
          >
            <h2 className="text-base font-black text-white tracking-tight">{m.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{m.desc}</p>
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ir →</p>
          </Link>
        ))}
      </div>

      {/* Empresas */}
      {companies && companies.length > 0 && (
        <div className="app-surface overflow-hidden">
          <div className="border-b border-slate-700/50 px-6 py-5">
            <h2 className="text-base font-black text-white tracking-tight uppercase">Empresas registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Razón social</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Slug</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors border-b border-slate-700/50 last:border-0">
                    <td className="px-6 py-4 font-bold text-white">{c.display_name}</td>
                    <td className="px-6 py-4 text-slate-400 font-medium">{c.legal_name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{c.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border border-current ${c.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
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
        <div className="app-surface overflow-hidden">
          <div className="border-b border-slate-700/50 px-6 py-5">
            <h2 className="text-base font-black text-white tracking-tight uppercase">Sucursales registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sucursal</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Código</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Empresa</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {branches.map((b) => {
                  const co = b.companies as unknown as { display_name: string } | null
                  return (
                    <tr key={b.id} className="hover:bg-slate-800/50 transition-colors border-b border-slate-700/50 last:border-0">
                      <td className="px-6 py-4 font-bold text-white">{b.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{b.code ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-400 font-medium">{co?.display_name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border border-current ${b.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
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
