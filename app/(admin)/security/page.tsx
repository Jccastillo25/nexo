import { createClient } from '@/lib/supabase/server'
import { Zap, ShieldCheck, Users, Activity, ExternalLink, ShieldAlert, UserPlus } from 'lucide-react'

const roleLabels: Record<string, string> = {
  owner:      'Propietario Principal',
  admin:      'Administrador Local',
  rrhh:       'Gestor RRHH',
  supervisor: 'Supervisor Operativo',
  viewer:     'Visor de Reportes',
}

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function SecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verificación de seguridad robusta (Server-side)
  const adminClient = createAdminClient()
  const { data: membership } = await adminClient
    .from('company_memberships')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    // Si no es admin/owner, verificar permisos granulares
    const { data: perms } = await adminClient
      .from('user_permissions')
      .select('can_manage_users')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!perms?.can_manage_users) {
      redirect('/dashboard')
    }
  }

  const [
    { data: memberships },
    { data: auditLogs,   count: totalLogs  },
  ] = await Promise.all([
    supabase
      .from('company_memberships')
      .select('id, user_id, role, is_active, profiles(id, email, full_name, linked_employee_id), companies(display_name)')
      .order('role'),
    supabase
      .from('audit_logs')
      .select('id, action, table_name, impersonator_id, created_at, profiles!impersonator_id(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const roleCount = (memberships ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-12 animate-in fade-in duration-1000 pb-20">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Gestión de Seguridades</p>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Administración de Accesos</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Control centralizado de identidades híbridas, matrices de permisos y auditoría forense para <span className="text-white">Gestor360</span>.
          </p>
        </div>
        <div className="flex shrink-0">
          <a
            href="/security/users/create"
            className="shrink-0 rounded-2xl bg-emerald-500 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            NUEVO TICKET
          </a>
        </div>
      </div>

      {/* Métrica de Estructura */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="app-surface p-5 relative overflow-hidden group hover:border-slate-500 transition-all">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-2">{label}</p>
            <p className="text-3xl font-black text-white tracking-tight">{roleCount[role] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Miembros / Membresías (8/12) */}
        <div className="xl:col-span-8 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Miembros del Ecosistema</h2>

          <div className="app-surface overflow-hidden">
            {memberships && memberships.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Identidad / Contexto</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Privilegios</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">SSOT Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {memberships.map((m) => {
                      const profile = m.profiles as unknown as { id: string; email: string; full_name: string | null; linked_employee_id: string | null } | null
                      const co      = m.companies as unknown as { display_name: string } | null
                      const isHybrid = !!profile?.linked_employee_id

                      return (
                        <tr key={m.id} className="group hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-white uppercase tracking-tight">
                                {profile?.full_name ?? 'SIN IDENTIDAD RRHH'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400">{profile?.email}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-600"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{co?.display_name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                              {roleLabels[m.role] || m.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${isHybrid ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isHybrid ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {isHybrid ? 'HÍBRIDO (SSOT)' : 'EXTERNO'}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                  {isHybrid ? 'Vínculo Activo' : 'Manual / Provisional'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <a 
                              href={`/security/users/${m.user_id}`} 
                              className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-slate-500">Sin registros de membresía activos</p>
              </div>
            )}
          </div>
        </div>

        {/* Auditoría (4/12) */}
        <div className="xl:col-span-4 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Caja Negra (Log)</h2>

          <div className="app-surface p-6">
            
            {auditLogs && auditLogs.length > 0 ? (
              <div className="space-y-4">
                {auditLogs.map((log) => {
                  const profile = log.profiles as unknown as { full_name: string | null; email: string } | null
                  return (
                    <div key={log.id} className="group relative flex flex-col gap-2 pb-4 border-b border-slate-700/50 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {log.action}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {profile?.full_name || profile?.email || 'Sistema'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{log.table_name}</span>
                        {log.impersonator_id && (
                          <div className="flex items-center gap-1.5 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded-lg font-black tracking-widest">
                            <Zap className="h-3 w-3 fill-amber-500" />
                            SUPLANTADO
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 uppercase tracking-widest text-[10px] font-black">
                Vacío histórico
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  )
}
