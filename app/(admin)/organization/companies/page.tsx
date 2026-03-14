import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function CompaniesPage() {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  const { data: companies, error: companiesErr } = await supabase
    .from('companies')
    .select('*')
    .order('display_name')

  const active   = companies?.filter((c) => c.is_active).length  ?? 0
  const inactive = (companies?.length ?? 0) - active

  return (
    <section className="space-y-6">

      <div className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Organización</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Empresas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Empresas registradas en el sistema y sus parámetros base.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/organization"
            className="shrink-0 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            ← Organización
          </Link>
          <Link
            href="/organization/companies/new"
            className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nueva empresa
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs font-mono text-amber-800">
        <p><strong>DIAGNÓSTICO RLS:</strong></p>
        <p>User ID: {user?.id || 'NULL'}</p>
        <p>Companies Fetched: {companies?.length ?? 'undefined'}</p>
        <p>Fetch Error: {companiesErr?.message || 'None'}</p>
        <p>Auth Error: {authErr?.message || 'None'}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total',    value: companies?.length ?? 0 },
          { label: 'Activas',  value: active },
          { label: 'Inactivas',value: inactive },
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
          <h2 className="text-base font-semibold text-slate-900">Empresas registradas</h2>
        </div>

        {companies && companies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Razón social</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Slug</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">RUC / NIT</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Creada</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{c.display_name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.legal_name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{c.slug}</td>
                    <td className="px-6 py-4 text-slate-500">{c.tax_id ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('es-NI')}
                    </td>
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
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No hay empresas registradas.</p>
            <p className="mt-1 text-xs text-slate-400">Las empresas se crean durante el proceso de onboarding.</p>
          </div>
        )}
      </div>

    </section>
  )
}
