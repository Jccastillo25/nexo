import { createClient } from '@/lib/supabase/server'
import { Zap } from 'lucide-react'

const roleLabels: Record<string, string> = {
  owner:      'Propietario',
  admin:      'Administrador',
  rrhh:       'RRHH',
  supervisor: 'Supervisor',
  viewer:     'Visor',
}

export default async function SecurityPage() {
  const supabase = await createClient()

  const [
    { data: memberships },
    { data: auditLogs,   count: totalLogs  },
  ] = await Promise.all([
    supabase
      .from('company_memberships')
      .select('id, role, is_active, profiles(email, full_name), companies(display_name)')
      .order('role'),
    supabase
      .from('audit_logs')
      .select('id, action, entity, impersonator_id, created_at, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const roleCount = (memberships ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="space-y-6">

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Estructura</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Seguridad y auditoría</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Control de acceso por roles, membresías activas y trazabilidad de acciones del sistema.
        </p>
      </div>

      {/* Resumen de roles */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{roleCount[role] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Membresías */}
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
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memberships.map((m) => {
                  const profile = m.profiles as unknown as { id: string; email: string; full_name: string | null } | null
                  const co      = m.companies as unknown as { display_name: string } | null
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{profile?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{profile?.email ?? ''}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{co?.display_name ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {roleLabels[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {m.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={`/security/users/${profile?.id}`} 
                          className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          Editar
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No hay miembros con acceso configurados. Inicia sesión y crea tu cuenta de administrador.
          </div>
        )}
      </div>

      {/* Auditoría */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Registro de auditoría</h2>
          <span className="text-xs text-slate-400">{totalLogs ?? 0} eventos</span>
        </div>
        {auditLogs && auditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Acción</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Entidad</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Auditor Dual</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => {
                  const profile = log.profiles as unknown as { full_name: string | null; email: string } | null
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-700">{log.action}</td>
                      <td className="px-6 py-3.5 text-slate-600">{log.entity}</td>
                      <td className="px-6 py-3.5 text-slate-500">{profile?.full_name ?? profile?.email ?? '—'}</td>
                      <td className="px-6 py-3.5">
                        {log.impersonator_id ? (
                          <div className="flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                            <Zap className="h-3 w-3" />
                            Suplantado
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-400 text-xs">
                        {new Date(log.created_at).toLocaleString('es-NI', { timeZone: 'America/Managua' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No hay eventos de auditoría registrados aún.
          </div>
        )}
      </div>

    </section>
  )
}
