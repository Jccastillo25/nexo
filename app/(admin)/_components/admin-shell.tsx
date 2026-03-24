import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShellClient } from './admin-shell-client'

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let companyName = 'Gestor360'
  let userName = 'Administrador'
  let userRole = 'admin'
  let userCompanies: { id: string, name: string, slug: string }[] = []

  if (user) {
    userName =
      (user.user_metadata?.full_name as string) ||
      user.email?.split('@')[0] ||
      'Administrador'

    // Use Admin Client to bypass RLS and ensure visibility
    const adminClient = createAdminClient()
    const { data: memberships } = await adminClient
      .from('company_memberships')
      .select('role, company_id, companies(id, display_name, slug)')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    // DEBUG:
    console.log(`[AdminShell] User: ${user.id}, Memberships: ${memberships?.length || 0}`)

    if (memberships && memberships.length > 0) {
      console.log(`[AdminShell] Memberships for ${user.id}:`, JSON.stringify(memberships.map(m => ({ id: m.company_id, name: (m.companies as any)?.display_name })), null, 2))
      
      const primary = memberships[0]
      userRole = primary.role
      const co = primary.companies as any
      if (co?.display_name) companyName = co.display_name
      
      // Map all authorized companies defensively
      userCompanies = memberships
        .map(m => {
          const c = m.companies as any
          if (!c) return null
          return {
            id: c.id,
            name: c.display_name || 'Sin nombre',
            slug: c.slug || ''
          }
        })
        .filter((c): c is { id: string, name: string, slug: string } => c !== null)
      
      console.log(`[AdminShell] Valid Companies mapped: ${userCompanies.length}`)
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
    >
      {children}
    </AdminShellClient>
  )
}
