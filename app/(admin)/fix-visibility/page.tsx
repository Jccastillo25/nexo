import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function FixVisibilityPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. Get current user (using standard client to ensure session context)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-10 text-center font-bold">Por favor, inicia sesión primero.</div>

  // 2. Find ALL existing companies (using ADMIN client to bypass RLS)
  const { data: companies, error: coErr } = await adminClient
    .from('companies')
    .select('id, display_name, slug')

  if (coErr) {
    return (
      <div className="p-10 text-center border-2 border-dashed border-red-200 rounded-3xl m-10">
        <h1 className="text-xl font-bold text-red-600 mb-4">Error de Conexión Admin</h1>
        <p className="text-slate-600">{coErr.message}</p>
        <p className="mt-4 text-xs text-slate-400 font-mono">Verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada.</p>
      </div>
    )
  }

  if (!companies || companies.length === 0) {
    return (
      <div className="p-10 text-center space-y-4 max-w-lg mx-auto mt-20">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-slate-900">No se encontraron empresas</h1>
        <p className="text-slate-500">
          Incluso con permisos de super-administrador, la base de datos de empresas parece estar vacía.
        </p>
      </div>
    )
  }

  // 3. Create memberships and count employees
  const results = []
  for (const co of companies) {
    // Count employees for this company
    const { count: empCount } = await adminClient
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', co.id)

    // Check if membership already exists
    const { data: existing } = await adminClient
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', co.id)
      .maybeSingle()

    if (!existing) {
      await adminClient.from('company_memberships').insert({
        user_id: user.id,
        company_id: co.id,
        role: 'admin',
        is_active: true
      })
      results.push({ 
        name: co.display_name, 
        slug: co.slug,
        count: empCount || 0,
        status: 'Vínculo creado' 
      })
    } else {
      results.push({ 
        name: co.display_name, 
        slug: co.slug,
        count: empCount || 0,
        status: 'Acceso verificado' 
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-2xl rounded-[40px] bg-white p-10 shadow-2xl ring-1 ring-white/10">
        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl mb-4 shadow-lg">⚡</div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Restauración de Datos</h1>
          <p className="mt-3 text-slate-500 leading-relaxed font-semibold">
            Hemos sincronizado tu cuenta y analizado dónde están tus colaboradores.
          </p>
        </div>

        <div className="space-y-4">
          {results.map((r, i) => (
            <div key={i} className="group relative overflow-hidden rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-100 transition hover:bg-white hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-900">{r.name}</h3>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-tighter">slug: {r.slug}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    {r.count} colaboradores encontrados
                  </p>
                </div>
                <div className="text-right">
                   <span className="inline-block px-3 py-1 rounded-full bg-slate-900 text-[10px] font-black text-white uppercase tracking-widest">{r.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100 italic text-[10px] text-slate-400 text-center font-medium">
          Identificador de Usuario activo: {user.id}
        </div>

        <a 
          href="/dashboard"
          className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:scale-[1.02] hover:bg-slate-800 active:scale-[0.98] shadow-xl"
        >
          Ir al Panel de Control
        </a>
      </div>
    </div>
  )
}
