import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'
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

  // 3. Create memberships for the current user in all found companies
  const results = []
  for (const co of companies) {
    // Check if membership already exists
    const { data: existing } = await adminClient
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', co.id)
      .maybeSingle()

    if (!existing) {
      const { error } = await adminClient.from('company_memberships').insert({
        user_id: user.id,
        company_id: co.id,
        role: 'admin',
        is_active: true
      })
      results.push({ 
        name: co.display_name, 
        slug: co.slug,
        status: error ? `Error: ${error.message}` : 'SINCRONIZADO ✅' 
      })
    } else {
      results.push({ 
        name: co.display_name, 
        slug: co.slug,
        status: 'Acceso verificado ✨' 
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-xl rounded-[40px] bg-white p-10 shadow-2xl ring-1 ring-white/10">
        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl mb-4 shadow-lg">⚡</div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Restauración de Datos</h1>
          <p className="mt-3 text-slate-500 leading-relaxed font-semibold">
            Hemos sincronizado tu cuenta de correo con las organizaciones encontradas en el sistema.
          </p>
        </div>

        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="group relative overflow-hidden rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-100 transition hover:bg-white hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organización</p>
                  <h3 className="text-lg font-bold text-slate-900">{r.name}</h3>
                  <code className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-tighter">slug: {r.slug}</code>
                </div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{r.status}</span>
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
