import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function FixVisibilityPage() {
  const supabase = await createClient()

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-10 text-center">Inicia sesión primero.</div>

  // 2. Find ALL existing companies (using service role bypass or standard client if permitted)
  // For safety and visibility in this dev context, we'll try to find any company.
  const { data: companies } = await supabase.from('companies').select('id, display_name, slug')

  if (!companies || companies.length === 0) {
    return (
      <div className="p-10 text-center space-y-4">
        <h1 className="text-xl font-bold text-red-600 font-mono">DEBUG: NO COMPANIES FOUND</h1>
        <p>El sistema no encontró ninguna empresa en la base de datos.</p>
        <p className="text-xs text-slate-400">User ID: {user.id}</p>
      </div>
    )
  }

  // 3. Create memberships for the current user in all found companies
  const results = []
  for (const co of companies) {
    const { data: existing } = await supabase
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', co.id)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('company_memberships').insert({
        user_id: user.id,
        company_id: co.id,
        role: 'admin',
        is_active: true
      })
      results.push({ name: co.display_name, status: error ? `Error: ${error.message}` : '✅ VINCULADO' })
    } else {
      results.push({ name: co.display_name, status: 'Ya vinculado' })
    }
  }

  return (
    <div className="mx-auto max-w-lg p-10 space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Recuperación de Acceso</h1>
        <p className="mt-2 text-sm text-slate-500">
          Este asistente ha sincronizado tu cuenta ({user.email}) con las empresas existentes.
        </p>

        <div className="mt-6 space-y-3">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <span className="font-semibold text-slate-700">{r.name}</span>
              <span className="text-xs font-bold uppercase tracking-wider">{r.status}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Ir al Dashboard
        </button>
      </div>
    </div>
  )
}
