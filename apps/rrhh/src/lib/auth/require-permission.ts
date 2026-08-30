'use server'

import { createClient } from '@/lib/supabase/server'
import type { PermissionKey } from '@/types/security'

export type PermissionResult =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; error: string }

/**
 * Server-side permission gate. Call at the top of any Server Action.
 * Owners and admins bypass granular checks; all others require the
 * specific permission to be TRUE in user_permissions.
 */
export async function requirePermission(permission: PermissionKey): Promise<PermissionResult> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { ok: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) return { ok: false, error: 'Perfil sin empresa asociada' }

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (membership?.role === 'owner' || membership?.role === 'admin') {
    return { ok: true, userId: user.id, companyId }
  }

  const { data: perms } = await supabase
    .from('user_permissions')
    .select(permission)
    .eq('profile_id', user.id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!perms || !(perms as Record<string, unknown>)[permission]) {
    return { ok: false, error: 'No tienes permisos para realizar esta acción' }
  }

  return { ok: true, userId: user.id, companyId }
}
