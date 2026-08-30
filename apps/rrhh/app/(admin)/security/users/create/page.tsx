import { createClient } from '@/lib/supabase/server'
import { UserCreatorClient } from './UserCreatorClient'

export default async function UserCreatePage() {
  const supabase = await createClient()

  // 1. Obtener el contexto de la empresa del admin logueado
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: memberships } = await supabase
    .from('company_memberships')
    .select('company_id, role')
    .eq('user_id', currentUser?.id)
    .in('role', ['owner', 'admin'])

  // Si el usuario tiene múltiples membresías, preferir la de owner
  const primaryMembership = memberships?.find(m => m.role === 'owner') ?? memberships?.[0]
  const isOwner = primaryMembership?.role === 'owner'
  const companyId = primaryMembership?.company_id ?? ''

  return (
    <UserCreatorClient 
      companyId={companyId}
      isOwner={isOwner}
    />
  )
}
