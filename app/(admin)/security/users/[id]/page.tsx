import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { UserEditorClient } from './UserEditorClient'

export default async function UserEditPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  // 1. Obtener el perfil que se va a editar
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, linked_employee_id')
    .eq('id', params.id)
    .single()

  if (!profile) return notFound()

  // 2. Obtener los permisos granulares (o crear objeto vacío)
  const { data: permissions } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('profile_id', params.id)
    .single()

  // 3. Obtener el contexto de la empresa (actualmente manejamos 1 para este demo)
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('company_memberships')
    .select('company_id, role')
    .eq('profile_id', currentUser?.id)
    .single()

  const isOwner = membership?.role === 'owner'
  const companyId = membership?.company_id || ''

  return (
    <UserEditorClient 
      profile={profile}
      initialPermissions={permissions || {}}
      companyId={companyId}
      isOwner={isOwner}
    />
  )
}
