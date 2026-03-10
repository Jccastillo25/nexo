import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let companyName = 'Grupo CT'
  let userName = 'Administrador'
  let userRole = 'admin'

  if (user) {
    userName =
      (user.user_metadata?.full_name as string) ||
      user.email?.split('@')[0] ||
      'Administrador'

    const { data: membership } = await supabase
      .from('company_memberships')
      .select('role, companies(display_name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (membership) {
      userRole = membership.role
      const co = membership.companies as unknown as { display_name: string } | null
      if (co?.display_name) companyName = co.display_name
    }
  }

  const { data: brandingRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('key', 'logo_url')

  const logoUrl = brandingRows?.[0]?.value ?? null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <AdminSidebar
          companyName={companyName}
          userName={userName}
          userRole={userRole}
          logoUrl={logoUrl}
        />
        <div className="flex min-h-screen flex-col">
          <AdminTopbar />
          <main className="flex-1 p-4 md:p-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
