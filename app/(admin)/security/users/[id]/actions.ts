'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

interface SaveUserPayload {
  targetUserId: string
  companyId: string
  role: string
  fullName: string
  position: string
  linkedEmployeeId: string | null
  primaryCompanyId: string | null
  selectedCompanyIds: string[]
  initialCompanyIds: string[]
  permissions: Record<string, boolean>
}

export async function saveUserChanges(payload: SaveUserPayload) {
  // Verificar que el caller es admin/owner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const adminClient = createAdminClient()

  // Verificar permisos del caller
  const { data: callerMembership } = await adminClient
    .from('company_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', payload.companyId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (!callerMembership) {
    throw new Error('No tienes permisos para modificar usuarios en esta empresa')
  }

  // 1. Actualizar perfil
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      linked_employee_id: payload.linkedEmployeeId,
      full_name: payload.fullName,
      position: payload.position,
      company_id: payload.primaryCompanyId
    })
    .eq('id', payload.targetUserId)

  if (profileError) throw new Error(`Error actualizando perfil: ${profileError.message}`)

  // 2. Actualizar / crear membresía principal (usando adminClient bypasea RLS)
  const { data: existingMembership } = await adminClient
    .from('company_memberships')
    .select('id')
    .eq('user_id', payload.targetUserId)
    .eq('company_id', payload.companyId)
    .maybeSingle()

  if (existingMembership) {
    const { error } = await adminClient
      .from('company_memberships')
      .update({ role: payload.role, is_active: true })
      .eq('user_id', payload.targetUserId)
      .eq('company_id', payload.companyId)
    if (error) throw new Error(`Error actualizando rol: ${error.message}`)
  } else {
    const { error } = await adminClient
      .from('company_memberships')
      .insert({ user_id: payload.targetUserId, company_id: payload.companyId, role: payload.role, is_active: true })
    if (error) throw new Error(`Error creando membresía: ${error.message}`)
  }

  // 3. Sincronizar membresías multi-empresa
  const toAdd = payload.selectedCompanyIds.filter(id => !payload.initialCompanyIds.includes(id))
  const toRemove = payload.initialCompanyIds.filter(id => !payload.selectedCompanyIds.includes(id))
    .filter(id => id !== payload.companyId) // Nunca remover la empresa principal

  if (toRemove.length > 0) {
    await adminClient.from('company_memberships').delete()
      .eq('user_id', payload.targetUserId).in('company_id', toRemove)
  }

  if (toAdd.length > 0) {
    await adminClient.from('company_memberships').insert(
      toAdd.map(cId => ({ user_id: payload.targetUserId, company_id: cId, role: 'viewer', is_active: true }))
    )
  }

  // 4. Actualizar permisos granulares
  const { data: existingPerms } = await adminClient
    .from('user_permissions')
    .select('profile_id')
    .eq('profile_id', payload.targetUserId)
    .eq('company_id', payload.companyId)
    .maybeSingle()

  if (existingPerms) {
    const { error } = await adminClient
      .from('user_permissions')
      .update({ ...payload.permissions, updated_at: new Date().toISOString() })
      .eq('profile_id', payload.targetUserId)
      .eq('company_id', payload.companyId)
    if (error) throw new Error(`Error actualizando permisos: ${error.message}`)
  } else {
    const { error } = await adminClient
      .from('user_permissions')
      .insert({ profile_id: payload.targetUserId, company_id: payload.companyId, ...payload.permissions })
    if (error) throw new Error(`Error creando permisos: ${error.message}`)
  }

  revalidatePath('/security')
  redirect('/security')
}
