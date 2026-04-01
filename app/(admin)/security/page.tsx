import { createClient } from '@/lib/supabase/server'
import { Zap, ShieldCheck, Users, Activity, ExternalLink, ShieldAlert, UserPlus } from 'lucide-react'

const roleLabels: Record<string, string> = {
  owner:      'Propietario Principal',
  admin:      'Administrador Local',
  rrhh:       'Gestor RRHH',
  supervisor: 'Supervisor Operativo',
  viewer:     'Visor de Reportes',
}

export default async function SecurityPage() {
  const supabase = await createClient()

  const [
    { data: memberships },
    { data: auditLogs,   count: totalLogs  },
  ] = await Promise.all([
    supabase
      .from('company_memberships')
      .select('id, role, is_active, profiles(id, email, full_name, linked_employee_id), companies(display_name)')
      .order('role'),
    supabase
      .from('audit_logs')
      .select('id, action, entity, impersonator_id, created_at, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const roleCount = (memberships ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-12 animate-in fade-in duration-1000 pb-20">

      {/* Header Premium de Alto Contraste */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-slate-800 to-slate-900 rounded-[50px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8 rounded-[50px] bg-slate-900/80 backdrop-blur-3xl p-12 border border-white/10 shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400/80">Gestión de Seguridades</p>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tight leading-none">Administración de Accesos</h1>
            <p className="mt-4 max-w-xl text-lg font-medium text-white/50 leading-relaxed">
              Control centralizado de identidades híbridas, matrices de permisos y auditoría forense para <span className="text-white">Gestor360</span>.
            </p>
          </div>
          <div className="flex shrink-0">
            <a
              href="/security/users/create"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-[30px] bg-white px-10 py-5 text-sm font-black text-slate-950 transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
            >
              <UserPlus className="h-4 w-4" />
              <span>NUEVO TICKET DE ACCESO</span>
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </a>
          </div>
        </div>
      </div>

      {/* Métrica de Estructura - Alto Contraste */}
      <div className="grid gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="group relative overflow-hidden rounded-[35px] bg-slate-900/40 p-8 border border-white/5 backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-slate-900/60 shadow-xl">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="h-12 w-12 text-white" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-hover:text-white/60 transition-colors">{label}</p>
            <p className="mt-6 text-5xl font-black text-white tracking-tighter">
              {roleCount[role] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Miembros / Membresías (8/12) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="flex items-center gap-4 mb-4 px-4">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <Users className="h-4 w-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Miembros del Ecosistema</h2>
          </div>

          <div className="rounded-[45px] bg-slate-900/40 border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden">
            {memberships && memberships.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Identidad / Contexto</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Privilegios</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">SSOT Status</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {memberships.map((m) => {
                      const profile = m.profiles as unknown as { id: string; email: string; full_name: string | null; linked_employee_id: string | null } | null
                      const co      = m.companies as unknown as { display_name: string } | null
                      const isHybrid = !!profile?.linked_employee_id

                      return (
                        <tr key={m.id} className="group hover:bg-white/[0.03] transition-colors">
                          <td className="px-10 py-8">
                            <div className="flex flex-col gap-1">
                              <span className="text-base font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                                {profile?.full_name ?? 'SIN IDENTIDAD RRHH'}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-white/40">{profile?.email}</span>
                                <span className="h-1 w-1 rounded-full bg-white/10"></span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50">{co?.display_name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <span className="inline-flex items-center rounded-xl bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/5 group-hover:border-emerald-500/30 transition-all">
                              {roleLabels[m.role] || m.role}
                            </span>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full ${isHybrid ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-slate-600 shadow-none'}`} />
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isHybrid ? 'text-emerald-500' : 'text-white/20'}`}>
                                  {isHybrid ? 'HÍBRIDO (SSOT)' : 'EXTERNO'}
                                </span>
                                <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">
                                  {isHybrid ? 'Vínculo Activo' : 'Manual / Provisional'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8 text-right text-white">
                            <a 
                              href={`/security/users/${profile?.id}`} 
                              className="inline-flex items-center justify-center p-4 bg-white/5 hover:bg-white text-white hover:text-slate-950 rounded-2xl transition-all border border-white/5"
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
              <div className="px-10 py-24 text-center">
                <p className="text-sm font-bold text-white/20 uppercase tracking-[0.4em]">Sin registros de membresía activos</p>
              </div>
            )}
          </div>
        </div>

        {/* Auditoría (4/12) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="flex items-center gap-4 mb-4 px-4">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Caja Negra (Log)</h2>
          </div>

          <div className="rounded-[45px] bg-slate-900/60 border border-white/10 backdrop-blur-3xl shadow-2xl p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            
            {auditLogs && auditLogs.length > 0 ? (
              <div className="space-y-6 relative z-10">
                {auditLogs.map((log) => {
                  const profile = log.profiles as unknown as { full_name: string | null; email: string } | null
                  return (
                    <div key={log.id} className="group relative flex flex-col gap-2 p-5 rounded-3xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {log.action}
                        </span>
                        <span className="text-[9px] font-bold text-white/30">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">
                        {profile?.full_name || profile?.email || 'Sistema'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">{log.entity}</span>
                        {log.impersonator_id && (
                          <div className="flex items-center gap-1.5 text-[8px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full font-black tracking-widest">
                            <Zap className="h-2 w-2 fill-amber-500" />
                            SUPLANTADO
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="pt-6 border-t border-white/5 text-center">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Mostrando últimos {auditLogs.length} eventos registrados</p>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-white/20 uppercase tracking-widest text-[10px] font-black">
                Vacío histórico
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  )
}
