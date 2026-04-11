'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

export async function saveUserChanges(
  payload: SaveUserPayload
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const adminClient = createAdminClient()

    // Verificar que el caller es admin/owner de esa empresa
    const { data: callerMembership } = await adminClient
      .from('company_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', payload.companyId)
      .in('role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle()

    if (!callerMembership) return { error: 'Sin permisos para modificar usuarios en esta empresa' }

    // 1. Actualizar perfil
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        linked_employee_id: payload.linkedEmployeeId,
        full_name: payload.fullName,
        position: payload.position,
        company_id: payload.primaryCompanyId,
      })
      .eq('id', payload.targetUserId)
    if (profileError) return { error: `Perfil: ${profileError.message}` }

    // 2. Rol principal — maybeSingle para saber si existe
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
      if (error) return { error: `Rol: ${error.message}` }
    } else {
      const { error } = await adminClient
        .from('company_memberships')
        .insert({ user_id: payload.targetUserId, company_id: payload.companyId, role: payload.role, is_active: true })
      if (error) return { error: `Membresía: ${error.message}` }
    }

    // 3. Membresías multi-empresa
    const toAdd = payload.selectedCompanyIds.filter(id => !payload.initialCompanyIds.includes(id))
    const toRemove = payload.initialCompanyIds
      .filter(id => !payload.selectedCompanyIds.includes(id) && id !== payload.companyId)

    if (toRemove.length > 0) {
      await adminClient.from('company_memberships').delete()
        .eq('user_id', payload.targetUserId).in('company_id', toRemove)
    }
    if (toAdd.length > 0) {
      await adminClient.from('company_memberships').insert(
        toAdd.map(cId => ({ user_id: payload.targetUserId, company_id: cId, role: 'viewer', is_active: true }))
      )
    }

    // 4. Permisos granulares
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
      if (error) return { error: `Permisos: ${error.message}` }
    } else {
      const { error } = await adminClient
        .from('user_permissions')
        .insert({ profile_id: payload.targetUserId, company_id: payload.companyId, ...payload.permissions })
      if (error) return { error: `Permisos insert: ${error.message}` }
    }

    revalidatePath('/security')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Error inesperado' }
  }
}
