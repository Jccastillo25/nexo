import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShellClient } from './admin-shell-client'
import type { UserPermissions } from '@/types/security'

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let companyName = 'Gestor360'
  let userName = 'Administrador'
  let userRole = 'admin'
  let userCompanyId = ''
  let userCompanies: { id: string; name: string; slug: string }[] = []
  let userPermissions: Partial<UserPermissions> = {}

  if (user) {
    userName =
      (user.user_metadata?.full_name as string) ||
      user.email?.split('@')[0] ||
      'Administrador'

    const adminClient = createAdminClient()
    const { data: memberships } = await adminClient
      .from('company_memberships')
      .select('role, company_id, companies(id, display_name, slug)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (memberships && memberships.length > 0) {
      const primary = memberships[0]
      userRole = primary.role
      userCompanyId = primary.company_id
      const co = primary.companies as any
      if (co?.display_name) companyName = co.display_name

      userCompanies = memberships
        .map(m => {
          const c = m.companies as any
          if (!c) return null
          return { id: c.id, name: c.display_name || 'Sin nombre', slug: c.slug || '' }
        })
        .filter((c): c is { id: string; name: string; slug: string } => c !== null)

      // Obtener permisos granulares del usuario para su empresa principal
      if (userCompanyId) {
        const { data: permsRow } = await adminClient
          .from('user_permissions')
          .select('*')
          .eq('profile_id', user.id)
          .eq('company_id', userCompanyId)
          .maybeSingle()

        if (permsRow) {
          userPermissions = permsRow
        } else if (['owner', 'admin'].includes(userRole)) {
          // Los owners y admins tienen acceso total si no hay registro explícito
          const allTrue = Object.fromEntries(
            [
              'can_view_kpis_talent','can_view_kpis_attendance','can_view_kpis_financial','can_view_kpis_hardware',
              'can_manage_kiosks','can_view_employees','can_manage_employees','can_view_contracts','can_manage_contracts',
              'can_view_shift_templates','can_manage_shift_templates','can_manage_schedules',
              'can_view_attendance','can_manage_attendance','can_approve_corrections','can_manage_leaves',
              'can_view_reports','can_view_payroll','can_manage_payroll','can_view_salary',
              'can_manage_company','can_manage_settings','can_manage_users','can_manage_roles',
              'can_view_audit_logs','can_impersonate',
            ].map(k => [k, true])
          )
          userPermissions = allTrue
        }
      }
    }
  }

  const { data: brandingRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('key', 'logo_url')

  const logoUrl = brandingRows?.[0]?.value ?? null

  return (
    <AdminShellClient
      companyName={companyName}
      userName={userName}
      userRole={userRole}
      logoUrl={logoUrl}
      companies={userCompanies}
      userPermissions={userPermissions}
    >
      {children}
    </AdminShellClient>
  )
}
