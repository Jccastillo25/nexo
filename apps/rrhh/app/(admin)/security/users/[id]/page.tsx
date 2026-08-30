import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { UserEditorClient } from './UserEditorClient'

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Obtener el perfil que se va a editar
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, linked_employee_id, position, company_id')
    .eq('id', id)
    .single()

  if (!profile) return notFound()

  // 2. Obtener los permisos granulares (o crear objeto vacío)
  const { data: permissions } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('profile_id', id)
    .single()

  // 3. Obtener todas las membresías del usuario (para el selector multi-empresa)
  const { data: userMemberships } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', id)

  const initialCompanyIds = userMemberships?.map(m => m.company_id) || []

  // 4. Obtener el contexto del administrador actual
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: adminMemberships } = await supabase
    .from('company_memberships')
    .select('company_id, role')
    .eq('user_id', currentUser?.id)
    .in('role', ['owner', 'admin'])

  const primaryMembership = adminMemberships?.find(m => m.role === 'owner') ?? adminMemberships?.[0]
  const isOwner = primaryMembership?.role === 'owner'
  const companyId = primaryMembership?.company_id || ''

  // 5. Obtener el rol actual del usuario que se edita
  const { data: targetMembership } = await supabase
    .from('company_memberships')
    .select('role')
    .eq('user_id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  const initialRole = (targetMembership?.role as any) || 'viewer'

  return (
    <UserEditorClient
      profile={profile}
      initialPermissions={permissions || {}}
      initialRole={initialRole}
      companyId={companyId}
      initialCompanyIds={initialCompanyIds}
      isOwner={isOwner}
    />
  )
}
