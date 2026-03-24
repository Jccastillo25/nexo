import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { CheckCircle2 } from 'lucide-react'

export default async function FixVisibilityPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-10 text-center font-bold">Por favor, inicia sesión primero.</div>

  // 2. Find ALL existing companies and memberships for this user
  const [{ data: allCompanies }, { data: currentMemberships }] = await Promise.all([
    adminClient.from('companies').select('id, display_name, slug'),
    adminClient.from('company_memberships').select('company_id').eq('user_id', user.id)
  ])

  if (!allCompanies || allCompanies.length === 0) {
    return (
        <div className="p-10 text-center space-y-4 max-w-lg mx-auto mt-20">
          <h1 className="text-2xl font-bold text-slate-900">No se encontraron empresas</h1>
          <p className="text-slate-500">La base de datos de empresas parece estar vacía.</p>
        </div>
    )
  }

  // 3. Create memberships and count employees
  const results = []
  for (const co of allCompanies) {
    const { count: empCount } = await adminClient
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', co.id)

    const isMember = currentMemberships?.some(m => m.company_id === co.id)

    if (!isMember) {
      await adminClient.from('company_memberships').insert({
        user_id: user.id,
        company_id: co.id,
        role: 'admin',
        is_active: true
      })
      results.push({ name: co.display_name, slug: co.slug, count: empCount || 0, status: 'Vinculado Ahora' })
    } else {
      results.push({ name: co.display_name, slug: co.slug, count: empCount || 0, status: 'Ya Vinculado' })
    }
  }

  // FORCE REVALIDATION
  revalidatePath('/', 'layout')

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-2xl rounded-[40px] bg-white p-10 shadow-2xl ring-1 ring-white/10">
        <div className="mb-10 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[30%] bg-blue-600 text-white text-3xl mb-6 shadow-2xl shadow-blue-500/20">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Sincronización Exitosa</h1>
          <p className="mt-4 text-lg text-slate-500 leading-relaxed font-medium">
            Tu cuenta ha sido vinculada como administrador en todas las organizaciones encontradas.
          </p>
        </div>

        <div className="space-y-4">
          {results.map((r, i) => (
            <div key={i} className="group relative overflow-hidden rounded-[32px] bg-slate-50 p-6 border border-slate-100 transition hover:bg-white hover:shadow-xl hover:border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                    {r.name[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{r.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{r.count} Colaboradores</span>
                       <span className="text-slate-300">•</span>
                       <span className="text-[10px] font-mono text-slate-400 uppercase leading-none mt-0.5">Slug: {r.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                   <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-500/20">
                     {r.status}
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4 text-center">
          <a 
            href="/dashboard"
            className="flex h-16 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:scale-[1.02] hover:bg-slate-800 active:scale-[0.98] shadow-2xl"
          >
            Finalizar y Entrar al Panel
          </a>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            ID de Usuario: {user.id}
          </p>
        </div>
      </div>
    </div>
  )
}
