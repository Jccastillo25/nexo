import { createClient } from '@/lib/supabase/server'
import { UserCreatorClient } from './UserCreatorClient'

export default async function UserCreatePage() {
  const supabase = await createClient()

  // 1. Obtener el contexto de la empresa del admin logueado
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('company_memberships')
    .select('company_id, role')
    .eq('profile_id', currentUser?.id)
    .single()

  const isOwner = membership?.role === 'owner'
  const companyId = membership?.company_id || ''

  return (
    <UserCreatorClient 
      companyId={companyId}
      isOwner={isOwner}
    />
  )
}
